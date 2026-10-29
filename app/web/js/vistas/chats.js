// Conversaciones: datos conectados y ejemplos claramente separados.
import { cargar } from "../datos.js";
import {
  esc,
  horaCorta,
  diaDeInstante,
  iniciales,
  ligaWhatsApp,
} from "../util.js";
import { abrirHoja } from "../app.js";

const KPIS = [
  ["conversaciones", "Conversaciones"],
  ["contestadas_asistente", "Contestadas por el asistente"],
  ["primera_respuesta", "Primera respuesta (promedio)"],
  ["cotizaciones", "Cotizaciones enviadas"],
  ["citas", "Citas agendadas"],
  ["te_tocaron", "Pasadas a ti"],
];
const normalizar = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export async function vistaChats(cont) {
  const [negocio, chats] = await Promise.all([
    cargar("negocio.json"),
    cargar("chats.json"),
  ]);
  const m = chats.conectado ? (chats.metricas ?? {}) : {};
  const pedir = ligaWhatsApp(
    negocio.contacto_mecha?.whatsapp,
    `Hola Mecha, quiero conectar el asistente al WhatsApp de ${negocio.nombre}.`,
  );
  const pendientes = chats.conectado ? (chats.te_toca ?? []) : [];
  const recientes = chats.conectado ? (chats.recientes ?? []) : [];
  const ejemplo = chats.conectado ? [] : (chats.ejemplo ?? []);
  const todos = [...pendientes, ...recientes, ...ejemplo];

  cont.innerHTML = `<div class="vista-chats">
    <div class="semana"><div><span class="eyebrow">Atención y seguimiento · WhatsApp</span><h1>Que ninguna conversación se pierda<span class="punto">.</span></h1></div><span class="chip chip--punto ${chats.conectado ? "chip--ok" : "chip--azufre"}">${chats.conectado ? "Asistente conectado" : "Por conectar"}</span></div>
    ${!chats.conectado ? `<section class="aviso-conexion"><span class="eyebrow">El siguiente paso</span><h2>Tu asistente todavía no está conectado.</h2><p>Cuando esté listo, aquí verás las conversaciones, cotizaciones, citas y los casos donde te toca intervenir.</p>${pedir ? `<div class="fila-botones"><a class="boton boton--claro" href="${esc(pedir)}" target="_blank" rel="noopener">Conectar mi WhatsApp ↗</a></div>` : ""}</section>` : ""}
    <div class="encabezado-bloque"><h2>La actividad de tu asistente</h2><small class="tenue">${esc(chats.periodo ?? "<periodo por definir>")}</small></div>
    <div class="kpis">${KPIS.map(([clave, etiqueta]) => `<div class="kpi"><b class="${m[clave] == null ? "kpi__sin-dato" : ""}">${m[clave] == null ? "&lt;sin datos&gt;" : esc(m[clave])}</b><span>${etiqueta}</span></div>`).join("")}</div>
    <div class="chats-herramientas"><label class="buscador"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span class="sr-only">Buscar conversaciones</span><input type="search" placeholder="Buscar nombre o mensaje…" data-buscar-chat autocomplete="off" /></label><div class="filtros" role="group" aria-label="Filtrar conversaciones"><button type="button" data-filtro-chat="todas" aria-pressed="true">Todas</button><button type="button" data-filtro-chat="pendiente" aria-pressed="false">Te toca a ti${pendientes.length ? ` · ${pendientes.length}` : ""}</button></div></div>
    <div class="grupo-chats" data-grupo="pendiente"><div class="titulo-seccion"><h2>Te toca a ti</h2></div>${lista(pendientes, 0, "pendiente", chats.conectado ? "No tienes conversaciones pendientes en este periodo." : "El seguimiento estará disponible al conectar tu WhatsApp.")}</div>
    <div class="grupo-chats" data-grupo="reciente"><div class="titulo-seccion"><h2>Recientes</h2></div>${lista(recientes, pendientes.length, "reciente", chats.conectado ? "Aún no hay conversaciones en este periodo." : "Todavía no hay conversaciones reales para mostrar.")}</div>
    ${ejemplo.length ? `<div class="grupo-chats" data-grupo="ejemplo"><p class="eyebrow etiqueta-ejemplo">Vista de ejemplo · no son conversaciones reales</p>${lista(ejemplo, pendientes.length + recientes.length, "ejemplo")}</div>` : ""}
    <p class="vacio" data-sin-resultados hidden>No hay conversaciones que coincidan. Prueba otro nombre o mensaje.</p>
  </div>`;
  const raiz = cont.firstElementChild;
  let filtro = "todas";
  const buscar = raiz.querySelector("[data-buscar-chat]");
  function filtrar() {
    const consulta = normalizar(buscar.value.trim());
    let cantidad = 0;
    raiz.querySelectorAll("[data-chat]").forEach((el) => {
      const c = todos[Number(el.dataset.chat)];
      const coincide = normalizar(
        `${c.nombre} ${c.mensaje} ${c.estado ?? ""}`,
      ).includes(consulta);
      el.hidden =
        !coincide ||
        (filtro === "pendiente" && el.dataset.grupo !== "pendiente");
      if (!el.hidden) cantidad++;
    });
    raiz.querySelectorAll(".grupo-chats").forEach((el) => {
      const hayItems = el.querySelectorAll("[data-chat]").length > 0;
      el.hidden =
        (filtro === "pendiente" && el.dataset.grupo !== "pendiente") ||
        (hayItems && !el.querySelector("[data-chat]:not([hidden])")) ||
        (!hayItems && Boolean(consulta));
    });
    raiz.querySelector("[data-sin-resultados]").hidden =
      cantidad > 0 ||
      (!consulta && !todos.length) ||
      (!consulta && filtro === "pendiente" && !pendientes.length);
  }
  buscar.addEventListener("input", filtrar);
  raiz.addEventListener("click", (e) => {
    const btnFiltro = e.target.closest("[data-filtro-chat]");
    if (btnFiltro) {
      filtro = btnFiltro.dataset.filtroChat;
      raiz
        .querySelectorAll("[data-filtro-chat]")
        .forEach((b) => b.setAttribute("aria-pressed", b === btnFiltro));
      filtrar();
      return;
    }
    const btn = e.target.closest("[data-abrir-chat]");
    if (!btn) return;
    const c = todos[Number(btn.dataset.abrirChat)];
    const esEjemplo = btn.closest("[data-chat]").dataset.grupo === "ejemplo";
    const liga =
      !esEjemplo && chats.conectado
        ? ligaWhatsApp(c.whatsapp || c.telefono, "")
        : null;
    abrirHoja(
      `<div class="hoja__cabeza"><h2 id="hoja-titulo">${esc(c.nombre)}</h2><button class="cerrar" data-cerrar aria-label="Cerrar">×</button></div>${esEjemplo ? `<span class="chip">Conversación de ejemplo</span>` : ""}<p class="tenue">${esc(c.estado ?? "Último mensaje disponible")}</p><div class="mensaje-previo">${esc(c.mensaje)}</div>${c.recibido ? `<small class="tenue">${esc(diaDeInstante(c.recibido))} · ${esc(horaCorta(c.recibido))}</small>` : ""}${liga ? `<a class="boton" href="${esc(liga)}" target="_blank" rel="noopener">Responder por WhatsApp ↗</a>` : `<p class="tenue chico">${esEjemplo ? "Así verás los casos que te pase tu asistente cuando esté conectado." : "Este registro contiene el último mensaje. El historial y el teléfono aún no están disponibles."}</p>`}`,
    );
  });
}

function lista(items, inicio, grupo, vacio = "") {
  if (!items.length) return `<p class="vacio">${esc(vacio)}</p>`;
  return `<ul class="conversaciones">${items.map((c, i) => `<li data-chat="${inicio + i}" data-grupo="${grupo}"><button type="button" class="conversacion" data-abrir-chat="${inicio + i}" aria-label="Ver conversación de ${esc(c.nombre)}"><span class="avatar" aria-hidden="true">${esc(iniciales(c.nombre))}</span><span class="conversacion__texto"><strong>${esc(c.nombre)}</strong><span class="conversacion__mensaje">${esc(c.mensaje)}</span>${c.estado ? `<span class="chip chip--punto ${c.estado === "te toca" ? "chip--rojo" : "chip--ok"}">${esc(c.estado)}</span>` : ""}</span>${c.recibido ? `<time datetime="${esc(c.recibido)}">${esc(diaDeInstante(c.recibido))}<br>${esc(horaCorta(c.recibido))}</time>` : `<span class="tenue" aria-hidden="true">↗</span>`}</button></li>`).join("")}</ul>`;
}
