// Radar: el periódico diario del negocio.

import { cargar } from "../datos.js";
import {
  esc,
  htmlFuentes,
  fechaLarga,
  fechaMedia,
  fechaCorta,
  diaNum,
  mesCorto,
  diasEntre,
  faltan,
  hoyISO,
  copiar,
  ligaWhatsApp,
  esPendiente,
} from "../util.js";
import { abrirHoja } from "../app.js";

const IMPACTO = { alto: "chip--rojo", medio: "chip--azufre", bajo: "" };
const TIPO_IDEA = {
  post: "Post",
  reel: "Reel",
  historia: "Historia",
  promocion: "Promoción",
  mensaje: "Mensaje a clientes",
};

export async function vistaRadar(cont, { fecha } = {}) {
  const [negocio, indice] = await Promise.all([
    cargar("negocio.json"),
    cargar("radar/index.json"),
  ]);
  const ediciones = [...(indice.ediciones ?? [])].sort((a, b) =>
    b.fecha.localeCompare(a.fecha),
  );
  if (!ediciones.length) {
    cont.innerHTML = `<div class="vacio"><h1 class="eyebrow">Radar</h1><p>Tu primera edición sale mañana temprano.</p></div>`;
    return;
  }
  const actual = ediciones.find((e) => e.fecha === fecha) ?? ediciones[0];
  const ed = await cargar(`radar/${actual.fecha}.json`);
  const hoy = hoyISO();
  const esDeHoy = ed.fecha === hoy;

  cont.innerHTML = `
    <header class="cabecera-radar">
      <span class="eyebrow">${esc(negocio.nombre)} · ${esc(negocio.ciudad ?? "")}</span>
      <h1>Radar<span class="punto">.</span></h1>
      <div class="cabecera-radar__datos">
        <span><b>${esc(fechaLarga(ed.fecha))}</b></span>
        <span>Edición nº ${esc(ed.numero ?? "")}</span>
        <span>${esDeHoy ? "Edición de hoy" : "Edición anterior"}</span>
      </div>
    </header>

    <div class="barra-ediciones">
      <button type="button" class="boton boton--borde" data-accion="ediciones">Ediciones (${ediciones.length})</button>
      ${ed.fecha !== ediciones[0].fecha ? `<a class="boton boton--borde" href="#/radar">Ir a la más reciente</a>` : !esDeHoy ? `<span class="tenue chico">Última edición disponible · ${esc(fechaCorta(ed.fecha))}</span>` : ""}
    </div>
    <nav class="radar-secciones" aria-label="Ir a una sección del radar"><button type="button" data-salto="sec-competencia">Competencia</button><button type="button" data-salto="sec-mercado">Mercado</button><button type="button" data-salto="sec-fechas">Fechas</button>${ed.idea ? `<button type="button" data-salto="sec-idea">Idea para hoy ↗</button>` : ""}</nav>

    ${portada(ed.portada)}

    <div class="radar-cuerpo">
      <div class="columna-principal">
        ${seccion("Tu competencia", "competencia", ed.competencia, notaCompetencia, "Hoy no hubo movimientos que valga la pena contarte.")}
        ${seccion("Tu mercado", "mercado", ed.mercado, notaMercado, "Sin noticias de tu giro que te afecten hoy.")}
      </div>
      <div class="columna-lateral">
        ${seccionFechas(ed.fechas, ed.fecha)}
        ${idea(ed.idea)}
      </div>
    </div>

    ${
      ed.sin_confirmar?.length
        ? `<aside class="sin-confirmar"><b>Lo que vimos pero no pudimos confirmar</b><ul>${ed.sin_confirmar
            .map((s) => `<li>${esc(s)}</li>`)
            .join("")}</ul></aside>`
        : ""
    }
    <footer class="pie-edicion">
      ${esc(ed.notas_metodo ?? "Cada nota trae la liga de donde salió. Si algo no se pudo confirmar, aquí se dice.")}
    </footer>
  `;

  cont.querySelectorAll("[data-salto]").forEach((b) =>
    b.addEventListener("click", () => {
      document.getElementById(b.dataset.salto)?.scrollIntoView({
        block: "start",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }),
  );

  cont
    .querySelector('[data-accion="ediciones"]')
    .addEventListener("click", () =>
      abrirHoja(
        `<div class="hoja__cabeza"><h2 id="hoja-titulo">Ediciones</h2><button class="cerrar" data-cerrar aria-label="Cerrar">×</button></div>
       <ul class="ediciones">${ediciones
         .map(
           (e) =>
             `<li><a href="#/radar/${esc(e.fecha)}" data-cerrar ${e.fecha === ed.fecha ? 'aria-current="true"' : ""}>
               <small>${esc(fechaMedia(e.fecha))} · nº ${esc(e.numero ?? "")}</small>
               <span>${esc(e.titular ?? "")}</span></a></li>`,
         )
         .join("")}</ul>`,
      ),
    );

  const btnCopiar = cont.querySelector('[data-accion="copiar-idea"]');
  btnCopiar?.addEventListener("click", () => copiar(ed.idea.texto_sugerido));

  const btnPedir = cont.querySelector('[data-accion="pedir-idea"]');
  if (btnPedir) {
    const liga = ligaWhatsApp(
      negocio.contacto_mecha?.whatsapp,
      `Hola Mecha, quiero que hagan la idea del radar del ${fechaCorta(ed.fecha)}: "${ed.idea.titulo}".`,
    );
    if (liga) btnPedir.href = liga;
    else {
      btnPedir.setAttribute("aria-disabled", "true");
      btnPedir.title = "Falta el número de WhatsApp de Mecha en negocio.json";
      btnPedir.addEventListener("click", (e) => e.preventDefault());
    }
  }
}

function portada(p) {
  if (!p) return "";
  return `
    <article class="portada">
      <h2>${esc(p.titulo)}</h2>
      <p class="portada__bajada">${esc(p.bajada)}</p>
      <div>
        ${
          p.por_que_importa
            ? `<div class="portada__importa"><span class="eyebrow">Por qué te importa</span><p>${esc(p.por_que_importa)}</p></div>`
            : ""
        }
        ${htmlFuentes(p.fuentes)}
      </div>
    </article>`;
}

function seccion(titulo, id, items = [], render, vacio) {
  return `
    <section aria-labelledby="sec-${id}">
      <div class="titulo-seccion"><h2 id="sec-${id}">${titulo}</h2><small>${items.length ? items.length + (items.length === 1 ? " nota" : " notas") : ""}</small></div>
      ${items.length ? `<div class="lista-notas">${items.map(render).join("")}</div>` : `<p class="vacio">${vacio}</p>`}
    </section>`;
}

function notaCompetencia(n) {
  return `
    <article class="nota tarjeta">
      <div class="nota__cabeza"><span class="chip chip--punto chip--rojo">${esc(n.competidor)}</span></div>
      <h3>${esc(n.titulo)}</h3>
      <p>${esc(n.detalle)}</p>
      ${n.que_hacer ? `<p class="nota__accion"><b>Qué hacer:</b> ${esc(n.que_hacer)}</p>` : ""}
      ${htmlFuentes(n.fuentes)}
    </article>`;
}

function notaMercado(n) {
  const clase = IMPACTO[n.impacto] ?? "";
  return `
    <article class="nota tarjeta">
      <div class="nota__cabeza"><span class="chip chip--punto ${clase}">Impacto ${esc(n.impacto ?? "—")}</span></div>
      <h3>${esc(n.titulo)}</h3>
      <p>${esc(n.detalle)}</p>
      ${htmlFuentes(n.fuentes)}
    </article>`;
}

function seccionFechas(fechas = [], fechaEdicion) {
  const proximas = fechas
    .filter((f) => diasEntre(fechaEdicion, f.fin || f.inicio) >= 0)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  return `
    <section aria-labelledby="sec-fechas">
      <div class="titulo-seccion"><h2 id="sec-fechas">Fechas que vienen</h2></div>
      ${
        proximas.length
          ? `<ol class="fechas">${proximas
              .map((f) => {
                const dias = diasEntre(hoyISO(), f.inicio);
                const enCurso =
                  dias < 0 && diasEntre(hoyISO(), f.fin || f.inicio) >= 0;
                const rango =
                  f.fin && f.fin !== f.inicio
                    ? `${fechaCorta(f.inicio)} al ${fechaCorta(f.fin)}`
                    : fechaCorta(f.inicio);
                return `<li class="fecha">
                  <div class="fecha__dia" aria-hidden="true"><b>${diaNum(f.inicio)}</b><small>${esc(mesCorto(f.inicio))}</small></div>
                  <div>
                    <h3>${esc(f.nombre)}</h3>
                    <p>${esc(rango)}. ${esc(f.que_preparar ?? "")}</p>
                    <span class="chip chip--punto ${dias <= 14 ? "chip--rojo" : ""}">${esc(enCurso ? "en curso" : faltan(dias))}</span>
                    ${htmlFuentes(f.fuentes)}
                  </div>
                </li>`;
              })
              .join("")}</ol>`
          : `<p class="vacio">Nada en el calendario cercano.</p>`
      }
    </section>`;
}

function idea(i) {
  if (!i) return "";
  const tieneTexto = i.texto_sugerido && !esPendiente(i.texto_sugerido);
  return `
    <section class="idea" aria-labelledby="sec-idea">
      <img src="assets/img/robot-busto-480.webp" alt="" width="120" height="115" loading="lazy" />
      <span class="eyebrow">Idea para hoy · ${esc(TIPO_IDEA[i.tipo] ?? i.tipo ?? "")}</span>
      <h2 id="sec-idea">${esc(i.titulo)}</h2>
      <p>${esc(i.detalle)}</p>
      ${tieneTexto ? `<div class="idea__copy">${esc(i.texto_sugerido)}</div>` : ""}
      <div class="fila-botones">
        ${tieneTexto ? `<button type="button" class="boton boton--claro" data-accion="copiar-idea">Copiar texto</button>` : ""}
        <a class="boton boton--borde" data-accion="pedir-idea" href="#" target="_blank" rel="noopener">Que Mecha lo haga</a>
      </div>
    </section>`;
}
