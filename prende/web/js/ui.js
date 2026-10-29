import { config } from "./config.js";
import { missing } from "./domain.js";
export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const paths = {
  inicio: '<path d="m3 10 9-7 9 7v10H7V10m2 10v-6h6v6"/>',
  radiografia: '<path d="M4 20V10m8 10V4m8 16v-7M2 20h20"/>',
  recetas:
    '<rect x="5" y="3" width="15" height="18" rx="2"/><path d="M3 7h4M3 12h4M3 17h4m4-9h5m-5 4h5m-5 4h3"/>',
  mesa: '<path d="M21 11a8 8 0 0 1-8 8H7l-5 3 2-6a8 8 0 1 1 17-5Z"/><path d="M8 10h8m-8 4h5"/>',
  ruta: '<path d="M5 20h11a4 4 0 0 0 0-8H8a4 4 0 0 1 0-8h11"/><circle cx="5" cy="20" r="2"/><path d="m16 1 4 3-4 3"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
export const link = (href, label, style = "secondary") =>
  `<a href="${esc(href)}" class="button ${style}">${esc(label)}${icon("arrow")}</a>`;
export function whatsapp(message) {
  return `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(message)}`;
}
export function fuse(done, large = false) {
  const points = Array.from({ length: 30 }, (_, i) => {
    const row = Math.floor(i / 10),
      col = i % 10;
    return [26 + (row % 2 ? 9 - col : col) * 49, 24 + row * 51];
  });
  const path = `M26 24H467C500 24 500 75 467 75H26C-7 75-7 126 26 126H467`;
  const front =
    points[
      Array.from({ length: 30 }, (_, i) => i + 1).findIndex(
        (d) => !done.includes(d),
      )
    ] || points[29];
  return `<svg class="fuse ${large ? "fuse-large" : ""}" viewBox="0 0 493 150" role="img" aria-label="${done.length} de 30 retos hechos"><path class="fuse-cord" d="${path}"/>${points.map(([x, y], i) => `<circle class="knot ${done.includes(i + 1) ? "lit" : ""}" cx="${x}" cy="${y}" r="5"/>`).join("")}<circle class="fuse-glow" cx="${front[0]}" cy="${front[1]}" r="12"/><circle class="fuse-front" cx="${front[0]}" cy="${front[1]}" r="5"/></svg>`;
}
export function highlightedPrompt(prompt, profile) {
  return prompt
    .split(/(\{\w+\}|«[^»]*»|\[[^\]]*\])/g)
    .map((part) => {
      const key = part.match(/^\{(\w+)\}$/)?.[1];
      if (key)
        return profile?.[key]
          ? `<mark class="profile-word">${esc(profile[key])}</mark>`
          : `<a class="pendiente" href="#/ajustes">[${esc(missing[key] || key)}]</a>`;
      if (part.startsWith("«"))
        return `<mark class="prompt-hole">${esc(part)}</mark>`;
      if (part.startsWith("["))
        return `<span class="pendiente">${esc(part)}</span>`;
      return esc(part);
    })
    .join("");
}
export function plainText(text) {
  return String(text ?? "")
    .split(/(\[[^\]]*\]|<[^<>]*>)/g)
    .map((t) =>
      t.startsWith("[") || t.startsWith("<")
        ? `<span class="pendiente">${esc(t)}</span>`
        : esc(t),
    )
    .join("");
}
let toastTimeout;
export function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => node.classList.remove("visible"), 4200);
}
export async function copy(text) {
  try {
    if (navigator.clipboard?.writeText)
      await navigator.clipboard.writeText(text);
    else {
      const area = document.createElement("textarea");
      area.value = text;
      area.className = "copy-fallback";
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) throw new Error("clipboard");
    }
    toast("Copiada");
    return true;
  } catch {
    toast(
      "No pudimos copiar. Selecciona el texto y cópialo desde tu navegador.",
    );
    return false;
  }
}
export function chatButtons() {
  return `<div class="actions"><button class="button primary" data-action="copy-prompt">Copiar receta</button><button class="button secondary" data-action="chat" data-chat="chatgpt">Abrir en ChatGPT</button><button class="button secondary" data-action="chat" data-chat="claude">Abrir en Claude</button></div>`;
}
export async function openChat(provider, prompt) {
  const base =
    provider === "claude" ? "https://claude.ai/new" : "https://chatgpt.com/";
  const encoded = encodeURIComponent(prompt);
  if (encoded.length <= 6000) {
    window.open(`${base}?q=${encoded}`, "_blank", "noopener,noreferrer");
    return;
  }
  const tab = window.open(base, "_blank");
  if (tab) tab.opener = null;
  const copied = await copy(prompt);
  if (copied) toast("Receta copiada. Pégala en el chat que abriste.");
}
