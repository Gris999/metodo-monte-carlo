from fastapi.testclient import TestClient

from servidor import app

cliente = TestClient(app)


def test_pagina_principal_y_casos():
    assert cliente.get("/").status_code == 200
    casos = cliente.get("/api/casos").json()
    assert [c["clave"] for c in casos] == ["x2", "seno", "exp", "pi", "plano2d"]


def test_estimar_caso_documentado_coincide_con_nucleo():
    from montecarlo import CASOS, estimar_integral

    d = cliente.post("/api/estimar", json={"caso": "x2", "n": 10000, "semilla": 2026}).json()
    assert d["resultado"]["estimacion"] == estimar_integral(CASOS["x2"], 10000, 2026).estimacion
    assert len(d["pasos"]) == 20 and d["curva"] and d["muestras"] and d["trapecio"]
    assert d["convergencia"][-1]["k"] == 10000


def test_estimar_funcion_propia_y_dos_dimensiones():
    d = cliente.post("/api/estimar", json={"expresion": "x^2", "a": 0, "b": 2, "n": 500}).json()
    assert d["resultado"]["error_absoluto"] is None
    d = cliente.post("/api/estimar", json={"caso": "plano2d", "n": 500}).json()
    assert d["curva"] is None and len(d["pasos"][0]["x"]) == 2


def test_estimar_rechaza_entradas_invalidas():
    for cuerpo in ({"caso": "x2", "n": 1}, {"caso": "nada"}, {"expresion": "import os", "a": 0, "b": 1},
                   {"expresion": "x", "a": 1, "b": 0}, {"expresion": "x"}):
        r = cliente.post("/api/estimar", json=cuerpo)
        assert r.status_code == 422, cuerpo


def test_experimentos():
    d = cliente.post("/api/experimentos", json={"caso": "x2", "tamanios": [100, 1000],
                                                "repeticiones": 5}).json()
    assert len(d["resumen"]) == 2 and len(d["cajas"]) == 2
    assert d["comparaciones"] == 5 and 0 <= d["peores"] <= 5
    assert d["csv_completo"].startswith("caso,n,repeticion,semilla")
    for cuerpo in ({"caso": "x2", "tamanios": [7]}, {"caso": "x2", "tamanios": []},
                   {"caso": "x2", "repeticiones": 0}):
        assert cliente.post("/api/experimentos", json=cuerpo).status_code == 422


def test_archivos_pwa():
    m = cliente.get("/manifest.webmanifest")
    assert m.status_code == 200 and m.headers["content-type"].startswith("application/manifest+json")
    assert m.json()["display"] == "standalone"
    for ruta in ("/sw.js", "/motor.js", "/icons/icon-192.png", "/icons/icon-512.png"):
        assert cliente.get(ruta).status_code == 200, ruta
