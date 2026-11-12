"""Paquete de integración numérica por el método de Monte Carlo."""

from .casos import CASOS, CasoPrueba, caso_personalizado, obtener_caso
from .nucleo import (
    ResultadoMC,
    estimar_integral,
    convergencia,
    convergencia_con_banda,
    regla_trapecio,
    validar_entradas,
)

__all__ = [
    "CASOS",
    "CasoPrueba",
    "obtener_caso",
    "caso_personalizado",
    "convergencia_con_banda",
    "ResultadoMC",
    "estimar_integral",
    "convergencia",
    "regla_trapecio",
    "validar_entradas",
]
