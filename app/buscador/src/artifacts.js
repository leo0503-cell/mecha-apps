import sanitizeHtml from "sanitize-html";
import { check } from "./errors.js";
const clean = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .replace(/^[. ]+/, "");
// Conserva la extensión aunque el nombre solo tenga caracteres no latinos.
export const safeName = (name) => {
  const raw = String(name || "")
      .split(/[\\/]/)
      .pop(),
    dot = raw.lastIndexOf("."),
    ext =
      dot > 0
        ? clean(raw.slice(dot + 1))
            .replace(/\./g, "")
            .slice(0, 10)
        : "",
    base = clean(dot > 0 ? raw.slice(0, dot) : raw).slice(0, 80) || "entrega";
  return ext ? `${base}.${ext}` : base;
};
export function cleanWebsite(html) {
  check(
    typeof html === "string" && html.length <= 300000,
    "La página supera el límite permitido.",
  );
  const cleaned = sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "html",
      "head",
      "body",
      "meta",
      "title",
      "style",
      "section",
      "article",
      "header",
      "footer",
      "main",
      "nav",
      "div",
      "span",
      "details",
      "summary",
      "button",
    ],
    allowedAttributes: {
      "*": ["class", "id", "style", "aria-label", "role"],
      a: ["href", "target", "rel"],
      meta: ["charset", "name", "content"],
    },
    allowedSchemes: ["https", "http", "mailto", "tel"],
    allowVulnerableTags: true,
    transformTags: {
      a: (_name, attrs) => ({
        tagName: "a",
        attribs: { ...attrs, rel: "noopener noreferrer", target: "_blank" },
      }),
    },
  });
  const policy =
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; script-src 'none'; form-action 'none'; base-uri 'none'";
  return `<!doctype html><html lang="es-MX"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${policy}"></head><body>${cleaned}</body></html>`;
}
