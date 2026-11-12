"""Ejecuta los experimentos de la monografía y guarda CSV y figuras.

Uso:  python ejecutar_experimentos.py [--salida resultados] [--repeticiones 30]
"""

from __future__ import annotations

import argparse
import json
import platform
import sys
from datetime import datetime
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from montecarlo import CASOS, convergencia, regla_trapecio
from montecarlo.experimentos import TAMANIOS_PREDETERMINADOS, ejecutar_experimento, resumir


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--salida", default="resultados")
    p.add_argument("--repeticiones", type=int, default=30)
    p.add_argument("--semilla-base", type=int, default=2026)
    args = p.parse_args()
    out = Path(args.salida)
    out.mkdir(parents=True, exist_ok=True)

    entorno = {
        "fecha": datetime.now().isoformat(timespec="seconds"),
        "python": sys.version.split()[0],
        "numpy": np.__version__,
        "pandas": pd.__version__,
        "matplotlib": matplotlib.__version__,
        "sistema": platform.platform(),
        "procesador": platform.processor() or platform.machine(),
        "generador": "numpy.random.default_rng (PCG64)",
        "semilla_base": args.semilla_base,
        "repeticiones": args.repeticiones,
        "tamanios": list(TAMANIOS_PREDETERMINADOS),
    }
    (out / "entorno.json").write_text(json.dumps(entorno, indent=2, ensure_ascii=False))

    todos = pd.concat(
        [ejecutar_experimento(c, TAMANIOS_PREDETERMINADOS, args.repeticiones, args.semilla_base)
         for c in CASOS.values()],
        ignore_index=True,
    )
    todos.to_csv(out / "experimentos_completos.csv", index=False)
    res = resumir(todos)
    res.to_csv(out / "resumen.csv", index=False)

    # Comparación con la regla del trapecio (mismo número de evaluaciones de f)
    filas = []
    for c in CASOS.values():
        if c.dimension != 1:
            continue
        for n in TAMANIOS_PREDETERMINADOS:
            t = regla_trapecio(c, n)
            filas.append({"caso": c.clave, "n": n, "trapecio": t,
                          "error_trapecio": abs(t - c.valor_exacto)})
    trap = pd.DataFrame(filas).merge(res[["caso", "n", "rmse"]], on=["caso", "n"])
    trap.rename(columns={"rmse": "rmse_montecarlo"}).to_csv(out / "comparacion_trapecio.csv",
                                                            index=False)

    # Figura: RMSE vs N en escala log-log con referencia 1/sqrt(N)
    fig, ax = plt.subplots(figsize=(6.5, 4))
    ns = np.array(TAMANIOS_PREDETERMINADOS)
    for c in CASOS.values():
        d = res[res.caso == c.clave]
        ax.loglog(d.n, d.rmse, "o-", label=c.nombre)
    ref = res[res.caso == "x2"].rmse.iloc[0] * np.sqrt(ns[0] / ns)
    ax.loglog(ns, ref, "k--", lw=1, label="Pendiente −1/2 (referencia)")
    ax.set_xlabel("Número de muestras N")
    ax.set_ylabel("RMSE de 30 repeticiones")
    ax.legend(fontsize=7)
    ax.grid(True, which="both", alpha=0.3)
    fig.tight_layout()
    fig.savefig(out / "fig_rmse.png", dpi=200)
    plt.close(fig)

    # Figura: diagramas de caja del caso 1
    d = todos[todos.caso == "x2"]
    fig, ax = plt.subplots(figsize=(6.5, 4))
    ax.boxplot([d[d.n == n].estimacion for n in ns], tick_labels=[f"{n:,}" for n in ns])
    ax.axhline(1 / 3, color="k", ls="--", lw=1, label="Valor exacto 1/3")
    ax.set_xlabel("Número de muestras N")
    ax.set_ylabel("Estimación de ∫₀¹ x² dx")
    ax.legend()
    fig.tight_layout()
    fig.savefig(out / "fig_cajas_x2.png", dpi=200)
    plt.close(fig)

    # Figura: convergencia de una ejecución del caso 1
    k, est = convergencia(CASOS["x2"], 100_000, args.semilla_base)
    fig, ax = plt.subplots(figsize=(6.5, 4))
    ax.plot(k, est, lw=0.8, label=f"Estimación acumulada (semilla {args.semilla_base})")
    ax.axhline(1 / 3, color="k", ls="--", lw=1, label="Valor exacto 1/3")
    ax.set_xscale("log")
    ax.set_xlabel("Número de muestras k")
    ax.set_ylabel("Î_k")
    ax.legend()
    fig.tight_layout()
    fig.savefig(out / "fig_convergencia_x2.png", dpi=200)
    plt.close(fig)

    print(f"Resultados guardados en {out.resolve()}")


if __name__ == "__main__":
    main()
