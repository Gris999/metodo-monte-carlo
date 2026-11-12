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

N_MIN = 2  # Mínimo de puntos: con 1 solo punto no hay desviación (se dividiría entre N − 1 = 0)
N_MAX = 10_000_000  # Máximo de puntos, para no colgar la computadora
Z_95 = 1.959963984540054  # El 1,96 del intervalo del 95 % (cuantil 0,975 de la normal)


@dataclass(frozen=True)
class ResultadoMC:  # Caja donde se guardan todos los resultados del cálculo
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
    def ic_contiene_exacto(self) -> bool | None:  # ¿El valor exacto quedó dentro del intervalo? (sirve para medir la cobertura del 94 %)
        if self.valor_exacto is None:
            return None
        return self.ic_inferior <= self.valor_exacto <= self.ic_superior


def validar_entradas(n: int, semilla: int) -> None:  # REVISOR DE DATOS: comprueba N y la semilla antes de calcular
    if isinstance(n, bool) or not isinstance(n, (int, np.integer)):  # ¿N no es un número entero? (rechaza también True/False)
        raise TypeError("La cantidad de muestras debe ser un número entero.")  # → error: no existen «2,5 puntos»
    if not N_MIN <= n <= N_MAX:  # CONDICIÓN: ¿N está fuera del rango 2 … 10.000.000?
        raise ValueError(f"La cantidad de muestras debe estar entre {N_MIN} y {N_MAX:,}.")  # → error: N fuera de rango
    if isinstance(semilla, bool) or not isinstance(semilla, (int, np.integer)):  # ¿La semilla no es un número entero?
        raise TypeError("La semilla debe ser un número entero.")  # → error
    if semilla < 0:  # CONDICIÓN: ¿la semilla es negativa?
        raise ValueError("La semilla debe ser un entero no negativo.")  # → error: NumPy solo acepta semillas ≥ 0


def generar_muestras(caso: CasoPrueba, n: int, semilla: int) -> np.ndarray:  # FABRICA LOS PUNTOS AL AZAR (los «random» de las fórmulas)
    """Devuelve una matriz n×d de puntos uniformes en la región del caso."""
    rng = np.random.default_rng(semilla)  # SEMILLA: prepara el generador de números al azar (PCG64 de NumPy); misma semilla → mismos números
    u = rng.random((n, caso.dimension))  # N números al azar entre 0 y 1 (uno por variable)
    a = np.array([lim[0] for lim in caso.limites])  # límite de abajo «a» de la integral
    b = np.array([lim[1] for lim in caso.limites])  # límite de arriba «b» de la integral
    return a + (b - a) * u  # Xi = a + random · (b − a): estira cada número para que caiga entre a y b


def estimar_integral(caso: CasoPrueba, n: int, semilla: int) -> ResultadoMC:  # MÉTODO DE MONTE CARLO (valor medio): todo el cálculo está aquí
    validar_entradas(n, semilla)  # Paso 0: revisar que N y la semilla sean válidos
    x = generar_muestras(caso, n, semilla)  # Paso 1: elegir N puntos al azar Xi entre a y b
    y = caso.funcion(x)  # Paso 2: medir la altura f(Xi) en cada punto
    if not np.all(np.isfinite(y)):  # CONDICIÓN: ¿alguna altura es infinita o no existe (NaN)?
        raise ArithmeticError("La función produjo valores no finitos en la región.")  # → error: un solo valor infinito arruina el promedio
    v = caso.volumen  # ancho del intervalo (b − a); en 2D es el área del rectángulo
    estimacion = v * float(np.mean(y))  # Paso 3 ⭐ Î = (b − a) · promedio de las alturas
    error_estandar = v * float(np.std(y, ddof=1)) / math.sqrt(n)  # Paso 4 ⭐ EE = (b − a) · s / √N   (ddof=1 → divide entre N − 1)
    if caso.valor_exacto is None:  # Si no conocemos el valor exacto (función del usuario)…
        error_absoluto = error_relativo = None  # …no se puede calcular el error real
    else:  # Si conocemos el valor exacto I:
        error_absoluto = abs(estimacion - caso.valor_exacto)  # error absoluto = |Î − I|
        error_relativo = (
            error_absoluto / abs(caso.valor_exacto) if caso.valor_exacto != 0 else None  # error relativo = error absoluto / |I| (si I = 0 no se calcula, para no dividir entre cero)
        )
    return ResultadoMC(  # Se devuelven todos los resultados juntos
        estimacion=estimacion,  # Î, el resultado de la integral
        valor_exacto=caso.valor_exacto,
        error_absoluto=error_absoluto,
        error_relativo=error_relativo,
        error_estandar=error_estandar,  # EE, cuánto puede variar el resultado
        ic_inferior=estimacion - Z_95 * error_estandar,  # Paso 5 ⭐ límite inferior del intervalo: Î − 1,96 · EE
        ic_superior=estimacion + Z_95 * error_estandar,  # límite superior del intervalo: Î + 1,96 · EE
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
