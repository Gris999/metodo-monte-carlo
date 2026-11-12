# Integración numérica por el método de Monte Carlo

Programa en Python que estima integrales definidas con el método de Monte Carlo
(estimador del valor medio), calcula errores, error estándar e intervalos de
confianza aproximados, y ejecuta experimentos repetidos con semillas registradas.

La elección de las herramientas es una decisión del grupo, no un requisito del docente.

## Estructura

```
programa/
├── servidor.py                # API web (FastAPI) + sirve la interfaz
├── web/                       # interfaz: HTML, CSS y JavaScript sin dependencias
│   ├── index.html
│   ├── styles.css
│   ├── charts.js              # gráficas SVG propias
│   ├── motor.js               # motor de respaldo sin conexión (JavaScript)
│   ├── app.js                 # lógica de la interfaz
│   ├── sw.js                  # service worker (PWA)
│   ├── manifest.webmanifest   # manifiesto de la PWA
│   └── icons/
├── ejecutar_experimentos.py   # genera los CSV y figuras de la monografía
├── montecarlo/
│   ├── casos.py               # casos de prueba con valor exacto
│   ├── nucleo.py              # estimador, errores, convergencia, trapecio
│   ├── expresiones.py         # lectura segura de funciones propias
│   └── experimentos.py        # repeticiones y resumen estadístico
├── tests/                     # pruebas automáticas (pytest)
├── resultados/                # salidas generadas
└── requirements.txt
```

## Instalación

Requiere Python 3.10 o superior.

```bash
python3 -m venv .venv
source .venv/bin/activate        # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Ejecución

```bash
python servidor.py                   # interfaz en http://localhost:8000
python ejecutar_experimentos.py      # experimentos: 5 casos × 4 tamaños × 30 repeticiones
pytest                               # pruebas automáticas (Python)
node tests/motor.test.js             # pruebas del motor en JavaScript (requiere Node.js)
```

No necesita internet: la interfaz no usa bibliotecas externas.

### Celular y PWA

- La interfaz es adaptable: en el celular aparece una barra inferior de navegación.
- Es una PWA: se puede instalar (botón **Instalar app** en Chrome/Edge, o en iPhone
  *Compartir → Agregar a inicio*). La instalación requiere `localhost` o `https`.
- Para abrirla desde un celular en la misma red wifi:

```bash
python servidor.py --red
```

  y en el celular, `http://<IP de la computadora>:8000`.
- Sin conexión con el servidor, la calculadora y los experimentos usan `motor.js`: el mismo
  estimador y el mismo generador que NumPy (`default_rng`: SeedSequence + PCG64), así que con
  la misma semilla da los mismos números que Python (solo pueden variar los últimos decimales
  de una suma, por el orden en que se suma).

### Versión publicada

- App: https://gris999.github.io/metodo-monte-carlo/
- Código de la interfaz publicada: https://github.com/Gris999/metodo-monte-carlo
- En la versión publicada todos los cálculos se hacen con `motor.js` (GitHub Pages no
  ejecuta Python). Para actualizarla, copiar `web/` al repositorio publicado y subir los cambios.

## Manual de uso

La interfaz tiene cinco páginas (menú superior): Inicio, Demo, Calculadora, Experimentos y Teoría.

1. **Inicio**: presentación, analogía, pasos del método, objetivo y aplicaciones.
2. **Demo**: lanzá dardos (1, +100, +1.000, +10.000) para estimar π (acierto y fallo).
3. **Calculadora** (espacio de trabajo): elegí un ejemplo o escribí f(x) (ej. `x^2 + sin(x)`,
   o con el teclado de funciones) y sus límites. Mové el deslizador de N (10 a 1.000.000) y
   elegí la semilla: el resultado se recalcula solo. Gráfica Área/Convergencia, solución paso
   a paso en tarjetas, primeros 20 puntos e historial para comparar cálculos.
4. **Experimentos**: usa la última función calculada; repeticiones (1 a 200) con
   semillas consecutivas, diagramas de caja, error vs N en log-log y descarga en CSV.
5. **Teoría**: fórmulas del método.
6. La misma función, N y semilla producen siempre el mismo resultado con las mismas
   versiones de las bibliotecas.
7. Las funciones propias no se ejecutan con `eval()`: se analizan con `ast` y solo se
   aceptan números, `x`, operadores y funciones matemáticas permitidas.

## API

- `GET /api/casos` — casos documentados.
- `POST /api/estimar` — `{caso | expresion, a, b, exacto, n, semilla}`.
- `POST /api/experimentos` — `{caso | expresion, a, b, exacto, tamanios, repeticiones, semilla}`.

## Columnas de los CSV

| Columna | Significado |
|---|---|
| `estimacion` | Î_N |
| `error_absoluto` | \|Î_N − I\| |
| `error_relativo` | \|Î_N − I\| / \|I\| (vacío si I = 0) |
| `error_estandar` | V·s/√N, con s la desviación estándar muestral de f(Xᵢ) |
| `ic_inferior`, `ic_superior` | Î_N ∓ 1,96·error estándar |
| `ic_contiene_exacto` | si el intervalo contiene el valor exacto |
| `tiempo_s` | tiempo de una estimación (s), medido con `time.perf_counter` |
| `rmse` (resumen) | raíz del error cuadrático medio de las repeticiones |
| `cobertura_ic95` (resumen) | proporción de intervalos que contienen el valor exacto |
