"""Servidor web: expone el núcleo de cálculo como API y sirve la interfaz.

Ejecutar con:  python servidor.py   (abre http://localhost:8000)
"""

from __future__ import annotations

import argparse
import math
import mimetypes
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from montecarlo import (
    CASOS,
    CasoPrueba,
    caso_personalizado,
    convergencia_con_banda,
    estimar_integral,
    obtener_caso,
    regla_trapecio,
)
from montecarlo.experimentos import ejecutar_experimento, resumir
from montecarlo.nucleo import N_MAX, Z_95, generar_muestras

WEB = Path(__file__).resolve().parent / "web"
mimetypes.add_type("application/manifest+json", ".webmanifest")
TAMANIOS_PERMITIDOS = {100, 1_000, 10_000, 100_000, 1_000_000}

app = FastAPI(title="Integración por Monte Carlo")


@app.middleware("http")
async def sin_cache(request, call_next):
    """Evita que el navegador muestre versiones viejas de la interfaz."""
    respuesta = await call_next(request)
    respuesta.headers["Cache-Control"] = "no-cache"
    return respuesta


class Funcion(BaseModel):
    caso: str | None = Field(None, description="Clave de un caso documentado")
    expresion: str | None = Field(None, description="f(x) escrita por el usuario")
    a: float | None = None
    b: float | None = None
    exacto: float | None = None


class PedidoEstimacion(Funcion):
    n: int = 10_000
    semilla: int = 2026


class PedidoExperimento(Funcion):
    tamanios: list[int] = [100, 1_000, 10_000, 100_000]
    repeticiones: int = 30
    semilla: int = 2026


def _caso(p: Funcion) -> CasoPrueba:
    try:
        if p.caso:
            return obtener_caso(p.caso)
        if p.expresion is None or p.a is None or p.b is None:
            raise ValueError("Indique un caso o una función con sus límites a y b.")
        return caso_personalizado(p.expresion, p.a, p.b, p.exacto)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


def _limpio(v: float | None) -> float | None:
    if v is None:
        return None
    v = float(v)
    return v if math.isfinite(v) else None


def _indices_log(n: int, puntos: int = 400) -> np.ndarray:
    """Índices (base 0) espaciados logarítmicamente para dibujar la convergencia."""
    return np.unique(np.geomspace(1, n, num=min(puntos, n)).astype(int)) - 1


@app.get("/api/casos")
def casos() -> list[dict]:
    return [
        {"clave": c.clave, "nombre": c.nombre, "expresion": c.expresion,
         "exacto": c.valor_exacto, "deduccion": c.deduccion, "dimension": c.dimension,
         "limites": c.limites}
        for c in CASOS.values()
    ]


@app.post("/api/estimar")
def estimar(p: PedidoEstimacion) -> dict:
    caso = _caso(p)
    try:
        r = estimar_integral(caso, p.n, p.semilla)
    except (ValueError, TypeError, ArithmeticError) as exc:
        raise HTTPException(422, str(exc)) from exc

    n_graf = min(p.n, 200_000)
    k, est, ee = convergencia_con_banda(caso, n_graf, p.semilla)
    idx = _indices_log(n_graf)
    conv = [{"k": int(k[i]), "est": _limpio(est[i]),
             "inf": _limpio(est[i] - Z_95 * ee[i]), "sup": _limpio(est[i] + Z_95 * ee[i])}
            for i in idx]

    m = min(p.n, 20)
    x20 = generar_muestras(caso, m, p.semilla)
    y20 = caso.funcion(x20)
    acum = caso.volumen * np.cumsum(y20) / np.arange(1, m + 1)
    pasos = [{"i": i + 1, "x": [float(v) for v in x20[i]], "fx": float(y20[i]),
              "acumulado": float(acum[i])} for i in range(m)]

    salida = {
        "caso": {"clave": caso.clave, "nombre": caso.nombre, "expresion": caso.expresion,
                 "exacto": caso.valor_exacto, "deduccion": caso.deduccion,
                 "dimension": caso.dimension, "volumen": caso.volumen},
        "resultado": {
            "estimacion": r.estimacion, "error_absoluto": r.error_absoluto,
            "error_relativo": r.error_relativo, "error_estandar": r.error_estandar,
            "ic_inferior": r.ic_inferior, "ic_superior": r.ic_superior,
            "ic_contiene_exacto": r.ic_contiene_exacto, "n": r.n, "semilla": r.semilla,
        },
        "convergencia": conv,
        "pasos": pasos,
        "resumen_pasos": {"n": m, "suma": float(y20.sum()), "promedio": float(y20.mean()),
                          "desviacion": float(np.std(y20, ddof=1)) if m > 1 else None},
        "curva": None, "muestras": None, "trapecio": None,
    }
    if caso.dimension == 1:
        a, b = caso.limites[0]
        xx = np.linspace(a, b, 240).reshape(-1, 1)
        yy = caso.funcion(xx)
        xm = generar_muestras(caso, min(p.n, 300), p.semilla)
        ym = caso.funcion(xm)
        salida["curva"] = [[float(u), _limpio(v)] for u, v in zip(xx[:, 0], yy)]
        salida["muestras"] = [[float(u), float(v)] for u, v in zip(xm[:, 0], ym)]
        t = regla_trapecio(caso, min(p.n, N_MAX))
        salida["trapecio"] = {
            "resultado": t,
            "error_absoluto": None if caso.valor_exacto is None else abs(t - caso.valor_exacto),
        }
    return salida


@app.post("/api/experimentos")
def experimentos(p: PedidoExperimento) -> dict:
    caso = _caso(p)
    ns = sorted(set(p.tamanios))
    if not ns or not set(ns) <= TAMANIOS_PERMITIDOS:
        raise HTTPException(422, "Elija cantidades de puntos entre 100 y 1.000.000.")
    if not 1 <= p.repeticiones <= 200:
        raise HTTPException(422, "Las repeticiones deben estar entre 1 y 200.")
    if p.semilla < 0:
        raise HTTPException(422, "La semilla debe ser un entero no negativo.")
    df = ejecutar_experimento(caso, ns, p.repeticiones, p.semilla)
    res = resumir(df)

    cajas = []
    for n in ns:
        e = df[df.n == n].estimacion.to_numpy()
        q1, med, q3 = np.percentile(e, [25, 50, 75])
        cajas.append({"n": n, "min": float(e.min()), "q1": float(q1), "mediana": float(med),
                      "q3": float(q3), "max": float(e.max())})
    peores = total = None
    if caso.valor_exacto is not None and len(ns) > 1:
        piv = df.pivot_table(index="repeticion", columns="n", values="error_absoluto")
        peores = sum(int((piv[ns[i + 1]] > piv[ns[i]]).sum()) for i in range(len(ns) - 1))
        total = p.repeticiones * (len(ns) - 1)
    filas = [{k: (_limpio(v) if isinstance(v, float) else v) for k, v in fila.items()}
             for fila in res.to_dict(orient="records")]
    return {"resumen": filas, "cajas": cajas, "peores": peores, "comparaciones": total,
            "exacto": caso.valor_exacto, "csv_completo": df.to_csv(index=False),
            "csv_resumen": res.to_csv(index=False)}


@app.get("/")
def inicio() -> FileResponse:
    return FileResponse(WEB / "index.html")


app.mount("/", StaticFiles(directory=WEB), name="web")


if __name__ == "__main__":
    import uvicorn

    parser = argparse.ArgumentParser(description="Servidor de la app de Monte Carlo")
    parser.add_argument("--red", action="store_true",
                        help="Escuchar en la red local para abrir la app desde un celular")
    parser.add_argument("--puerto", type=int, default=8000)
    args = parser.parse_args()
    uvicorn.run(app, host="0.0.0.0" if args.red else "127.0.0.1", port=args.puerto)
