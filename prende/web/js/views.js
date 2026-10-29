import {
  roles,
  fields,
  numericQuestions,
  diagnosis,
  levelFor,
  nextChallenge,
} from "./domain.js";
import {
  esc,
  icon,
  link,
  fuse,
  highlightedPrompt,
  plainText,
  chatButtons,
  whatsapp,
} from "./ui.js";

const heading = (eyebrow, title, subtitle = "") =>
  `<header class="page-heading"><p class="eyebrow">${esc(eyebrow)}</p><h1 tabindex="-1">${esc(title)}</h1>${subtitle ? `<p class="lead">${esc(subtitle)}</p>` : ""}</header>`;
const sectionHead = (title, href, label = "Ver todas") =>
  `<div class="section-heading"><h2>${esc(title)}</h2>${href ? `<a class="text-link" href="${esc(href)}">${esc(label)} ↗</a>` : ""}</div>`;
const levelName = (level) => ["", "Básica", "Intermedia", "Avanzada"][level];
export function recipeCard(r, ctx) {
  const name = ctx.data.recetas.sintomas.find(
    (s) => s.id === r.sintoma,
  )?.nombre;
  return `<article class="recipe-card"><div class="card-meta"><span>${r.nivel} · ${levelName(r.nivel)}</span><button class="favorite ${ctx.state.favoritas.includes(r.id) ? "selected" : ""}" data-action="favorite" data-id="${esc(r.id)}" aria-label="Guardar ${esc(r.titulo)} en favoritas" aria-pressed="${ctx.state.favoritas.includes(r.id)}">${icon("star")}</button></div><a href="#/recetas/${esc(r.id)}" class="recipe-title"><h3>${esc(r.titulo)}</h3>${icon("arrow")}</a><p><span class="muted">Resuelve:</span> ${esc(r.resuelve)}</p><span class="symptom-label">${esc(name)}</span></article>`;
}
export function welcome(ctx) {
  const f = fields[ctx.onboarding.step];
  return `<section class="welcome"><div class="welcome-intro"><p class="eyebrow">PRIMERA CHISPA / PRENDE TU NEGOCIO</p><h1 tabindex="-1">La IA ya puede ayudarte hoy. <span>Te enseñamos a usarla con tu negocio adentro.</span></h1><p class="lead">Usa la IA en tu negocio desde hoy.</p><img src="assets/img/robot-busto-480.webp" width="480" height="480" class="welcome-robot" alt="El robot de Mecha, con su visor rojo" /></div><div class="welcome-form"><div class="step-label"><span>Vamos conociendo tu negocio</span><span>${ctx.onboarding.step + 1} / ${fields.length}</span></div><div class="step-track"><span style="width:${((ctx.onboarding.step + 1) / fields.length) * 100}%"></span></div><form id="welcome-form"><label class="question" for="welcome-value">${esc(f.question)}</label><p class="muted">${esc(f.hint)}</p>${
    f.key === "rol"
      ? `<select id="welcome-value" name="value" required><option value="">Elige tu rol</option>${Object.entries(
          roles,
        )
          .map(
            ([id, name]) =>
              `<option value="${id}" ${ctx.onboarding.profile.rol === id ? "selected" : ""}>${name}</option>`,
          )
          .join("")}</select>`
      : `<input id="welcome-value" name="value" autocomplete="${f.key === "negocio" ? "organization" : "off"}" maxlength="200" required value="${esc(ctx.onboarding.profile[f.key])}" placeholder="${esc(f.placeholder || "Escribe o elige una opción")}" />`
  }${f.choices ? `<div class="chips">${f.choices.map((v) => `<button type="button" class="chip" data-action="welcome-choice" data-value="${esc(v)}">${esc(roles[v] || v)}</button>`).join("")}</div>` : ""}<div class="actions">${ctx.onboarding.step ? '<button type="button" class="button secondary" data-action="welcome-back">Atrás</button>' : ""}<button class="button primary" type="submit">${ctx.onboarding.step === fields.length - 1 ? "Prender mi negocio" : "Continuar"}${icon("arrow")}</button></div></form><button class="text-button skip-onboarding" data-action="skip-welcome">Saltar por ahora</button><p class="micro">Sin cuentas. Tus datos se quedan en este navegador.</p></div></section>`;
}
export function home(ctx) {
  const { state, data } = ctx;
  const level = levelFor(data.ruta, state.ruta.hechos.length);
  const next = nextChallenge(data.ruta, state.ruta.hechos);
  const leaks = diagnosis(state.radiografia, data.recetas.sintomas).slice(0, 3);
  const recommended = [...data.recetas.recetas]
    .filter((r) => !state.perfil?.rol || r.rol.includes(state.perfil.rol))
    .sort(
      (a, b) =>
        Number(state.radiografia.sintomas?.includes(b.sintoma) || false) -
        Number(state.radiografia.sintomas?.includes(a.sintoma) || false),
    )
    .slice(0, 3);
  return `${heading("TU NEGOCIO YA TIENE TODO. FALTA PRENDERLO.", state.perfil?.negocio ? `Vamos, ${state.perfil.negocio}.` : "Hoy puede empezar algo bueno.", "Una receta, un pendiente menos. A tu ritmo.")}<section class="home-hero"><div class="hero-copy"><span class="badge"><span class="tiny-ember"></span>${esc(level.nombre)}</span><h2>Una pequeña chispa.<br />Un negocio más ligero.</h2><p>La IA se aprende usándola.<br />Empecemos con algo de tu día.</p>${link("#/ruta", "Prende en 30", "primary")}</div><img src="assets/img/robot-busto-480.webp" width="480" height="480" class="hero-robot" alt="Tu compañero de Mecha" /></section><section class="route-preview panel"><div class="section-heading"><h2>Tu mecha va así</h2><span class="micro">${state.ruta.hechos.length} retos hechos</span></div>${fuse(state.ruta.hechos)}<div class="today"><div><p class="eyebrow">${next ? `DÍA ${next.dia} DE 30` : "LOS 30 RETOS, HECHOS"}</p><h3>${esc(next?.titulo || "Ya prendiste tu negocio.")}</h3><p class="muted">${esc(next?.detalle || level.texto)}</p></div>${link(next ? challengeLink(next) : "#/ruta", next ? "Hacer el reto" : "Ver mi recorrido", "primary")}</div></section><section class="diagnosis-preview"><div class="mini-icon">${icon("radiografia")}</div><div><h2>Tu Radiografía</h2>${state.radiografia.fecha ? `<ul class="leak-list">${leaks.map((s) => `<li>${esc(s.nombre)} <strong>${s.horas == null ? "sin datos" : `≈ ${formatHours(s.horas)} h/mes`}</strong></li>`).join("")}</ul>` : '<p class="muted">Descubre dónde se te va el día.<br />Con tus números, no con los de nadie más.</p>'}</div><a class="icon-button" href="#/radiografia" aria-label="Abrir tu Radiografía">${icon("arrow")}</a></section><section>${sectionHead("Recetas para ti", "#/recetas")}<div class="recipe-grid">${recommended.map((r) => recipeCard(r, ctx)).join("")}</div></section><section class="home-mesa">${sectionHead("Saca ese pendiente", "#/mesa", "Ir a la Mesa")}<form id="home-mesa-form"><label class="sr-only" for="home-request">¿Qué necesitas resolver hoy?</label><textarea id="home-request" name="pedido" maxlength="4000" required placeholder="¿Qué necesitas resolver hoy?" rows="3"></textarea><button class="button primary" type="submit">Pídele a Mecha${icon("arrow")}</button></form></section><section class="dark-block"><p class="eyebrow">CUANDO QUIERAS DAR EL SIGUIENTE PASO</p><h2>¿Ya no te alcanza el tiempo para hacerlo tú?</h2><p>Aprende tú, o que lo haga Mecha. Tú decides hasta dónde.</p>${link("#/paquetes", "Conoce los paquetes", "on-dark")}</section><div class="home-links"><a href="#/reglas">Reglas de la casa ↗</a><a href="#/ajustes">Tu perfil y ajustes ↗</a></div>`;
}
export function formatHours(value) {
  return value.toLocaleString("es-MX", { maximumFractionDigits: 1 });
}
export function challengeLink(r) {
  if (r.receta) return `#/recetas/${r.receta}`;
  if (r.accion === "perfil") return "#/ajustes";
  return `#/${r.accion === "libre" ? "ruta" : r.accion}`;
}
export function radiography(ctx) {
  const selected = ctx.radio.sintomas;
  const step = ctx.radio.step;
  return `${heading("RADIOGRAFÍA", "¿Dónde se te va el día?", "Con tus números, no con los de nadie más.")}<div class="process-tabs"><span class="${step === 1 ? "active" : ""}">01 · Lo que te pasa</span><span class="${step === 2 ? "active" : ""}">02 · Tus números</span><span class="${step === 3 ? "active" : ""}">03 · Tu Radiografía</span></div>${
    step === 1
      ? `<section><h2>¿Te suena alguna?</h2><p class="muted">Marca todo lo que te pasa en el negocio.</p><div class="symptom-grid">${ctx.data.recetas.sintomas.map((s, i) => `<button class="symptom-option ${selected.includes(s.id) ? "selected" : ""}" data-action="symptom" data-id="${s.id}" aria-pressed="${selected.includes(s.id)}"><span class="symptom-number">0${i + 1}</span><span>${esc(s.nombre)}</span><span class="check-box">${selected.includes(s.id) ? icon("check") : ""}</span></button>`).join("")}</div><button class="button primary" data-action="radio-next" ${!selected.length ? "disabled" : ""}>Ahora, tus números${icon("arrow")}</button></section>`
      : step === 2
        ? `<form id="radio-form"><p class="muted">Una aproximación tuya basta. Puedes dejar un campo vacío: diremos “sin datos”.</p>${ctx.data.recetas.sintomas
            .filter((s) => selected.includes(s.id))
            .map(
              (s) =>
                `<fieldset class="numeric-group"><legend>${esc(s.nombre)}</legend>${numericQuestions[s.id].map((q) => `<label for="${s.id}-${q.key}">${esc(q.label)}</label><input id="${s.id}-${q.key}" name="${s.id}.${q.key}" type="number" min="0" step="any" inputmode="decimal" value="${esc(ctx.radio.numeros[s.id]?.[q.key])}" placeholder="Sin datos" />`).join("")}</fieldset>`,
            )
            .join(
              "",
            )}<div class="actions"><button type="button" class="button secondary" data-action="radio-back">Atrás</button><button class="button primary" type="submit">Ver mi Radiografía${icon("arrow")}</button></div></form>`
        : radioResult(ctx)
  }`;
}
function radioResult(ctx) {
  const results = diagnosis(ctx.state.radiografia, ctx.data.recetas.sintomas);
  const max = Math.max(...results.map((s) => s.horas || 0), 1);
  const total = results.reduce((sum, s) => sum + (s.horas || 0), 0);
  const p = ctx.state.perfil;
  const message = `Hola, vengo de Prende. Esta es mi Radiografía.\nNegocio: ${p.negocio || "[tu negocio]"}\nGiro: ${p.giro || "[tu giro]"}\nCiudad: ${p.ciudad || "[tu ciudad]"}\n${results.map((s) => `${s.nombre}: ${s.horas == null ? "sin datos" : `≈ ${formatHours(s.horas)} horas al mes`}`).join("\n")}`;
  return `<section><div class="result-total"><p class="eyebrow">TIEMPO QUE HOY LE DEDICAS</p><p class="big-number">${total ? `≈ ${formatHours(total)}` : "Sin datos"}${total ? "<span>horas al mes</span>" : ""}</p><p class="muted">Suma de las actividades con datos. No es una promesa de ahorro; si se cruzan, puede haber tiempo contado dos veces.</p></div><div class="results">${results
    .map((s) => {
      const recipe = ctx.data.recetas.recetas.find((r) => r.sintoma === s.id);
      return `<article class="result-row"><div class="section-heading"><h3>${esc(s.nombre)}</h3><strong>${s.horas == null ? "sin datos" : `≈ ${formatHours(s.horas)} h/mes`}</strong></div><div class="bar-track"><span style="width:${s.horas == null ? 0 : (s.horas / max) * 100}%"></span></div><div class="result-links">${link(`#/recetas/${recipe.id}`, "Hazlo tú", "compact")}${link(`#/paquetes/${recipe.paquete}`, "Que lo haga Mecha", "compact")}</div></article>`;
    })
    .join(
      "",
    )}</div><details class="calculation"><summary>¿Cómo lo calculamos?</summary><p>Mensajes al día × minutos por mensaje × 30 ÷ 60. Cotizaciones o citas a la semana × minutos por cada una × 4.33 ÷ 60. Horas semanales de redes o administración × 4.33. Horas mensuales de competencia: el número que escribiste.</p><p>Usamos ≈ porque los meses y las semanas varían. Cero o un campo vacío se muestra como “sin datos”.</p></details><div class="actions"><a href="${esc(whatsapp(message))}" target="_blank" rel="noopener noreferrer" class="button primary">Mandarle mi Radiografía a Mecha${icon("arrow")}</a><button class="button secondary" data-action="radio-edit">Actualizar mis números</button></div></section>`;
}
export function recipeList(ctx) {
  const f = ctx.filters;
  return `${heading("EL RECETARIO", "Menos vueltas. Más hecho.", "Recetas concretas, ya escritas con tu negocio adentro.")}<section class="filters" aria-label="Filtrar recetas"><label class="sr-only" for="recipe-search">Buscar recetas</label><input type="search" id="recipe-search" placeholder="¿Qué necesitas resolver?" value="${esc(f.q)}" /><div class="chips"><button class="chip ${!f.sintoma ? "selected" : ""}" data-action="filter-symptom" data-id="" aria-pressed="${!f.sintoma}">Todas</button>${ctx.data.recetas.sintomas.map((s) => `<button class="chip ${f.sintoma === s.id ? "selected" : ""}" data-action="filter-symptom" data-id="${s.id}" aria-pressed="${f.sintoma === s.id}">${esc(s.nombre)}</button>`).join("")}</div><div class="filter-row"><label>Tu rol<select id="filter-role"><option value="">Todos los roles</option>${Object.entries(
    roles,
  )
    .map(
      ([id, name]) =>
        `<option value="${id}" ${f.rol === id ? "selected" : ""}>${name}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Nivel<select id="filter-level"><option value="">Todos los niveles</option>${[1, 2, 3].map((n) => `<option value="${n}" ${Number(f.nivel) === n ? "selected" : ""}>${n} · ${levelName(n)}</option>`).join("")}</select></label><button class="chip favorite-filter ${f.favoritas ? "selected" : ""}" data-action="filter-favorites" aria-pressed="${f.favoritas}">★ Favoritas</button></div></section><div id="recipe-results" aria-live="polite">${recipeResults(ctx)}</div>`;
}
export function recipeResults(ctx) {
  const f = ctx.filters;
  const normalize = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const recipes = ctx.data.recetas.recetas.filter(
    (r) =>
      (!f.sintoma || r.sintoma === f.sintoma) &&
      (!f.rol || r.rol.includes(f.rol)) &&
      (!f.nivel || r.nivel === Number(f.nivel)) &&
      (!f.favoritas || ctx.state.favoritas.includes(r.id)) &&
      normalize(`${r.titulo} ${r.resuelve}`).includes(normalize(f.q)),
  );
  return `<p class="micro result-count">${recipes.length} ${recipes.length === 1 ? "receta" : "recetas"}</p><div class="recipe-grid">${recipes.map((r) => recipeCard(r, ctx)).join("")}</div>${!recipes.length ? '<div class="empty-state"><h2>No encontramos una receta con esos filtros.</h2><p>Prueba con otra palabra o quita un filtro.</p><button class="button secondary" data-action="reset-filters">Ver todas las recetas</button></div>' : ""}`;
}
export function recipeDetail(ctx, id) {
  const r = ctx.data.recetas.recetas.find((r) => r.id === id);
  if (!r) return notFound();
  const packageName = allPackages(ctx).find((p) => p.id === r.paquete)?.nombre;
  const next = nextChallenge(ctx.data.ruta, ctx.state.ruta.hechos);
  return `<a class="back-link" href="#/recetas">← El recetario</a>${heading(`RECETA / ${r.nivel} · ${levelName(r.nivel)}`, r.titulo, r.resuelve)}<div class="actions recipe-toolbar"><button class="button secondary" data-action="favorite" data-id="${r.id}" aria-pressed="${ctx.state.favoritas.includes(r.id)}">${icon("star")}${ctx.state.favoritas.includes(r.id) ? "Guardada" : "Guardar en favoritas"}</button><button class="button secondary" data-action="recipe-done" data-id="${r.id}" ${ctx.state.ruta.recetas.includes(r.id) && next?.receta !== r.id ? "disabled" : ""}>${icon("check")}${ctx.state.ruta.recetas.includes(r.id) ? "La hice · repetir" : "La hice"}</button></div><section class="recipe-steps"><h2>Manos a la obra</h2><ol>${r.pasos.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section><section class="prompt-section"><div class="section-heading"><h2>La receta</h2><span class="micro">LISTA PARA COPIAR</span></div><p class="micro">Lo resaltado viene de tu perfil. Los huecos son tuyos: llénalos antes de pedir la respuesta.</p><div class="prompt-text">${highlightedPrompt(r.prompt, ctx.state.perfil)}</div>${chatButtons()}<button class="text-button" data-action="recipe-mesa" data-id="${r.id}">Hacerla aquí, en la Mesa ${icon("arrow")}</button></section><div class="quality-grid"><section><p class="eyebrow">ASÍ SABES QUE SALIÓ BIEN</p><p>${esc(r.bienHecho)}</p></section><section><p class="eyebrow">EL ERROR COMÚN</p><p>${esc(r.errorComun)}</p></section></div><section class="dark-block"><p class="eyebrow">EL TECHO</p><h2>Hasta aquí puedes hacerlo tú.</h2><p>${esc(r.techo)}</p>${link(`#/paquetes/${r.paquete}`, `Conoce ${packageName}`, "on-dark")}</section>`;
}
export function mesa(ctx) {
  return `${heading("MESA DE TRABAJO", "Pídele a Mecha.", "Escribe lo que necesitas como se lo dirías a alguien de tu equipo.")}<p id="mesa-status" class="connection-note">${ctx.api === true ? "La Mesa con IA está conectada." : ctx.api === null ? "Revisando la conexión de la Mesa…" : "La Mesa con IA no está conectada; te armamos la receta para que la uses en tu chat de IA"}</p><form id="mesa-form"><label class="sr-only" for="mesa-request">¿Qué necesitas resolver hoy?</label><textarea id="mesa-request" name="pedido" maxlength="4000" rows="7" placeholder="Cuéntame qué está pasando y qué necesitas…" required>${esc(ctx.mesaDraft)}</textarea><p class="privacy-note">No pegues contraseñas, tarjetas ni datos personales de tus clientes.</p><div class="example-list"><span class="micro">PRUEBA CON ALGO ASÍ</span>${["Contéstale a un cliente que dice que llegó tarde su pedido", "Ideas de promoción para el puente", "Un mensaje para cobrarle a un cliente que debe"].map((t) => `<button type="button" data-action="mesa-example" data-value="${esc(t)}">${esc(t)} ↗</button>`).join("")}</div><button class="button primary" id="mesa-send" type="submit" ${ctx.busy ? "disabled" : ""}>${ctx.busy ? '<span class="ember" aria-hidden="true"></span> Mecha está trabajando…' : `Resolver este pendiente${icon("arrow")}`}</button></form><section id="mesa-response" class="mesa-response" role="status" aria-live="polite" aria-atomic="true">${ctx.mesaResult ? mesaResult(ctx.mesaResult, ctx) : ""}</section><section class="history">${sectionHead("Tus últimos pedidos")}<p class="micro">Solo en este navegador. Hasta 10 pedidos.</p>${ctx.state.mesa.length ? ctx.state.mesa.map((entry, i) => `<details><summary>${esc(entry.pedido)}</summary><p class="micro">${esc(new Date(entry.fecha).toLocaleDateString("es-MX"))}</p>${mesaResult(entry, ctx, i)}</details>`).join("") : '<p class="muted">Aquí aparecerá lo que vayas resolviendo.</p>'}</section>`;
}
export function mesaResult(entry, ctx, index = null) {
  const response = entry.resultado;
  const r = ctx.data.recetas.recetas.find((r) => r.id === response.receta);
  const p = allPackages(ctx).find((p) => p.id === response.paquete);
  return `<article class="response-card"><p class="eyebrow">${entry.offline ? "TU RECETA PARA LLEVAR" : response.tipo === "servicio" ? "Esto ya es trabajo de Mecha" : response.tipo === "receta" ? "Esto te va a volver a pasar: guarda esta receta" : "Listo"}</p><div class="response-text">${plainText(response.respuesta)}</div><div class="actions"><button class="button secondary" data-action="copy-response" ${index !== null ? `data-index="${index}"` : ""}>Copiar${entry.offline ? " receta" : " respuesta"}</button>${entry.offline ? `<button class="button secondary" data-action="response-chat" data-chat="chatgpt" ${index !== null ? `data-index="${index}"` : ""}>Abrir en ChatGPT</button><button class="button secondary" data-action="response-chat" data-chat="claude" ${index !== null ? `data-index="${index}"` : ""}>Abrir en Claude</button>` : ""}</div>${response.razon ? `<p>${plainText(response.razon)}</p>` : ""}${response.siguiente_paso ? `<p><strong>Siguiente paso:</strong> ${plainText(response.siguiente_paso)}</p>` : ""}${response.aviso ? `<p class="notice">${plainText(response.aviso)}</p>` : ""}${r ? recipeCard(r, ctx) : ""}${p ? `<div class="suggested-package"><h3>${esc(p.nombre)}</h3><p>${esc(p.para)}</p>${link(`#/paquetes/${p.id}`, "Conoce el paquete")}</div>` : ""}</article>`;
}
export function route(ctx) {
  const { state, data } = ctx;
  const level = levelFor(data.ruta, state.ruta.hechos.length);
  return `${heading("UN RETO A LA VEZ", "Prende en 30.", "Puedes adelantarte o saltarte un día. Aquí no hay castigos.")}<section class="route-overview panel"><div class="section-heading"><span class="badge"><span class="tiny-ember"></span>${esc(level.nombre)}</span><strong>${state.ruta.hechos.length} / 30</strong></div>${fuse(state.ruta.hechos, true)}<p>${esc(level.texto)}</p></section>${data.ruta.semanas.map((s, i) => `<section class="week"><div class="section-heading"><h2>${esc(s.titulo)}</h2><span class="micro">${s.retos.filter((r) => state.ruta.hechos.includes(r.dia)).length} / ${s.retos.length}</span></div><div class="challenges">${s.retos.map((r) => `<article class="challenge ${state.ruta.hechos.includes(r.dia) ? "done" : ""}" id="dia-${r.dia}"><span class="day-number">${state.ruta.hechos.includes(r.dia) ? icon("check") : String(r.dia).padStart(2, "0")}</span><div class="challenge-content"><h3>${esc(r.titulo)}</h3><p class="muted">${esc(r.detalle)}</p><div class="actions">${r.accion !== "libre" ? link(challengeLink(r), r.receta ? "Abrir receta" : "Ir al reto", "compact") : ""}<button class="button compact" data-action="challenge-done" data-day="${r.dia}" aria-pressed="${state.ruta.hechos.includes(r.dia)}">${state.ruta.hechos.includes(r.dia) ? "Hecha · desmarcar" : "La hice"}</button></div></div></article>`).join("")}</div></section>`).join("")}${state.ruta.hechos.length === 30 ? `<section class="dark-block"><p class="eyebrow">MECHA COMPLETA</p><h2>Ya trabajas con IA.</h2><p>Completaste 30 retos, hiciste ${state.ruta.recetas.length} recetas y guardaste ${state.favoritas.length} favoritas. Lo siguiente es decidir qué quieres que trabaje solo.</p>${link("#/paquetes", "Ver los paquetes de Mecha", "on-dark")}</section>` : ""}`;
}
const rules = [
  {
    name: "Verde, adelante",
    type: "go",
    items: [
      "Textos para redes",
      "Borradores de correos y mensajes",
      "Ideas",
      "Resúmenes de tus propios documentos sin datos de clientes",
      "Explicar un tema",
      "Revisar ortografía",
    ],
  },
  {
    name: "Amarillo, con cuidado",
    type: "careful",
    items: [
      "Listas de precios y costos (mejor en herramientas de cuenta de empresa)",
      "Ventas sin nombres de clientes",
      "Contratos (para entenderlos, no para firmarlos sin abogado)",
      "Cualquier dato que la IA te dé como hecho: verifícalo",
    ],
  },
  {
    name: "Rojo, nunca",
    type: "stop",
    items: [
      "Contraseñas",
      "Números de tarjeta o cuentas",
      "RFC/CURP/INE de clientes o empleados",
      "Datos de salud",
      "Conversaciones con nombre y teléfono de clientes",
      "Información que firmaste no compartir",
    ],
  },
];
export function houseRules(ctx) {
  return `${heading("REGLAS DE LA CASA", "Lo que sí y lo que nunca le das a una IA.", "Úsala con confianza. Cuida lo que compartes.")}<div class="rules-grid">${rules.map((r, i) => `<section class="rule-block ${r.type}"><p class="eyebrow">0${i + 1} / ${["ADELANTE", "REVISA", "NO LO COMPARTAS"][i]}</p><h2>${r.name}</h2><ul>${r.items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>`).join("")}</div><section class="rules-generator panel"><h2>Genera tus reglas</h2><p class="muted">Una hoja para poner donde la vea tu equipo.</p><label for="rules-owner">¿A quién le preguntan si tienen duda?</label><input id="rules-owner" maxlength="200" placeholder="Nombre del responsable" value="${esc(ctx.state.preferencias.responsable)}" /><button class="button primary" data-action="print-rules">Imprimir${icon("arrow")}</button></section><article id="print-sheet" class="print-sheet"><p class="eyebrow">PRENDE / MECHA</p><h2>Reglas de IA de ${ctx.state.perfil.negocio ? esc(ctx.state.perfil.negocio) : '<span class="pendiente">[tu negocio]</span>'}</h2>${rules.map((r) => `<section><h3>${r.name}</h3><ul>${r.items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></section>`).join("")}<p>Si tienes duda, pregunta a <span id="printed-owner">${ctx.state.preferencias.responsable ? esc(ctx.state.preferencias.responsable) : '<span class="pendiente">[responsable]</span>'}</span>.</p><p>${esc(new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }))}</p></article>`;
}
export function allPackages(ctx) {
  return [...ctx.data.paquetes.aprender, ...ctx.data.paquetes.implementar];
}
export function packages(ctx, id) {
  const recommended = id || ctx.recommendedPackage;
  const profile = ctx.state.perfil;
  return `${heading("EL SIGUIENTE PASO ES TUYO", "Aprende tú, o que lo haga Mecha.", "Si con una receta basta, quédate con la receta.")}${[
    ["aprender", "Aprender"],
    ["implementar", "Que lo haga Mecha"],
  ]
    .map(
      ([key, title]) =>
        `<section class="package-group">${sectionHead(title)}${ctx.data.paquetes[key].map((p) => `<article class="package-card ${p.id === recommended ? "recommended" : ""}" id="paquete-${p.id}"><div class="section-heading"><h3>${esc(p.nombre)}</h3>${p.id === recommended ? '<span class="badge">Para ti</span>' : ""}</div><p class="muted">${esc(p.para)}</p><ul>${p.incluye.map((t) => `<li>${esc(t)}</li>`).join("")}</ul><p class="package-price ${p.pendiente ? "pendiente" : ""}">${esc(p.precio)}</p><a class="button ${p.id === recommended ? "primary" : "secondary"}" href="${esc(whatsapp(`Hola, vengo de Prende y me interesa ${p.nombre}. Mi negocio: ${profile.negocio || "[tu negocio]"}, ${profile.giro || "[tu giro]"}, ${profile.ciudad || "[tu ciudad]"}.`))}" target="_blank" rel="noopener noreferrer">${p.id === "prende" ? "Hablar con Mecha" : "Me interesa"}${icon("arrow")}</a></article>`).join("")}</section>`,
    )
    .join(
      "",
    )}<p class="micro">${esc(ctx.data.paquetes.letraChica)}</p><p class="micro">Precios orientativos hasta que Mecha los confirme contigo.</p>`;
}
export function settings(ctx) {
  return `${heading("AJUSTES", "Tu negocio, a tu manera.", "Un perfil completo hace que cada receta suene más a ti.")}<form id="profile-form" class="profile-form">${fields
    .map(
      (f) =>
        `<label for="profile-${f.key}">${esc(f.question)}</label>${
          f.key === "rol"
            ? `<select id="profile-rol" name="rol"><option value="">Sin definir</option>${Object.entries(
                roles,
              )
                .map(
                  ([id, name]) =>
                    `<option value="${id}" ${ctx.state.perfil.rol === id ? "selected" : ""}>${name}</option>`,
                )
                .join("")}</select>`
            : `<input id="profile-${f.key}" name="${f.key}" maxlength="200" value="${esc(ctx.state.perfil[f.key])}" placeholder="${esc(f.placeholder || f.choices?.join(" · "))}" />`
        }`,
    )
    .join(
      "",
    )}<button class="button primary" type="submit">Guardar mi perfil${icon("check")}</button></form><section class="settings-section"><h2>Cómo se ve Prende</h2><label for="theme-select">Tema</label><select id="theme-select">${[
    ["sistema", "Como mi dispositivo"],
    ["light", "Claro"],
    ["dark", "Oscuro"],
  ]
    .map(
      ([id, name]) =>
        `<option value="${id}" ${ctx.state.preferencias.tema === id ? "selected" : ""}>${name}</option>`,
    )
    .join(
      "",
    )}</select></section><section class="settings-section"><h2>Tu equipo</h2><p class="muted">Una receta útil también se comparte.</p>${link("#/equipo", "Compartir Prende con mi equipo")}</section><section class="settings-section"><h2>Tus datos son tuyos</h2><p class="muted">Se guardan en este navegador, sin cuenta. Exporta una copia antes de cambiar de dispositivo.</p><p class="micro">${ctx.storageAvailable ? "El guardado local está disponible." : "Tu navegador no permite guardar datos. Prende funciona durante esta sesión."}</p><div class="actions"><button class="button secondary" data-action="export">Exportar</button><button class="text-button danger" data-action="delete">Borrar mis datos</button></div></section><p class="made-by">Hecho por Mecha · Automatización e IA para PyMEs · Aguascalientes, México</p>`;
}
export function team(ctx) {
  return `${heading("MEJOR EN EQUIPO", "Comparte Prende con tu equipo", "Mándales una entrada al recetario pensada para lo que hacen.")}<section class="panel"><label for="team-role">¿Qué hace esa persona?</label><select id="team-role">${Object.entries(
    roles,
  )
    .map(
      ([id, name]) =>
        `<option value="${id}" ${ctx.teamRole === id ? "selected" : ""}>${name}</option>`,
    )
    .join(
      "",
    )}</select><p class="micro">La liga abre con este filtro de rol. Tu perfil y tus datos se quedan contigo.</p><label for="team-link">Liga para compartir</label><input id="team-link" readonly value="${esc(ctx.teamLink)}" /><button class="button primary" data-action="share-team">Compartir${icon("arrow")}</button></section>`;
}
export function notFound() {
  return `${heading("ESTA LIGA NO EXISTE", "Volvamos a prender.", "No encontramos esta pantalla o receta.")}${link("#/inicio", "Ir a Inicio", "primary")}`;
}
