"""Experimentos repetidos con semillas registradas."""

from __future__ import annotations

import time
from typing import Iterable

import pandas as pd

from .casos import CasoPrueba
from .nucleo import estimar_integral

TAMANIOS_PREDETERMINADOS = (100, 1_000, 10_000, 100_000)


def semillas_para(semilla_base: int, repeticiones: int) -> list[int]:
    """Semillas consecutivas a partir de la base: reproducibles y registradas."""
    return [semilla_base + r for r in range(repeticiones)]


def ejecutar_experimento(
    caso: CasoPrueba,
    tamanios: Iterable[int] = TAMANIOS_PREDETERMINADOS,
    repeticiones: int = 30,
    semilla_base: int = 2026,
) -> pd.DataFrame:
    if not 1 <= repeticiones <= 1000:
        raise ValueError("Las repeticiones deben estar entre 1 y 1000.")
    filas = []
    for n in tamanios:
        for r, semilla in enumerate(semillas_para(semilla_base, repeticiones), start=1):
            t0 = time.perf_counter()
            res = estimar_integral(caso, int(n), semilla)
            dt = time.perf_counter() - t0
            filas.append(
                {
                    "caso": caso.clave,
                    "n": res.n,
                    "repeticion": r,
                    "semilla": res.semilla,
                    "estimacion": res.estimacion,
                    "valor_exacto": res.valor_exacto,
                    "error_absoluto": res.error_absoluto,
                    "error_relativo": res.error_relativo,
                    "error_estandar": res.error_estandar,
                    "ic_inferior": res.ic_inferior,
                    "ic_superior": res.ic_superior,
                    "ic_contiene_exacto": res.ic_contiene_exacto,
                    "tiempo_s": dt,
                }
            )
    return pd.DataFrame(filas)


def resumir(df: pd.DataFrame) -> pd.DataFrame:
    """Estadísticos por caso y tamaño de muestra."""
    g = df.groupby(["caso", "n"])
    resumen = g.agg(
        repeticiones=("estimacion", "size"),
        media_estimacion=("estimacion", "mean"),
        desv_estimaciones=("estimacion", "std"),
        min_estimacion=("estimacion", "min"),
        max_estimacion=("estimacion", "max"),
        media_error_abs=("error_absoluto", "mean"),
        max_error_abs=("error_absoluto", "max"),
        media_error_rel=("error_relativo", "mean"),
        media_error_estandar=("error_estandar", "mean"),
        cobertura_ic95=("ic_contiene_exacto", "mean"),
        media_tiempo_s=("tiempo_s", "mean"),
    ).reset_index()
    resumen["rmse"] = g.apply(
        lambda d: float(((d["estimacion"] - d["valor_exacto"]) ** 2).mean() ** 0.5),
        include_groups=False,
    ).values
    return resumen
