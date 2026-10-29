// App Mecha: navegación, hoja inferior, perfil, instalación y modo sin conexión.

import { cargar, clienteActual, olvidarDatos } from "./datos.js";
import { esc, fechaMedia, hoyISO, guardar, avisar } from "./util.js";
import { vistaRadar } from "./vistas/radar.js";
import { vistaChats } from "./vistas/chats.js";
import { vistaContenido } from "./vistas/contenido.js";
import { vistaWeb } from "./vistas/web.js";
import { vistaHoy } from "./vistas/hoy.js";
import { requiereRespuesta } from "./respuestas.js";

const VISTAS = {
  hoy: vistaHoy,
  radar: vistaRadar,
  chats: vistaChats,
  contenido: vistaContenido,
  web: vistaWeb,
};
const TITULOS = {
  hoy: "Hoy",
  radar: "Radar",
  chats: "Chats",
  contenido: "Contenido",
  web: "Web",
};
const vista = document.getElementById("vista");

/* ---------- Hoja inferior ---------- */
const hoja = document.getElementById("hoja");
const cuerpoHoja = hoja.querySelector(".hoja__cuerpo");

export function abrirHoja(html, alMontar) {
  cuerpoHoja.innerHTML = html;
  if (!hoja.open) hoja.showModal();
  alMontar?.(cuerpoHoja);
}
export function cerrarHoja() {
  if (hoja.open) hoja.close();
}
hoja.addEventListener("click", (e) => {
  if (e.target === hoja || e.target.closest("[data-cerrar]")) cerrarHoja();
});

/* ---------- Navegación ---------- */
function leerRuta() {
  const [nombre, parametro] = location.hash.replace(/^#\/?/, "").split("/");
  let id;
  try {
    id = parametro ? decodeURIComponent(parametro) : undefined;
  } catch {
    /* Ruta inválida: muestra la sección. */
  }
  return Object.hasOwn(VISTAS, nombre)
    ? { nombre, parametro: id }
    : { nombre: "hoy" };
}

let turno = 0;
async function pintar() {
  const { nombre, parametro } = leerRuta();
  const mio = ++turno;
  document.querySelectorAll("[data-pestana]").forEach((a) => {
    if (a.dataset.pestana === nombre) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = `${TITULOS[nombre]} · Mecha`;
  cerrarHoja();
  vista.setAttribute("aria-busy", "true");
  vista.innerHTML = `<div class="cargando"><span class="cargando__pulso" aria-hidden="true"></span> Cargando ${TITULOS[nombre].toLowerCase()}…</div>`;
  try {
    const temp = document.createElement("div");
    await VISTAS[nombre](temp, { fecha: parametro, id: parametro });
    if (mio !== turno) return; // el usuario ya cambió de pestaña
    vista.replaceChildren(...temp.childNodes);
    if (parametro && nombre === "contenido") {
      const pieza = Array.from(vista.querySelectorAll("[data-pieza]")).find(
        (p) => p.dataset.pieza === parametro,
      );
      pieza?.scrollIntoView({ block: "center" });
      pieza?.focus({ preventScroll: true });
    } else window.scrollTo({ top: 0 });
  } catch (err) {
    if (mio !== turno) return;
    console.error(err);
    vista.innerHTML = `<div class="vacio"><p>No pudimos cargar esta sección.</p><p class="tenue">${
      navigator.onLine
        ? esc(err.message)
        : "Estás sin conexión y todavía no se había guardado en este teléfono."
    }</p><button class="boton boton--borde" type="button" data-reintentar>Volver a intentar</button></div>`;
    vista.querySelector("[data-reintentar]").addEventListener("click", () => {
      olvidarDatos();
      pintar();
    });
  }
  if (mio === turno) vista.removeAttribute("aria-busy");
}

window.addEventListener("hashchange", () => {
  if (location.hash.startsWith("#/") || !location.hash) pintar();
});

// Al volver a la app (estaba en segundo plano), se recargan los datos por si ya salió la edición del día.
let oculto = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) oculto = Date.now();
  else if (oculto && Date.now() - oculto > 60_000) {
    olvidarDatos();
    actualizarContadores();
    pintar();
  }
});

document.querySelector(".saltar").addEventListener("click", (e) => {
  e.preventDefault();
  vista.focus();
});

/* ---------- Encabezado y perfil ---------- */
async function encabezado() {
  document.getElementById("fecha-hoy").textContent = fechaMedia(hoyISO());
  try {
    const negocio = await cargar("negocio.json");
    document.getElementById("nombre-negocio").textContent = negocio.nombre;
  } catch {
    /* sin datos todavía: se queda "Mecha" */
  }
  const demo = clienteActual() === "demo";
  document.getElementById("modo-demo").hidden = !demo;
  document.getElementById("demo-etiqueta").hidden = !demo;
}

async function actualizarContadores() {
  const resultados = await Promise.allSettled([
    cargar("chats.json"),
    cargar("contenido.json"),
  ]);
  const cantidades = resultados.map((r, i) =>
    r.status !== "fulfilled"
      ? 0
      : i === 0
        ? r.value.conectado
          ? (r.value.te_toca?.length ?? 0)
          : 0
        : (r.value.piezas ?? []).filter((p) => requiereRespuesta(p)).length,
  );
  ["chats", "contenido"].forEach((nombre, i) => {
    const el = document.querySelector(`[data-contador="${nombre}"]`);
    el.textContent = cantidades[i];
    el.hidden = !cantidades[i];
    el.setAttribute("aria-label", `${cantidades[i]} pendientes`);
  });
}
window.addEventListener("mecha:respuestas", actualizarContadores);

document
  .querySelector('[data-accion="actualizar"]')
  .addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    olvidarDatos();
    await Promise.all([pintar(), encabezado(), actualizarContadores()]);
    btn.disabled = false;
    avisar(
      navigator.onLine
        ? "Vista actualizada"
        : "Sin conexión: consulta la copia guardada",
    );
  });

function botonesTema() {
  const actual = guardar.leer("mecha-tema-modo", "sistema");
  return [
    ["sistema", "Sistema"],
    ["light", "Claro"],
    ["dark", "Oscuro"],
  ]
    .map(
      ([v, t]) =>
        `<button type="button" data-tema="${v}" aria-pressed="${actual === v}">${t}</button>`,
    )
    .join("");
}

function aplicarTema(modo) {
  guardar.escribir("mecha-tema-modo", modo);
  try {
    if (modo === "sistema") {
      localStorage.removeItem("mecha-tema");
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem("mecha-tema", modo);
      document.documentElement.dataset.theme = modo;
    }
  } catch {
    if (modo === "sistema") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = modo;
  }
}

async function abrirPerfil() {
  let negocio = {};
  try {
    negocio = await cargar("negocio.json");
  } catch {
    /* se muestra lo que haya */
  }
  const r = negocio.radar ?? {};
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  abrirHoja(
    `<div class="hoja__cabeza"><h2 id="hoja-titulo">${esc(negocio.nombre ?? "Tu negocio")}</h2><button class="cerrar" data-cerrar aria-label="Cerrar">×</button></div>
     <dl>
       <div><dt>Giro</dt><dd>${esc(negocio.giro ?? "—")}</dd></div>
       <div><dt>Ciudad</dt><dd>${esc(negocio.ciudad ?? "—")}</dd></div>
       <div><dt>Paquete</dt><dd>${esc(negocio.paquete ?? "—")}</dd></div>
       <div><dt>Lo que vigila tu radar</dt><dd>${
         (r.competidores ?? []).map((c) => esc(c.nombre)).join(", ") || "—"
       }</dd></div>
       <div><dt>Temas</dt><dd>${(r.temas ?? []).map(esc).join(" · ") || "—"}</dd></div>
       <div><dt>Edición nueva</dt><dd>Todos los días, ${esc(r.hora ?? "temprano")}</dd></div>
     </dl>
     <div>
       <p class="eyebrow etiqueta">Tema</p>
       <div class="segmentado" role="group" aria-label="Tema de color">${botonesTema()}</div>
     </div>
     <div>
       <p class="eyebrow etiqueta">Instalar en tu celular</p>
       ${
         esIOS
           ? `<ol><li>Abre esta página en Safari.</li><li>Toca el botón Compartir.</li><li>Elige «Agregar a pantalla de inicio».</li></ol>`
           : `<ol><li>Abre esta página en Chrome.</li><li>Toca el menú ⋮.</li><li>Elige «Instalar app» o «Agregar a pantalla principal».</li></ol>`
       }
     </div>
     <p class="tenue chico">Cliente: ${esc(clienteActual())}</p>`,
    (h) =>
      h.querySelectorAll("[data-tema]").forEach((b) =>
        b.addEventListener("click", () => {
          aplicarTema(b.dataset.tema);
          h.querySelectorAll("[data-tema]").forEach((x) =>
            x.setAttribute("aria-pressed", x === b),
          );
        }),
      ),
  );
}
document
  .querySelector('[data-accion="perfil"]')
  .addEventListener("click", abrirPerfil);

/* ---------- Instalación (Android / escritorio) ---------- */
let invitacion;
const btnInstalar = document.querySelector('[data-accion="instalar"]');
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  invitacion = e;
  btnInstalar.hidden = false;
});
btnInstalar.addEventListener("click", async () => {
  if (!invitacion) return;
  invitacion.prompt();
  await invitacion.userChoice;
  invitacion = null;
  btnInstalar.hidden = true;
});
window.addEventListener("appinstalled", () =>
  avisar("Listo: Mecha quedó en tu pantalla de inicio"),
);

/* ---------- Sin conexión ---------- */
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {
    /* sin service worker la app funciona igual, solo no guarda copia */
  });
}
function estadoConexion() {
  document.getElementById("conexion").hidden = navigator.onLine;
}
window.addEventListener("offline", estadoConexion);
window.addEventListener("online", () => {
  estadoConexion();
  olvidarDatos();
  actualizarContadores();
  pintar();
});

estadoConexion();
encabezado();
actualizarContadores();
pintar();
