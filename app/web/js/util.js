// Utilidades compartidas. Todo lo que viene de datos/ se escapa: el radar trae
// texto sacado de la web y no se confía en él.

const ZONA = "America/Mexico_City";

export function esc(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Solo deja pasar ligas http(s). Cualquier otra cosa (javascript:, data:) se descarta. */
export function urlSegura(url) {
  try {
    const u = new URL(String(url));
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

export function dominio(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** "2026-10-01" → Date a mediodía local, para que el día no se corra por zona horaria. */
export function fechaISO(iso) {
  const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(a, m - 1, d, 12);
}

export function hoyISO() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
  return partes; // en-CA ya da AAAA-MM-DD
}

const fmt = (opciones) => new Intl.DateTimeFormat("es-MX", opciones);
const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export const fechaLarga = (iso) =>
  capital(fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(fechaISO(iso)));
export const fechaMedia = (iso) =>
  capital(fmt({ weekday: "long", day: "numeric", month: "long" }).format(fechaISO(iso)));
export const fechaCorta = (iso) => fmt({ day: "numeric", month: "short" }).format(fechaISO(iso)).replace(".", "");
export const diaNum = (iso) => fechaISO(iso).getDate();
export const mesCorto = (iso) => fmt({ month: "short" }).format(fechaISO(iso)).replace(".", "");

export function diasEntre(desdeISO, hastaISO) {
  return Math.round((fechaISO(hastaISO) - fechaISO(desdeISO)) / 86400000);
}

export function faltan(dias) {
  if (dias < 0) return "ya pasó";
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  if (dias < 14) return `en ${dias} días`;
  const semanas = Math.round(dias / 7);
  return `en ${semanas} semanas`;
}

export function horaCorta(isoFechaHora) {
  return fmt({ hour: "numeric", minute: "2-digit", timeZone: ZONA }).format(new Date(isoFechaHora));
}

/** Día de un instante (con hora) en Ciudad de México, no el día UTC del texto. */
export function diaDeInstante(isoFechaHora) {
  return fmt({ day: "numeric", month: "short", timeZone: ZONA }).format(new Date(isoFechaHora)).replace(".", "");
}

/** Un número entre <corchetes> es un pendiente, no un dato. */
export function esPendiente(valor) {
  return typeof valor === "string" && /^<.*>$/.test(valor.trim());
}

export function ligaWhatsApp(numero, texto) {
  if (!numero || esPendiente(numero)) return null;
  const limpio = String(numero).replace(/\D/g, "");
  return `https://wa.me/${limpio}?text=${encodeURIComponent(texto)}`;
}

export const guardar = {
  leer(clave, porDefecto = null) {
    try {
      const v = localStorage.getItem(clave);
      return v === null ? porDefecto : JSON.parse(v);
    } catch {
      return porDefecto;
    }
  },
  escribir(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
      /* modo privado o almacenamiento bloqueado: la app sigue funcionando */
    }
  },
};

let temporizador;
export function avisar(texto) {
  const el = document.getElementById("aviso");
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(temporizador);
  temporizador = setTimeout(() => (el.hidden = true), 2600);
}

export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    avisar("Texto copiado");
  } catch {
    avisar("No se pudo copiar; mantén presionado el texto para copiarlo");
  }
}

export function iniciales(nombre) {
  const limpio = String(nombre).replace(/[<>]/g, "").trim();
  const partes = limpio.split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase() || "·";
}

/** Fuentes de una nota → HTML con ligas seguras. */
export function htmlFuentes(fuentes = []) {
  const items = fuentes
    .map((f) => ({ url: urlSegura(f.url), titulo: f.titulo }))
    .filter((f) => f.url)
    .map(
      (f) =>
        `<a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer" title="${esc(f.titulo || f.url)}">${esc(dominio(f.url))}</a>`,
    );
  return items.length ? `<div class="fuentes"><span>Fuente:</span>${items.join("")}</div>` : "";
}
