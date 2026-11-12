"""Conversión segura de una expresión escrita por el usuario en una función f(x).

No se usa eval(): la expresión se analiza con el módulo ast y solo se aceptan
números, la variable x, operadores aritméticos y funciones matemáticas de una
lista permitida.
"""

from __future__ import annotations

import ast
import math
from typing import Callable

import numpy as np

FUNCIONES: dict[str, Callable[[np.ndarray], np.ndarray]] = {
    "sin": np.sin, "sen": np.sin, "cos": np.cos, "tan": np.tan,
    "arcsin": np.arcsin, "arccos": np.arccos, "arctan": np.arctan,
    "sinh": np.sinh, "cosh": np.cosh, "tanh": np.tanh,
    "exp": np.exp, "log": np.log, "ln": np.log, "log10": np.log10,
    "sqrt": np.sqrt, "abs": np.abs,
}
CONSTANTES = {"pi": math.pi, "e": math.e}
OPERADORES = {
    ast.Add: np.add, ast.Sub: np.subtract, ast.Mult: np.multiply,
    ast.Div: np.divide, ast.Pow: np.power,
}
LONGITUD_MAXIMA = 200


def _evaluar(nodo: ast.AST, x: np.ndarray):
    if isinstance(nodo, ast.Expression):
        return _evaluar(nodo.body, x)
    if isinstance(nodo, ast.Constant) and isinstance(nodo.value, (int, float)) \
            and not isinstance(nodo.value, bool):
        return float(nodo.value)
    if isinstance(nodo, ast.Name):
        if nodo.id == "x":
            return x
        if nodo.id in CONSTANTES:
            return CONSTANTES[nodo.id]
        raise ValueError(f"Nombre no permitido: {nodo.id!r}. Use la variable x.")
    if isinstance(nodo, ast.BinOp) and type(nodo.op) in OPERADORES:
        return OPERADORES[type(nodo.op)](_evaluar(nodo.left, x), _evaluar(nodo.right, x))
    if isinstance(nodo, ast.UnaryOp) and isinstance(nodo.op, (ast.UAdd, ast.USub)):
        v = _evaluar(nodo.operand, x)
        return -v if isinstance(nodo.op, ast.USub) else v
    if isinstance(nodo, ast.Call) and isinstance(nodo.func, ast.Name) \
            and nodo.func.id in FUNCIONES and len(nodo.args) == 1 and not nodo.keywords:
        return FUNCIONES[nodo.func.id](_evaluar(nodo.args[0], x))
    raise ValueError("La expresión contiene elementos no permitidos.")


def crear_funcion(texto: str) -> Callable[[np.ndarray], np.ndarray]:
    """Devuelve f que recibe una matriz n×1 de puntos y devuelve n valores."""
    texto = texto.strip().replace("^", "**")
    if not texto:
        raise ValueError("Escriba una función de x.")
    if len(texto) > LONGITUD_MAXIMA:
        raise ValueError(f"La expresión no puede superar {LONGITUD_MAXIMA} caracteres.")
    try:
        arbol = ast.parse(texto, mode="eval")
    except SyntaxError as exc:
        raise ValueError("La expresión no es válida. Ejemplo: x**2 + sin(x)") from exc
    with np.errstate(all="ignore"):
        _evaluar(arbol, np.array([0.5]))  # valida la estructura antes de usarla

    def f(puntos: np.ndarray) -> np.ndarray:
        x = puntos[:, 0]
        with np.errstate(all="ignore"):
            y = _evaluar(arbol, x)
        return np.broadcast_to(np.asarray(y, dtype=float), x.shape).copy()

    return f
