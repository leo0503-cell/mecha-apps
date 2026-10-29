// Orden importa: primero el servidor simulado, después la app real.
import { demo, artifactHtml } from "./mock.js";
import "../public/.demo-app.js";

const $ = (s) => document.querySelector(s);
function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 3200);
}
function show(role) {
  const app = window.__mechaDemo;
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  app.resetState();
  app.state.adminJob = null;
  demo.setRole(role);
  document
    .querySelectorAll("[data-role]")
    .forEach((b) => b.setAttribute("aria-pressed", b.dataset.role === role));
  app.boot();
}
document.querySelectorAll("[data-role]").forEach(
  (b) => (b.onclick = () => show(b.dataset.role)),
);
$("#demo-reset").onclick = () => {
  demo.reset();
  show("client");
  toast("La demo volvió a su estado inicial.");
};
// Descargas: en la demo no hay archivos reales.
document.addEventListener(
  "click",
  (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const href = a.getAttribute("href");
    if (href.startsWith("/api/")) {
      e.preventDefault();
      toast("En la app real aquí se descarga el archivo.");
    } else if (href === "/" || href.startsWith("/?")) {
      e.preventDefault();
    }
  },
  true,
);
// Vista previa de páginas HTML entregadas.
new MutationObserver(() => {
  const frame = $("#preview-dialog iframe");
  const src = frame?.getAttribute("src");
  const m = src?.match(/\/api\/artifacts\/([^/]+)\/preview/);
  if (!m) return;
  frame.removeAttribute("src");
  frame.srcdoc = artifactHtml(decodeURIComponent(m[1]));
}).observe(document.body, {
  subtree: true,
  attributes: true,
  attributeFilter: ["src"],
});
