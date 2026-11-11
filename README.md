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
