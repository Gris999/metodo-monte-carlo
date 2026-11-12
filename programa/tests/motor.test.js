// Pruebas del motor de respaldo en JavaScript. Ejecutar con:  node tests/motor.test.js
global.window = {};
global.performance = global.performance || require("perf_hooks").performance;
require("../web/motor.js");
const M = window.Motor;
let ok = 0, fallas = 0;
const t = (cond, nombre) => { if (cond) ok++; else { fallas++; console.log("FALLA:", nombre); } };

for (const k of ["x2", "seno", "exp", "pi", "plano2d"]) {
  const q = M.estimar({ caso: k, n: 200000, semilla: 9 });
  t(Math.abs(q.resultado.estimacion - q.caso.exacto) < 5 * q.resultado.error_estandar, "estimación " + k);
}
// Mismos números que numpy.random.default_rng(2026).random(10) (valores de referencia de NumPy 2.5)
const ref = [0.17893481367543618, 0.6399131657151546, 0.4672684011434851, 0.37050052710804804, 0.3549173343096512];
const x = M.estimar({ caso: "x2", n: 10, semilla: 2026 }).pasos.map((p) => p.x[0]);
t(ref.every((v, i) => x[i] === v), "mismo generador que NumPy (semilla 2026)");
t(Math.abs(M.estimar({ caso: "x2", n: 10, semilla: 2026 }).resultado.estimacion - 0.29138543970687314) < 1e-12, "ejemplo de la monografía: 0,2914");
const a = M.estimar({ caso: "x2", n: 500, semilla: 1 }), b = M.estimar({ caso: "x2", n: 500, semilla: 1 });
t(a.resultado.estimacion === b.resultado.estimacion, "reproducible con la misma semilla");
t(M.compilar("-x^2")(3) === -9 && M.compilar("4/(1+x**2)")(1) === 2, "operadores y precedencia");
for (const mala of ["import os", "x.real", "y+1", "(x", "", "x".repeat(250)]) {
  let rechazada = false;
  try { M.compilar(mala); } catch (e) { rechazada = true; }
  t(rechazada, "rechaza " + JSON.stringify(mala.slice(0, 20)));
}
let r1 = false; try { M.estimar({ caso: "x2", n: 1, semilla: 0 }); } catch (e) { r1 = true; }
t(r1, "rechaza N = 1");
let r2 = false; try { M.estimar({ expresion: "log(x-2)", a: 0, b: 1, n: 100, semilla: 0 }); } catch (e) { r2 = true; }
t(r2, "rechaza valores no finitos");

const ex = M.experimentos({ caso: "x2", tamanios: [100, 1000], repeticiones: 10, semilla: 2026 });
t(ex.resumen.length === 2 && ex.cajas.length === 2 && ex.comparaciones === 10, "experimentos: estructura");
t(ex.resumen[1].rmse < ex.resumen[0].rmse, "experimentos: el RMSE baja con N");
t(ex.csv_completo.split("\n").length === 21, "experimentos: CSV con 20 filas");
let r3 = false; try { M.experimentos({ caso: "x2", tamanios: [1000000], repeticiones: 200, semilla: 0 }); } catch (e) { r3 = true; }
t(r3, "experimentos: límite de cálculo en el navegador");

console.log(`motor.js: ${ok} aprobadas, ${fallas} fallidas`);
process.exit(fallas ? 1 : 0);
