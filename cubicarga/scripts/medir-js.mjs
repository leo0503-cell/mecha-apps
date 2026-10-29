import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
function medir(raiz) {
  const archivos = [];
  function recorrer(dir) {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) recorrer(p);
      else if (f.name.endsWith(".js")) archivos.push(p);
    }
  }
  recorrer(path.join(raiz, ".next/static"));
  const gzip = (p) => gzipSync(fs.readFileSync(p), { level: 9 }).length;
  const html = fs.readFileSync(
    path.join(raiz, ".next/server/app/index.html"),
    "utf8",
  );
  const scripts = [
    ...new Set(
      [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
        .map((m) => m[1])
        .filter((p) => p.startsWith("/_next/static/")),
    ),
  ];
  return {
    todosBytesGzip: archivos.reduce((s, p) => s + gzip(p), 0),
    landingBytesGzip: scripts.reduce(
      (s, p) => s + gzip(path.join(raiz, ".next", p.slice("/_next/".length))),
      0,
    ),
    archivos: archivos.length,
    scriptsLanding: scripts.length,
  };
}
const antes = medir(process.env.BASELINE_DIR);
const despues = medir(process.cwd());
const reporte = {
  metodo:
    "gzip nivel 9 por archivo; fuente main y actual con Node 24, Bun 1.3.14 y sus respectivos lockfiles congelados",
  antes,
  despues,
  deltaTodosBytes: despues.todosBytesGzip - antes.todosBytesGzip,
  deltaLandingBytes: despues.landingBytesGzip - antes.landingBytesGzip,
  justificacion:
    "ExcelJS, QR y efectos se cargan a demanda; el presupuesto total incluye herramientas que no existían en baseline. La landing difiere los proveedores y el visor.",
};
fs.writeFileSync("docs/presupuesto-js.json", JSON.stringify(reporte, null, 2));
console.log(reporte);
