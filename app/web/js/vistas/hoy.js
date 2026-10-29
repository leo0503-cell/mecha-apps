import { cargar, archivo } from "../datos.js";
import {
  esc,
  fechaCorta,
  fechaMedia,
  hoyISO,
  ligaWhatsApp,
  diasEntre,
  faltan,
} from "../util.js";
import { requiereRespuesta } from "../respuestas.js";

export async function vistaHoy(cont) {
  const negocio = await cargar("negocio.json");
  const resultados = await Promise.allSettled([
    cargar("chats.json"),
    cargar("contenido.json"),
    cargar("web.json"),
    cargar("radar/index.json"),
  ]);
  const [chats, contenido, web, indice] = resultados.map((r) =>
    r.status === "fulfilled" ? r.value : null,
  );
  const ultima = [...(indice?.ediciones ?? [])].sort((a, b) =>
    b.fecha.localeCompare(a.fecha),
  )[0];
  let edicion;
  if (ultima) {
    try {
      edicion = await cargar(`radar/${ultima.fecha}.json`);
    } catch {
      /* El resto del panel sigue disponible. */
    }
  }
  const piezas = contenido?.piezas ?? [];
  const porAprobar = piezas.filter((p) => requiereRespuesta(p));
  const conversaciones = chats?.conectado ? (chats.te_toca ?? []) : [];
  const pendientesWeb = (web?.pendientes ?? []).filter((p) => !p.hecho);
  const tareas = [
    ...conversaciones.map((c) => ({
      tipo: "WhatsApp",
      titulo: c.nombre,
      detalle: c.mensaje,
      ruta: "#/chats",
      accion: "Ver conversación",
    })),
    ...porAprobar.map((p) => ({
      tipo: p.tipo === "reel" ? "Reel por revisar" : "Post por revisar",
      titulo: p.titulo,
      detalle: `Fecha de la pieza: ${fechaCorta(p.fecha)}`,
      ruta: `#/contenido/${encodeURIComponent(p.id)}`,
      accion: "Revisar pieza",
    })),
  ];
  const fechas = (edicion?.fechas ?? [])
    .filter((f) => diasEntre(hoyISO(), f.fin || f.inicio) >= 0)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  const pedir = ligaWhatsApp(
    negocio.contacto_mecha?.whatsapp,
    `Hola Mecha, necesito ayuda con ${negocio.nombre}.`,
  );
  const primerPendiente = tareas[0];
  const metrica = (valor) => (valor == null ? "&lt;sin datos&gt;" : esc(valor));
  const error = (ruta) =>
    `<a class="estado-pendiente" href="${ruta}">No disponible · reintentar ↗</a>`;

  cont.innerHTML = `<div class="hoy">
    <header class="hoy-cabecera">
      <div><span class="eyebrow">Tu centro de operaciones</span><h1>Menos pendientes.<br>Más <span>negocio.</span></h1><p>Marketing y automatización, en un solo lugar.</p></div>
      <div class="hoy-fecha"><span class="chip">${esc(negocio.ciudad || negocio.nombre)}</span><p>${esc(fechaMedia(hoyISO()))}</p></div>
    </header>
    <section class="resumen-hoy" aria-labelledby="resumen-titulo">
      <div class="resumen-hoy__texto"><span class="eyebrow">${primerPendiente ? "Empieza por aquí" : "Tu siguiente paso"}</span>
      <h2 id="resumen-titulo">${primerPendiente ? "Tu negocio avanza con tu visto bueno." : "Todo lo que necesitas, a la mano."}</h2>
      <p>${primerPendiente ? esc(primerPendiente.titulo) : "Revisa tu radar, prepara tu contenido y sigue lo que pasa en tu negocio."}</p>
      <a class="boton boton--claro" href="${primerPendiente?.ruta ?? "#/radar"}">${primerPendiente?.accion ?? "Explorar mi radar"}<span aria-hidden="true">↗</span></a></div>
      <img class="resumen-hoy__robot" src="assets/img/robot-busto-480.webp" alt="" width="480" height="459" />
      <span class="resumen-hoy__sello" aria-hidden="true">MECHA EN MARCHA</span>
    </section>
    <div class="pulso" aria-label="Estado de tus servicios">
      <a class="pulso__item" href="#/chats"><span>WhatsApp</span><strong>${chats ? (chats.conectado ? metrica(chats.metricas?.conversaciones) : "Por conectar") : "&lt;sin datos&gt;"}</strong><small>${chats?.conectado ? esc(chats.periodo ?? "Conversaciones") : "Tu asistente de atención"}</small><span class="pulso__flecha" aria-hidden="true">↗</span></a>
      <a class="pulso__item" href="#/contenido"><span>Contenido</span><strong>${contenido ? porAprobar.length : "&lt;sin datos&gt;"}</strong><small>Piezas por revisar${contenido?.semana ? ` · ${esc(fechaCorta(contenido.semana.inicio))}` : ""}</small><span class="pulso__flecha" aria-hidden="true">↗</span></a>
      <a class="pulso__item" href="#/web"><span>Página web</span><strong class="pulso__estado">${esc(web?.estado ?? "<sin datos>")}</strong><small>${web ? `${pendientesWeb.length} pendientes de lanzamiento` : "Estado no disponible"}</small><span class="pulso__flecha" aria-hidden="true">↗</span></a>
    </div>
    <div class="hoy-columnas">
      <section aria-labelledby="atencion-titulo"><div class="encabezado-bloque"><h2 id="atencion-titulo">Necesita tu atención<span class="punto">.</span></h2><span class="chip">${tareas.length}</span></div>
        <p class="descripcion-bloque">Las decisiones que mueven tu negocio.</p>
        <div class="acciones-hoy">${tareas.map((t) => `<a class="accion-hoy" href="${t.ruta}"><span class="accion-hoy__icono" aria-hidden="true">${t.tipo === "WhatsApp" ? "↗" : "✓"}</span><div><small>${esc(t.tipo)}</small><h3>${esc(t.titulo)}</h3><p>${esc(t.detalle)}</p></div><span class="accion-hoy__flecha" aria-hidden="true">→</span></a>`).join("") || `<div class="tarjeta vacio">${contenido && chats ? "No tienes decisiones pendientes en los datos disponibles." : "Carga las secciones para consultar tus pendientes."}</div>`}</div>
        ${!contenido ? error("#/contenido") : ""}${!chats ? error("#/chats") : ""}
        ${pendientesWeb.length ? `<a class="pendiente-web-hoy" href="#/web"><span class="chip chip--punto chip--azufre">Web</span><span>${esc(pendientesWeb[0].texto)}${pendientesWeb.length > 1 ? ` y ${pendientesWeb.length - 1} pendientes más` : ""}</span><span aria-hidden="true">→</span></a>` : ""}
      </section>
      <aside class="hoy-lateral">
        <section class="radar-mini" aria-labelledby="radar-mini-titulo"><div class="radar-mini__meta"><span class="eyebrow">En tu radar</span><span aria-hidden="true">◎</span></div>
        <small>${ultima ? `${esc(fechaCorta(ultima.fecha))} · ${ultima.fecha === hoyISO() ? "Edición de hoy" : "Última edición disponible"}` : "Sin edición disponible"}</small>
        <h2 id="radar-mini-titulo">${esc(edicion?.portada?.titulo ?? ultima?.titular ?? "Tu mercado, un paso adelante.")}</h2>
        <a href="#/radar">Leer edición <span aria-hidden="true">↗</span></a></section>
        <section class="agenda-mini" aria-labelledby="agenda-titulo"><div class="encabezado-bloque"><h2 id="agenda-titulo">Lo que viene</h2><span aria-hidden="true">↗</span></div>
          ${
            fechas
              .slice(0, 2)
              .map(
                (f) =>
                  `<div class="agenda-mini__fecha"><span>${esc(fechaCorta(f.inicio))}</span><div><h3>${esc(f.nombre)}</h3><small>${diasEntre(hoyISO(), f.inicio) < 0 ? "En curso" : esc(faltan(diasEntre(hoyISO(), f.inicio)))}</small></div></div>`,
              )
              .join("") ||
            `<p class="tenue chico">Sin fechas próximas en la edición disponible.</p>`
          }
        </section>
        ${pedir ? `<a class="ayuda-mecha" href="${esc(pedir)}" target="_blank" rel="noopener"><span>¿Lo resolvemos juntos?<small>Habla con Mecha por WhatsApp</small></span><span aria-hidden="true">↗</span></a>` : ""}
      </aside>
    </div>
    ${contenido?.semana && contenido.semana.fin < hoyISO() ? `<p class="nota-datos">Contenido disponible: ${esc(fechaCorta(contenido.semana.inicio))} al ${esc(fechaCorta(contenido.semana.fin))}. Esta semana aún no tiene una entrega nueva.</p>` : ""}
  </div>`;
}
