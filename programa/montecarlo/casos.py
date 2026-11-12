"""Casos de prueba con valor exacto conocido (solución analítica).

Disponer del valor exacto permite calcular el error real de cada
estimación y, por lo tanto, validar experimentalmente el método.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Sequence

import numpy as np


@dataclass(frozen=True)
class CasoPrueba:
    clave: str
    nombre: str
    expresion: str
    funcion: Callable[[np.ndarray], np.ndarray]
    limites: Sequence[tuple[float, float]]
    valor_exacto: float | None
    deduccion: str

    @property
    def dimension(self) -> int:
        return len(self.limites)

    @property
    def volumen(self) -> float:
        return float(np.prod([b - a for a, b in self.limites]))


def _x2(x: np.ndarray) -> np.ndarray:
    return x[:, 0] ** 2


def _seno(x: np.ndarray) -> np.ndarray:
    return np.sin(x[:, 0])


def _exp(x: np.ndarray) -> np.ndarray:
    return np.exp(x[:, 0])


def _pi(x: np.ndarray) -> np.ndarray:
    return 4.0 / (1.0 + x[:, 0] ** 2)


def _plano2d(x: np.ndarray) -> np.ndarray:
    return x[:, 0] ** 2 + x[:, 1] ** 2


CASOS: dict[str, CasoPrueba] = {
    c.clave: c
    for c in (
        CasoPrueba(
            "x2", "Caso 1: x² en [0, 1]", "∫₀¹ x² dx", _x2, [(0.0, 1.0)], 1.0 / 3.0,
            "[x³/3] de 0 a 1 = 1/3",
        ),
        CasoPrueba(
            "seno", "Caso 2: sen(x) en [0, π]", "∫₀^π sen(x) dx", _seno, [(0.0, math.pi)], 2.0,
            "[−cos x] de 0 a π = 1 − (−1) = 2",
        ),
        CasoPrueba(
            "exp", "Caso 3: eˣ en [0, 1]", "∫₀¹ eˣ dx", _exp, [(0.0, 1.0)], math.e - 1.0,
            "[eˣ] de 0 a 1 = e − 1",
        ),
        CasoPrueba(
            "pi", "Caso 4: 4/(1+x²) en [0, 1]", "∫₀¹ 4/(1+x²) dx", _pi, [(0.0, 1.0)], math.pi,
            "[4·arctan x] de 0 a 1 = 4·(π/4) = π",
        ),
        CasoPrueba(
            "plano2d", "Caso 5: x²+y² en [0, 1]×[0, 1]", "∫₀¹∫₀¹ (x²+y²) dy dx", _plano2d,
            [(0.0, 1.0), (0.0, 1.0)], 2.0 / 3.0,
            "∫₀¹ (x² + 1/3) dx = 1/3 + 1/3 = 2/3",
        ),
    )
}


def caso_personalizado(expresion: str, a: float, b: float,
                       valor_exacto: float | None = None) -> CasoPrueba:
    """Caso de una variable definido por el usuario (valor exacto opcional)."""
    from .expresiones import crear_funcion

    if not (math.isfinite(a) and math.isfinite(b)):
        raise ValueError("Los límites deben ser números finitos.")
    if not a < b:
        raise ValueError("El límite inferior debe ser menor que el superior.")
    return CasoPrueba("personalizado", f"f(x) = {expresion} en [{a:g}, {b:g}]",
                      f"∫ {expresion} dx de {a:g} a {b:g}", crear_funcion(expresion),
                      [(float(a), float(b))], valor_exacto, "Ingresada por el usuario")


def obtener_caso(clave: str) -> CasoPrueba:
    try:
        return CASOS[clave]
    except KeyError as exc:
        raise ValueError(f"Caso desconocido: {clave!r}. Opciones: {list(CASOS)}") from exc
