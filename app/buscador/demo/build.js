// Genera demo/dist/mecha-demo.html: la app real con un servidor simulado.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, ".."),
  pub = (p) => resolve(root, "public", p);
const source = readFileSync(pub("app.js"), "utf8");
const patched = source
  .replace(
    "const money = (cents) =>",
    'const money = (cents) =>\n  cents == null ? "&lt;monto por confirmar&gt;" :',
  )
  .replace(/\nboot\(\);\s*$/, "\nwindow.__mechaDemo = { boot, resetState, state };\nboot();\n");
if (patched === source || !patched.includes("__mechaDemo"))
  throw new Error("No se pudo preparar app.js para la demo.");
writeFileSync(pub(".demo-app.js"), patched);
let bundle;
try {
  const out = await Bun.build({
    entrypoints: [resolve(import.meta.dir, "entry.js")],
    minify: true,
  });
  if (!out.success) throw new AggregateError(out.logs, "Falló el build");
  bundle = await out.outputs[0].text();
} finally {
  rmSync(pub(".demo-app.js"), { force: true });
}
const b64 = (p) => readFileSync(pub(p)).toString("base64");
// La app está diseñada en claro: se quita el bloque oscuro de los tokens.
const tokens = readFileSync(pub("assets/tokens.css"), "utf8").replace(
  /@media \(prefers-color-scheme: dark\)[\s\S]*$/,
  "",
);
const css = readFileSync(pub("style.css"), "utf8")
  .replace(
    'url("/assets/Archivo-VF.woff2")',
    `url(data:font/woff2;base64,${b64("assets/Archivo-VF.woff2")})`,
  )
  .replace(
    'url("/assets/DMSans-VF.woff2")',
    `url(data:font/woff2;base64,${b64("assets/DMSans-VF.woff2")})`,
  );
const demoCss = readFileSync(resolve(import.meta.dir, "demo.css"), "utf8");
const html = readFileSync(pub("index.html"), "utf8");
const body = html
  .slice(html.indexOf("<body>") + 6, html.indexOf("</body>"))
  .replace('href="/" class="brand"', 'href="#" class="brand"')
  .replace(
    /src="\/assets\/logo\.webp[^"]*"/,
    `src="data:image/webp;base64,${b64("assets/logo.webp")}"`,
  );
const bar = readFileSync(resolve(import.meta.dir, "bar.html"), "utf8");
const page = `<title>Mecha · Demo</title>
<style>${tokens}
${css}
${demoCss}</style>
${bar}
${body}
<script type="module">${bundle.replace(/<\/script/gi, "<\\/script")}</script>
`;
mkdirSync(resolve(import.meta.dir, "dist"), { recursive: true });
writeFileSync(resolve(import.meta.dir, "dist/mecha-demo.html"), page);
console.log(`demo/dist/mecha-demo.html · ${(page.length / 1024).toFixed(0)} KB`);
