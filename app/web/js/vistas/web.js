// Web: el estado de la página del negocio.

import { cargar, archivo } from "../datos.js";
import {
  esc,
  urlSegura,
  esPendiente,
  fechaMedia,
  ligaWhatsApp,
  avisar,
} from "../util.js";
import { abrirHoja, cerrarHoja } from "../app.js";

const ESTADO = {
  publicada: "chip--ok",
  "en construcción": "chip--azufre",
  "en revisión": "chip--azufre",
};

export async function vistaWeb(cont) {
  const [negocio, web] = await Promise.all([
    cargar("negocio.json"),
    cargar("web.json"),
  ]);
  const url = esPendiente(web.url) ? null : urlSegura(web.url);
  const captura = web.captura ? archivo(web.captura) : "";
  const pendientes = web.pendientes ?? [];

  cont.innerHTML = `
    <span class="eyebrow">Tu página web</span>
    <h1 class="titulo-vista">Tu negocio también vive aquí<span class="punto">.</span></h1>

    <div class="web-grid">
    <div class="sitio">
      <div class="sitio__vista">
        <div class="sitio__navegador" aria-hidden="true"><i></i><i></i><i></i><span>${esc(web.url ?? "")}</span></div>
        ${
          captura
            ? `<button class="sitio__captura" type="button" data-ampliar-captura aria-label="Ampliar vista previa de la web"><img src="${esc(captura)}" alt="Vista previa de la página de ${esc(negocio.nombre)}" width="960" height="1200" loading="lazy" /><span>Ampliar vista previa ↗</span></button>`
            : `<p class="vacio">La vista previa aparece cuando la página esté lista.</p>`
        }
      </div>

      <div class="pieza__meta">
        <span class="chip chip--punto ${ESTADO[web.estado] ?? ""}">${esc(web.estado ?? "")}</span>
        ${web.actualizado ? `<span class="chip">Actualizada: ${esc(fechaMedia(web.actualizado))}</span>` : ""}
        ${web.visitas_mes != null ? `<span class="chip">${esc(web.visitas_mes)} visitas este mes</span>` : ""}
      </div>

      <div class="fila-botones">
        ${url ? `<a class="boton" href="${esc(url)}" target="_blank" rel="noopener">Abrir mi página</a>` : `<span class="boton" aria-disabled="true">Abrir mi página</span>`}
        <button type="button" class="boton boton--borde" data-accion="cambio-web">Pedir un cambio</button>
      </div>
    </div>

    <div class="web-resumen">
    <div class="encabezado-bloque"><h2>${esc(web.titulo ?? negocio.nombre)}</h2></div>
    <p class="tenue">${url ? "Consulta el estado de tu página y pide los ajustes que necesites." : "Tu página está en preparación. Estos son los pasos para ponerla en marcha."}</p>
    ${
      web.secciones?.length
        ? `<div class="titulo-seccion"><h2>Qué tiene</h2></div>
           <ul class="lista-simple">${web.secciones.map((s) => `<li class="hecho">${esc(s)}</li>`).join("")}</ul>`
        : ""
    }

    <div class="titulo-seccion"><h2>Pendientes</h2><small>${pendientes.filter((p) => !p.hecho).length || ""}</small></div>
    ${
      pendientes.length
        ? `<ul class="lista-simple">${pendientes
            .map(
              (p) =>
                `<li class="${p.hecho ? "hecho" : ""}">${esc(p.texto)}</li>`,
            )
            .join("")}</ul>`
        : `<p class="vacio">Nada pendiente en tu página.</p>`
    }
    </div></div>
  `;

  cont
    .querySelector("[data-ampliar-captura]")
    ?.addEventListener("click", () =>
      abrirHoja(
        `<div class="hoja__cabeza"><h2 id="hoja-titulo">Vista previa</h2><button class="cerrar" data-cerrar aria-label="Cerrar">×</button></div><img src="${esc(captura)}" alt="Vista previa de la página de ${esc(negocio.nombre)}" />`,
      ),
    );

  cont
    .querySelector('[data-accion="cambio-web"]')
    .addEventListener("click", () =>
      abrirHoja(
        `<div class="hoja__cabeza"><h2 id="hoja-titulo">¿Qué cambiamos en tu web?</h2><button class="cerrar" data-cerrar aria-label="Cerrar">×</button></div>
       <label for="cambio-web" class="eyebrow">Tu comentario</label>
       <textarea id="cambio-web" placeholder="Ej. actualizar horarios, agregar un producto, cambiar una foto…"></textarea>
       <button type="button" class="boton" data-enviar>Mandar a Mecha</button>`,
        (hoja) =>
          hoja.querySelector("[data-enviar]").addEventListener("click", () => {
            const texto = hoja.querySelector("#cambio-web").value.trim();
            if (!texto) {
              avisar("Escribe qué cambiamos en tu página");
              return;
            }
            const liga = ligaWhatsApp(
              negocio.contacto_mecha?.whatsapp,
              `🌐 Cambio para la web de ${negocio.nombre}:\n${texto}`,
            );
            cerrarHoja();
            if (liga) window.open(liga, "_blank", "noopener");
            else avisar("Falta el WhatsApp de Mecha para mandarlo.");
          }),
      ),
    );
}
