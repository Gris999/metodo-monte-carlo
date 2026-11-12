# Método de Monte Carlo · Integración numérica

Aplicación web del proyecto de **Métodos Numéricos** (Facultad de Ingeniería en Ciencias de la
Computación y Telecomunicaciones, UAGRM): estima integrales definidas con el método de
Monte Carlo, muestra la solución paso a paso, el error estándar, el intervalo de confianza
y experimentos repetidos.

**Abrir la app:** https://gris999.github.io/metodo-monte-carlo/

Funciona en computadora y teléfono, y se puede instalar como aplicación web progresiva (PWA).

En esta versión publicada los cálculos se hacen en el navegador con un motor en JavaScript
que reproduce el generador de NumPy (`default_rng`: SeedSequence + PCG64). Con la misma
semilla da los mismos números que el núcleo en Python con el que se obtuvieron los resultados
de la monografía (`python servidor.py`).

## Código fuente del programa

El programa completo está en la carpeta [`programa/`](programa/):

| Archivo | Qué hace |
|---|---|
| [`programa/montecarlo/nucleo.py`](programa/montecarlo/nucleo.py) | El método: puntos al azar, estimación, error estándar e intervalo de confianza |
| [`programa/montecarlo/casos.py`](programa/montecarlo/casos.py) | Las 5 integrales de prueba con su valor exacto |
| [`programa/montecarlo/expresiones.py`](programa/montecarlo/expresiones.py) | Lee de forma segura la función que escribe el usuario |
| [`programa/montecarlo/experimentos.py`](programa/montecarlo/experimentos.py) | Los experimentos repetidos (600 estimaciones) |
| [`programa/servidor.py`](programa/servidor.py) | Servidor FastAPI que publica los cálculos |
| [`programa/web/`](programa/web/) | La interfaz web (la misma que está publicada) |
| [`programa/tests/`](programa/tests/) | Pruebas automáticas |

Para ejecutarlo en la computadora:

```bash
cd programa
pip install -r requirements.txt
python servidor.py        # abre http://localhost:8000
python -m pytest          # corre las pruebas
```
