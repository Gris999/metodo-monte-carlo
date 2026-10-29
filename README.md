# Método de Monte Carlo · Integración numérica

Aplicación web del proyecto de **Métodos Numéricos** (Facultad de Ingeniería en Ciencias de la
Computación y Telecomunicaciones, UAGRM): estima integrales definidas con el método de
Monte Carlo, muestra la solución paso a paso, el error estándar, el intervalo de confianza
y experimentos repetidos.

**Abrir la app:** https://gris999.github.io/metodo-monte-carlo/

Funciona en computadora y teléfono, y se puede instalar como aplicación web progresiva (PWA).

En esta versión publicada los cálculos se hacen en el navegador con un motor en JavaScript
(generador pseudoaleatorio mulberry32). Los resultados de la monografía se obtuvieron con el
núcleo en Python (NumPy, PCG64), que se ejecuta localmente con `python servidor.py`; por eso
los números pueden diferir levemente para una misma semilla.
