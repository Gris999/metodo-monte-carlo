import math

import numpy as np
import pytest

from montecarlo import CASOS, convergencia, estimar_integral, obtener_caso, regla_trapecio
from montecarlo.experimentos import ejecutar_experimento, resumir


@pytest.mark.parametrize("clave", list(CASOS))
def test_estimacion_dentro_de_5_errores_estandar(clave):
    caso = CASOS[clave]
    r = estimar_integral(caso, 200_000, 123)
    assert abs(r.estimacion - caso.valor_exacto) < 5 * r.error_estandar


def test_reproducibilidad_con_misma_semilla():
    c = CASOS["x2"]
    assert estimar_integral(c, 1000, 7) == estimar_integral(c, 1000, 7)


def test_semillas_distintas_dan_estimaciones_distintas():
    c = CASOS["x2"]
    assert estimar_integral(c, 1000, 1).estimacion != estimar_integral(c, 1000, 2).estimacion


def test_calculo_manual_del_estimador():
    c = CASOS["x2"]
    rng = np.random.default_rng(5)
    x = rng.random(50)
    esperado = 1.0 * np.mean(x**2)
    ee = np.std(x**2, ddof=1) / math.sqrt(50)
    r = estimar_integral(c, 50, 5)
    assert r.estimacion == pytest.approx(esperado)
    assert r.error_estandar == pytest.approx(ee)
    assert r.ic_superior - r.ic_inferior == pytest.approx(2 * 1.959963984540054 * ee)


def test_funcion_constante_tiene_error_estandar_cero():
    from montecarlo.casos import CasoPrueba

    c = CasoPrueba("k", "constante", "∫ 3", lambda x: np.full(len(x), 3.0), [(1.0, 3.0)], 6.0, "")
    r = estimar_integral(c, 100, 0)
    assert r.estimacion == pytest.approx(6.0)
    assert r.error_estandar == pytest.approx(0.0)


@pytest.mark.parametrize("n", [0, 1, -5, 10**9])
def test_rechaza_n_fuera_de_rango(n):
    with pytest.raises(ValueError):
        estimar_integral(CASOS["x2"], n, 0)


@pytest.mark.parametrize("n", [10.5, "100", True])
def test_rechaza_n_no_entero(n):
    with pytest.raises(TypeError):
        estimar_integral(CASOS["x2"], n, 0)


def test_rechaza_semilla_negativa():
    with pytest.raises(ValueError):
        estimar_integral(CASOS["x2"], 100, -1)


def test_caso_desconocido():
    with pytest.raises(ValueError):
        obtener_caso("no_existe")


def test_convergencia_ultimo_valor_igual_a_estimacion():
    c = CASOS["seno"]
    k, est = convergencia(c, 5000, 9)
    assert len(k) == 5000
    assert est[-1] == pytest.approx(estimar_integral(c, 5000, 9).estimacion)


def test_trapecio_exacto_para_lineal_y_preciso_para_x2():
    c = CASOS["x2"]
    assert regla_trapecio(c, 1001) == pytest.approx(1 / 3, abs=1e-6)
    with pytest.raises(ValueError):
        regla_trapecio(CASOS["plano2d"], 10)


def test_experimento_y_resumen():
    df = ejecutar_experimento(CASOS["x2"], [100, 1000], repeticiones=5, semilla_base=10)
    assert len(df) == 10
    assert list(df[df.n == 100].semilla) == [10, 11, 12, 13, 14]
    res = resumir(df)
    assert set(res.n) == {100, 1000}
    assert (res.repeticiones == 5).all()
    with pytest.raises(ValueError):
        ejecutar_experimento(CASOS["x2"], [100], repeticiones=0)


# ---------------------------------------------------------------- funciones propias
from montecarlo import caso_personalizado, convergencia_con_banda  # noqa: E402
from montecarlo.expresiones import crear_funcion  # noqa: E402


def test_funcion_propia_coincide_con_caso_documentado():
    c = caso_personalizado("x^2", 0, 1, 1 / 3)
    assert estimar_integral(c, 1000, 3).estimacion == estimar_integral(CASOS["x2"], 1000, 3).estimacion


def test_funcion_propia_con_funciones_y_constantes():
    f = crear_funcion("sin(x) + exp(0*x) * pi - sqrt(4)")
    x = np.array([[0.0], [math.pi / 2]])
    assert f(x) == pytest.approx([math.pi - 2, 1 + math.pi - 2])


def test_funcion_constante_propia_se_expande():
    assert crear_funcion("3")(np.zeros((5, 1))).shape == (5,)


def test_funcion_propia_sin_valor_exacto():
    r = estimar_integral(caso_personalizado("x", 0, 2), 500, 1)
    assert r.error_absoluto is None and r.error_relativo is None and r.ic_contiene_exacto is None
    assert abs(r.estimacion - 2) < 5 * r.error_estandar


@pytest.mark.parametrize("texto", ["__import__('os')", "x.real", "open('a')", "y + 1", "", "x +",
                                   "[x]", "lambda: 1", "x" * 300])
def test_rechaza_expresiones_no_permitidas(texto):
    with pytest.raises(ValueError):
        crear_funcion(texto)


@pytest.mark.parametrize("a,b", [(1, 1), (2, 1), (0, float("inf"))])
def test_rechaza_limites_invalidos(a, b):
    with pytest.raises(ValueError):
        caso_personalizado("x", a, b)


def test_funcion_con_valores_no_finitos_se_rechaza():
    with pytest.raises(ArithmeticError):
        estimar_integral(caso_personalizado("log(x - 2)", 0, 1), 100, 0)


def test_banda_de_convergencia_coincide_con_error_estandar():
    k, est, ee = convergencia_con_banda(CASOS["exp"], 2000, 4)
    r = estimar_integral(CASOS["exp"], 2000, 4)
    assert est[-1] == pytest.approx(r.estimacion)
    assert ee[-1] == pytest.approx(r.error_estandar)
