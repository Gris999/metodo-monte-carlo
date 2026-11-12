"""Cálculo del estimador de Monte Carlo y de sus medidas de error.

Estimador (método del valor medio):
    Î_N = V · (1/N) · Σ f(X_i),   X_i ~ Uniforme(región), independientes,
donde V es el volumen (longitud en 1D) de la región de integración.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from .casos import CasoPrueba

N_MIN = 2  # se necesitan al menos 2 muestras para la desviación estándar muestral
N_MAX = 10_000_000
Z_95 = 1.959963984540054  # cuantil 0,975 de la normal estándar


@dataclass(frozen=True)
class ResultadoMC:
    estimacion: float
    valor_exacto: float | None
    error_absoluto: float | None
    error_relativo: float | None
    error_estandar: float
    ic_inferior: float
    ic_superior: float
    n: int
    semilla: int

    @property
    def ic_contiene_exacto(self) -> bool | None:
        if self.valor_exacto is None:
            return None
        return self.ic_inferior <= self.valor_exacto <= self.ic_superior


def validar_entradas(n: int, semilla: int) -> None:
    if isinstance(n, bool) or not isinstance(n, (int, np.integer)):
        raise TypeError("La cantidad de muestras debe ser un número entero.")
    if not N_MIN <= n <= N_MAX:  # ① DI: «Primero el programa revisa los datos: si N es menor que 2 da error, porque con un solo punto no se puede calcular el error estándar.»
        raise ValueError(f"La cantidad de muestras debe estar entre {N_MIN} y {N_MAX:,}.")
    if isinstance(semilla, bool) or not isinstance(semilla, (int, np.integer)):
        raise TypeError("La semilla debe ser un número entero.")
    if semilla < 0:
        raise ValueError("La semilla debe ser un entero no negativo.")


def generar_muestras(caso: CasoPrueba, n: int, semilla: int) -> np.ndarray:
    """Devuelve una matriz n×d de puntos uniformes en la región del caso."""
    rng = np.random.default_rng(semilla)  # ② DI: «Aquí entra la semilla: arranca el generador de números al azar. Con la misma semilla salen los mismos números, por eso podemos repetir el ejercicio.»
    u = rng.random((n, caso.dimension))
    a = np.array([lim[0] for lim in caso.limites])
    b = np.array([lim[1] for lim in caso.limites])
    return a + (b - a) * u  # ③ DI: «Aquí se eligen los puntos al azar: Xi = a + random por (b − a), así cada punto cae entre a y b.»


def estimar_integral(caso: CasoPrueba, n: int, semilla: int) -> ResultadoMC:
    validar_entradas(n, semilla)
    x = generar_muestras(caso, n, semilla)
    y = caso.funcion(x)  # ④ DI: «Aquí se calcula la altura de la curva en cada punto, f(Xi).»
    if not np.all(np.isfinite(y)):
        raise ArithmeticError("La función produjo valores no finitos en la región.")
    v = caso.volumen
    estimacion = v * float(np.mean(y))  # ⑤ DI: «Este es el método: el ancho (b − a) por el promedio de las alturas. Con x², 10 puntos y semilla 2026 da 0,2914.»
    error_estandar = v * float(np.std(y, ddof=1)) / math.sqrt(n)  # ⑥ DI: «Aquí el error estándar: el ancho por la desviación s, dividido entre raíz de N. ddof=1 significa dividir entre N − 1. Da 0,0853.»
    if caso.valor_exacto is None:
        error_absoluto = error_relativo = None
    else:
        error_absoluto = abs(estimacion - caso.valor_exacto)
        error_relativo = (
            error_absoluto / abs(caso.valor_exacto) if caso.valor_exacto != 0 else None
        )
    return ResultadoMC(
        estimacion=estimacion,
        valor_exacto=caso.valor_exacto,
        error_absoluto=error_absoluto,
        error_relativo=error_relativo,
        error_estandar=error_estandar,
        ic_inferior=estimacion - Z_95 * error_estandar,  # ⑦ DI: «Y el intervalo de confianza: el resultado menos 1,96 errores estándar…»
        ic_superior=estimacion + Z_95 * error_estandar,  # ⑧ DI: «…y más 1,96 errores estándar. Da de 0,1243 a 0,4585, y el valor exacto 1/3 queda dentro.»  → luego abre app.js, línea 115
        n=int(n),
        semilla=int(semilla),
    )


def convergencia(caso: CasoPrueba, n: int, semilla: int) -> tuple[np.ndarray, np.ndarray]:
    """Estimación acumulada Î_k para k = 1..n con la misma secuencia de muestras."""
    validar_entradas(n, semilla)
    k, est, _ = convergencia_con_banda(caso, n, semilla)
    return k, est


def convergencia_con_banda(
    caso: CasoPrueba, n: int, semilla: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Estimación acumulada y su error estándar acumulado (para k ≥ 2)."""
    validar_entradas(n, semilla)
    y = caso.funcion(generar_muestras(caso, n, semilla))
    k = np.arange(1, n + 1)
    media = np.cumsum(y) / k
    media2 = np.cumsum(y * y) / k
    var = np.where(k > 1, (media2 - media**2) * k / np.maximum(k - 1, 1), np.nan)
    ee = caso.volumen * np.sqrt(np.maximum(var, 0.0)) / np.sqrt(k)
    return k, caso.volumen * media, ee


def regla_trapecio(caso: CasoPrueba, n_puntos: int) -> float:
    """Regla del trapecio compuesta con n_puntos nodos (solo casos 1D)."""
    if caso.dimension != 1:
        raise ValueError("La regla del trapecio implementada es solo para una dimensión.")
    if n_puntos < 2:
        raise ValueError("Se requieren al menos 2 nodos.")
    a, b = caso.limites[0]
    x = np.linspace(a, b, n_puntos)
    y = caso.funcion(x.reshape(-1, 1))
    h = (b - a) / (n_puntos - 1)
    return float(h * (y.sum() - 0.5 * (y[0] + y[-1])))
