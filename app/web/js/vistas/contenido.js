// Contenido de la semana: los 2 posts y el reel, para aprobar o pedir cambios.

import { cargar, archivo } from "../datos.js";
import {
  esc,
  fechaMedia,
  fechaCorta,
  ligaWhatsApp,
  avisar,
  copiar,
  hoyISO,
} from "../util.js";
import { abrirHoja, cerrarHoja } from "../app.js";
import {
  idRespuesta,
  respuestasContenido,
  guardarRespuesta,
  respuestaEnviada,
  requiereRespuesta,
} from "../respuestas.js";

const ESTADOS = {
  "en producción": "",
  "para aprobar": "chip--azufre",
  aprobado: "chip--ok",
  programado: "chip--ok",
  publicado: "chip--ok",
  cambios: "chip--rojo",
};

export async function vistaContenido(cont) {
  const [negocio, datos] = await Promise.all([
    cargar("negocio.json"),
    cargar("contenido.json"),
  ]);
  const piezas = datos.piezas ?? [];
  const respuestas = respuestasContenido();
  const meta = datos.meta;
  const posts = piezas.filter((p) => p.tipo === "post").length;
  const reels = piezas.filter((p) => p.tipo === "reel").length;
  const barras = [
    ...Array.from({ length: meta?.posts ?? 0 }, (_, i) => i < posts),
    ...Array.from({ length: meta?.reels ?? 0 }, (_, i) => i < reels),
  ];
  const pendientes = piezas.filter((p) =>
    requiereRespuesta(p, respuestas),
  ).length;
  const siguientes = (datos.siguiente ?? []).filter((s) => s.fecha >= hoyISO());

  cont.innerHTML = `<div class="vista-contenido">
    <div class="semana">
      <div>
        <span class="eyebrow">Tu contenido · última entrega</span>
        <h1>${esc(rango(datos.semana))}</h1>
      </div>
      <div>
        <div class="ritmo" role="img" aria-label="${posts} posts y ${reels} reels preparados">${barras
          .map((h) => `<span class="${h ? "hecho" : ""}"></span>`)
          .join("")}</div>
        <small class="tenue">${meta ? `${meta.posts ?? "&lt;por definir&gt;"} posts + ${meta.reels ?? "&lt;por definir&gt;"} reel` : `${posts} posts + ${reels} reels disponibles`}</small>
      </div>
    </div>

    ${datos.semana?.fin < hoyISO() ? `<p class="nota-datos">Esta entrega corresponde a una semana anterior. Las fechas originales se conservan.</p>` : ""}
    <div class="filtros" role="group" aria-label="Filtrar contenido"><button type="button" data-filtro-pieza="todas" aria-pressed="true">Todo <span>${piezas.length}</span></button><button type="button" data-filtro-pieza="pendiente" aria-pressed="false">Por revisar <span>${pendientes}</span></button><button type="button" data-filtro-pieza="enviada" aria-pressed="false">Respuesta enviada</button></div>
    <p class="tenue chico nota-respuesta">Las respuestas se envían por WhatsApp. Su seguimiento se guarda en este dispositivo.</p>
    <div class="piezas">
      ${piezas.map((p) => pieza(p, respuestas[idRespuesta(p)])).join("") || `<p class="vacio">Estamos preparando las piezas de esta semana.</p>`}
    </div>
    <p class="vacio" data-sin-piezas hidden>No hay piezas con este filtro.</p>

    ${
      siguientes.length
        ? `<section class="siguiente">
            <div class="titulo-seccion"><h2>Lo que sigue</h2></div>
            <ul>${siguientes
              .map(
                (s) =>
                  `<li><span>${esc(s.titulo)}</span><small class="tenue">${esc(s.tipo)} · ${esc(fechaCorta(s.fecha))}</small></li>`,
              )
              .join("")}</ul>
          </section>`
        : ""
    }
  </div>`;
  const raiz = cont.firstElementChild;

  // Contador de slides en los carruseles.
  raiz.querySelectorAll(".carrusel").forEach((c) => {
    const contador = c.parentElement.querySelector(".pieza__contador");
    const total = c.children.length;
    c.addEventListener(
      "scroll",
      () => {
        const i = Math.round(c.scrollLeft / c.clientWidth) + 1;
        contador.textContent = `${Math.min(i, total)} / ${total}`;
      },
      { passive: true },
    );
  });

  raiz.addEventListener("click", (e) => {
    const filtro = e.target.closest("[data-filtro-pieza]");
    if (filtro) {
      raiz
        .querySelectorAll("[data-filtro-pieza]")
        .forEach((b) => b.setAttribute("aria-pressed", b === filtro));
      let visibles = 0;
      raiz.querySelectorAll("[data-pieza]").forEach((el) => {
        el.hidden =
          filtro.dataset.filtroPieza !== "todas" &&
          el.dataset.filtro !== filtro.dataset.filtroPieza;
        if (!el.hidden) visibles++;
      });
      raiz.querySelector("[data-sin-piezas]").hidden = visibles > 0;
      return;
    }
    const slide = e.target.closest("[data-slide]");
    if (slide) {
      const carrusel = slide
        .closest(".pieza__medios")
        .querySelector(".carrusel");
      const actual = Math.round(carrusel.scrollLeft / carrusel.clientWidth);
      const siguiente = Math.max(
        0,
        Math.min(
          carrusel.children.length - 1,
          actual + Number(slide.dataset.slide),
        ),
      );
      carrusel.scrollTo({
        left: siguiente * carrusel.clientWidth,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      return;
    }
    const copy = e.target.closest("[data-copy-pieza]");
    if (copy) {
      const p = piezas.find((x) => x.id === copy.dataset.copyPieza);
      if (p) copiar([p.caption, p.hashtags].filter(Boolean).join("\n\n"));
      return;
    }
    const btn = e.target.closest("[data-responder]");
    if (!btn) return;
    const p = piezas.find((x) => x.id === btn.dataset.id);
    if (!p) return;
    if (btn.dataset.responder === "aprobar") {
      prepararRespuesta(
        negocio,
        p,
        "aprobado",
        `✅ Apruebo "${p.titulo}" (${p.tipo}, ${fechaCorta(p.fecha)}).`,
        raiz,
      );
    } else {
      abrirHoja(
        `<div class="hoja__cabeza"><h2 id="hoja-titulo">¿Qué le cambiamos?</h2><button class="cerrar" data-cerrar aria-label="Cerrar">×</button></div>
         <p>${esc(p.titulo)} · ${esc(fechaMedia(p.fecha))}</p>
         <label for="cambio" class="eyebrow">Tu comentario</label>
         <textarea id="cambio" placeholder="Ej. cambiar la foto del slide 3, el precio no va, etc."></textarea>
         <button type="button" class="boton" data-enviar>Mandar a Mecha</button>`,
        (hoja) => {
          hoja.querySelector("[data-enviar]").addEventListener("click", () => {
            const texto = hoja.querySelector("#cambio").value.trim();
            if (!texto) return avisar("Escribe qué le cambiamos");
            prepararRespuesta(
              negocio,
              p,
              "cambios",
              `✏️ Cambios para "${p.titulo}" (${fechaCorta(p.fecha)}):\n${texto}`,
              raiz,
            );
          });
        },
      );
    }
  });
}

function prepararRespuesta(negocio, p, estado, mensaje, raiz) {
  const liga = ligaWhatsApp(negocio.contacto_mecha?.whatsapp, mensaje);
  abrirHoja(
    `<div class="hoja__cabeza"><h2 id="hoja-titulo">${estado === "aprobado" ? "Envía tu aprobación" : "Envía tus cambios"}</h2><button class="cerrar" data-cerrar aria-label="Cerrar">×</button></div>
    <p>Revisa el mensaje y envíalo desde WhatsApp. Después puedes marcarlo aquí para llevar tu seguimiento.</p>
    <div class="mensaje-previo">${esc(mensaje)}</div>
    <div class="fila-botones">${liga ? `<a class="boton" data-abrir-whatsapp href="${esc(liga)}" target="_blank" rel="noopener">Abrir WhatsApp ↗</a>` : `<p class="tenue">Falta el WhatsApp de Mecha. Puedes copiar el mensaje.</p>`}<button class="boton boton--borde" data-copiar-respuesta>Copiar mensaje</button></div>
    <button class="boton boton--borde" data-confirmar-respuesta ${liga ? "disabled" : "hidden"}>Ya lo envié · guardar seguimiento</button>
    <p class="tenue chico">Este registro es local. El estado oficial de la pieza cambia cuando Mecha lo actualiza.</p>`,
    (h) => {
      h.querySelector("[data-copiar-respuesta]").addEventListener("click", () =>
        copiar(mensaje),
      );
      const confirmar = h.querySelector("[data-confirmar-respuesta]");
      h.querySelector("[data-abrir-whatsapp]")?.addEventListener(
        "click",
        () => {
          confirmar.disabled = false;
        },
      );
      confirmar.addEventListener("click", () => {
        guardarRespuesta(p, estado);
        cerrarHoja();
        if (raiz.parentElement) vistaContenido(raiz.parentElement);
        avisar("Respuesta marcada como enviada en este dispositivo");
      });
    },
  );
}

function rango(s) {
  if (!s) return "";
  return `${fechaCorta(s.inicio)} – ${fechaCorta(s.fin)}`;
}

function pieza(p, respuesta) {
  // La respuesta local solo cuenta mientras la pieza sigue "para aprobar"; si Mecha ya la movió, manda el servidor.
  const enviada = p.estado === "para aprobar" && respuestaEnviada(respuesta);
  const estado = p.estado;
  const medios =
    p.tipo === "reel"
      ? `<video class="pieza__video" src="${esc(archivo(p.video))}" poster="${esc(archivo(p.portada))}" controls playsinline preload="none" muted loop></video>
         ${p.duracion ? `<span class="pieza__contador">Reel · ${esc(p.duracion)}</span>` : ""}`
      : `<div class="carrusel" tabindex="0" aria-label="Slides de ${esc(p.titulo)}">${(
          p.slides ?? []
        )
          .map(
            (s, i) =>
              `<img src="${esc(archivo(s))}" alt="Slide ${i + 1} de ${p.slides.length}" width="720" height="900" ${i ? 'loading="lazy"' : ""} />`,
          )
          .join("")}</div>
         <span class="pieza__contador">1 / ${(p.slides ?? []).length}</span>
         ${(p.slides ?? []).length > 1 ? `<div class="carrusel__controles"><button type="button" data-slide="-1" aria-label="Slide anterior de ${esc(p.titulo)}">←</button><button type="button" data-slide="1" aria-label="Siguiente slide de ${esc(p.titulo)}">→</button></div>` : ""}`;

  return `
    <article class="pieza" data-pieza="${esc(p.id)}" data-filtro="${enviada ? "enviada" : p.estado === "para aprobar" ? "pendiente" : "otra"}" tabindex="-1">
      <div class="pieza__medios">${medios}</div>
      <div class="pieza__info">
        <div class="pieza__meta">
          <span class="chip">${p.tipo === "reel" ? "Reel" : "Post"}</span>
          <span class="chip">${esc(fechaMedia(p.fecha))}</span>
          <span class="chip chip--punto ${ESTADOS[estado] ?? ""}">${esc(estado === "cambios" ? "pediste cambios" : estado)}</span>
        </div>
        ${enviada ? `<p class="respuesta-local">${respuesta.estado === "aprobado" ? "Aprobación" : "Solicitud de cambios"} marcada como enviada · en este dispositivo</p>` : ""}
        <h3>${esc(p.titulo)}</h3>
        ${p.redes?.length ? `<small class="tenue">${esc(p.redes.join(" y "))}</small>` : ""}
        ${p.caption ? `<details><summary>Ver texto del post</summary><p>${esc(p.caption)}</p>${p.hashtags ? `<p class="tenue">${esc(p.hashtags)}</p>` : ""}<button type="button" class="boton boton--borde copiar-caption" data-copy-pieza="${esc(p.id)}">Copiar texto</button></details>` : ""}
        ${
          p.estado === "para aprobar"
            ? `<div class="fila-botones">
                <button type="button" class="boton" data-responder="aprobar" data-id="${esc(p.id)}">${enviada ? "Reenviar aprobación" : "Aprobar"}</button>
                <button type="button" class="boton boton--borde" data-responder="cambios" data-id="${esc(p.id)}">Pedir cambio</button>
              </div>`
            : ""
        }
      </div>
    </article>`;
}
