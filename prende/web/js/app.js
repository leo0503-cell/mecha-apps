import { state, save, clear, applyTheme, storageAvailable } from "./state.js";
import {
  fields,
  roles,
  personalize,
  levelFor,
  nextChallenge,
  diagnosis,
  closestRecipe,
  offlinePrompt,
} from "./domain.js";
import { esc, icon, toast, copy, openChat } from "./ui.js";
import * as views from "./views.js";

const main = document.querySelector("#contenido");
const navigation = document.querySelector("#navigation");
const menu = document.querySelector("#more-menu");
const menuToggle = document.querySelector("#menu-toggle");
const navItems = [
  ["inicio", "Inicio"],
  ["radiografia", "Radiografía"],
  ["recetas", "Recetas"],
  ["mesa", "Mesa"],
  ["ruta", "Ruta"],
];
let data;
let api = null;
let currentPage = "inicio";
let currentId = "";
let currentPrompt = "";
let recommendedPackage = "";
let welcomeReturn = "";
let onboarding = { step: 0, profile: {} };
let radio = {
  step: state.radiografia.fecha ? 3 : 1,
  sintomas: [...(state.radiografia.sintomas || [])],
  numeros: structuredClone(state.radiografia.numeros || {}),
};
let filters = { q: "", sintoma: "", rol: "", nivel: "", favoritas: false };
let mesaDraft = "";
let mesaResult = null;
let busy = false;
let mesaGeneration = 0;
let teamRole = "ventas";
function teamLink() {
  return `${location.href.split("#")[0]}#/recetas?rol=${encodeURIComponent(teamRole)}`;
}
function context() {
  return {
    state,
    data,
    onboarding,
    radio,
    filters,
    api,
    mesaDraft,
    mesaResult,
    busy,
    teamRole,
    teamLink: teamLink(),
    recommendedPackage,
    storageAvailable,
  };
}
function persist() {
  if (!save())
    toast("No pudimos guardar. Puedes seguir usando Prende en esta sesión.");
}
function navigate(path) {
  if (location.hash === `#/${path}`) render();
  else location.hash = `#/${path}`;
}
function closeMenu() {
  menu.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
}
function focusHeading() {
  main.querySelector("h1")?.focus({ preventScroll: true });
}
function render(focus = true) {
  if (!data) return;
  closeMenu();
  const [path, query = ""] = (location.hash.slice(1) || "/inicio").split("?");
  const segments = path.split("/").filter(Boolean);
  currentPage = segments[0] || "inicio";
  currentId = segments[1] || "";
  if (currentPage === "recetas" && !currentId) {
    const role = new URLSearchParams(query).get("rol");
    if (role && roles[role]) filters.rol = role;
  }
  const isWelcome = !state.perfil;
  document.body.classList.toggle("is-welcome", isWelcome);
  navigation.innerHTML =
    navItems
      .map(
        ([id, label]) =>
          `<a href="#/${id}" class="nav-item ${currentPage === id ? "active" : ""}" ${currentPage === id ? 'aria-current="page"' : ""}>${icon(id)}<span>${label}</span><span class="nav-active-dot" aria-hidden="true"></span></a>`,
      )
      .join("") +
    '<div class="sidebar-bottom"><span class="tiny-ember"></span><p>Usa la IA en tu negocio<br />desde hoy.</p><a href="#/reglas">Reglas de la casa ↗</a><a href="#/ajustes">Ajustes ↗</a><span class="micro">HECHO EN AGUASCALIENTES</span></div>';
  if (isWelcome) main.innerHTML = views.welcome(context());
  else {
    const ctx = context();
    const screens = {
      inicio: views.home,
      radiografia: views.radiography,
      mesa: views.mesa,
      ruta: views.route,
      reglas: views.houseRules,
      ajustes: views.settings,
      equipo: views.team,
    };
    if (currentPage === "recetas") {
      const recipe = data.recetas.recetas.find((r) => r.id === currentId);
      if (recipe) {
        currentPrompt = personalize(recipe.prompt, state.perfil);
        recommendedPackage = recipe.paquete;
      }
      main.innerHTML = currentId
        ? views.recipeDetail(ctx, currentId)
        : views.recipeList(ctx);
    } else if (currentPage === "paquetes") {
      main.innerHTML = views.packages(ctx, currentId);
    } else main.innerHTML = (screens[currentPage] || views.notFound)(ctx);
  }
  document.title = isWelcome
    ? "Prende tu negocio — Prende de Mecha"
    : `${main.querySelector("h1")?.textContent || "Prende"} — Prende de Mecha`;
  if (focus) {
    window.scrollTo(0, 0);
    focusHeading();
  }
  if (!isWelcome && currentPage === "paquetes" && currentId) {
    document
      .getElementById(`paquete-${currentId}`)
      ?.scrollIntoView({ block: "center", behavior: "instant" });
  }
}
function refreshRecipes() {
  document.querySelector("#recipe-results").innerHTML =
    views.recipeResults(context());
}
function markDay(day, toggle = false) {
  const previous = levelFor(data.ruta, state.ruta.hechos.length);
  if (state.ruta.hechos.includes(day)) {
    if (toggle) state.ruta.hechos = state.ruta.hechos.filter((d) => d !== day);
  } else state.ruta.hechos.push(day);
  state.ruta.hechos.sort((a, b) => a - b);
  state.ruta.ultimo = new Date().toISOString();
  const challenge = data.ruta.semanas
    .flatMap((s) => s.retos)
    .find((r) => r.dia === day);
  if (
    challenge?.receta &&
    !state.ruta.recetas.includes(challenge.receta) &&
    state.ruta.hechos.includes(day)
  )
    state.ruta.recetas.push(challenge.receta);
  persist();
  const next = levelFor(data.ruta, state.ruta.hechos.length);
  if (next.desde > previous.desde) toast(`Ya eres ${next.nombre}`);
}
function finishWelcome() {
  state.perfil = { ...onboarding.profile };
  // El reto del día 1 es justo llenar el perfil: si ya hay negocio, cuenta.
  if (state.perfil.negocio?.trim() && !state.ruta.hechos.includes(1))
    markDay(1);
  persist();
  const destination = welcomeReturn || location.hash.slice(2) || "inicio";
  welcomeReturn = "";
  navigate(destination);
}
async function checkApi() {
  try {
    const response = await fetch("/api/estado", {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    const result = response.ok ? await response.json() : null;
    api = result?.ia === true;
  } catch {
    api = false;
  }
  const status = document.querySelector("#mesa-status");
  if (status)
    status.textContent = api
      ? "La Mesa con IA está conectada."
      : "La Mesa con IA no está conectada; te armamos la receta para que la uses en tu chat de IA";
  return api;
}
function fallback(request) {
  const recipe = closestRecipe(request, data.recetas.recetas);
  return {
    respuesta: offlinePrompt(state.perfil, request),
    tipo: "receta",
    receta: recipe?.id || null,
    paquete: null,
    razon: "Te dejamos una receta para resolver este pedido en tu chat de IA.",
    siguiente_paso:
      "Cópiala, completa los [corchetes] y revisa la respuesta antes de usarla.",
    aviso: null,
  };
}
async function sendMesa(request) {
  if (busy) return;
  const generation = mesaGeneration;
  mesaDraft = request;
  busy = true;
  mesaResult = null;
  const button = document.querySelector("#mesa-send");
  if (button) {
    button.disabled = true;
    button.innerHTML =
      '<span class="ember" aria-hidden="true"></span> Mecha está trabajando…';
  }
  const live = document.querySelector("#mesa-response");
  if (live) live.textContent = "Estamos trabajando en tu pedido…";
  let result,
    offline = false;
  try {
    if (api === null) await checkApi();
    if (!api) {
      result = fallback(request);
      offline = true;
    } else {
      const response = await fetch("/api/mesa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfil: state.perfil, pedido: request }),
        signal: AbortSignal.timeout(90000),
      });
      if (response.status === 503) {
        api = false;
        result = fallback(request);
        offline = true;
      } else {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "La Mesa no pudo responder.");
        if (
          typeof body.respuesta !== "string" ||
          !["resuelto", "receta", "servicio"].includes(body.tipo)
        )
          throw new Error("La respuesta no llegó completa.");
        result = body;
      }
    }
  } catch {
    result = fallback(request);
    offline = true;
    api = false;
    toast(
      "La Mesa no pudo responder. Te dejamos la receta para llevarla a tu chat de IA.",
    );
  } finally {
    busy = false;
  }
  if (generation !== mesaGeneration) return;
  const entry = {
    pedido: request,
    resultado: result,
    offline,
    fecha: new Date().toISOString(),
  };
  mesaResult = entry;
  state.mesa.unshift(entry);
  state.mesa = state.mesa.slice(0, 10);
  persist();
  if (result.paquete) recommendedPackage = result.paquete;
  if (currentPage === "mesa" && state.perfil) {
    // Mantén el contenedor live existente para que se anuncie la respuesta.
    const responseNode = document.querySelector("#mesa-response");
    if (responseNode)
      responseNode.innerHTML = views.mesaResult(entry, context());
    const history = document.querySelector(".history");
    const temporary = document.createElement("div");
    temporary.innerHTML = views.mesa(context());
    if (history) history.replaceWith(temporary.querySelector(".history"));
    if (button?.isConnected) {
      button.disabled = false;
      button.innerHTML = `Resolver este pendiente${icon("arrow")}`;
    }
    const status = document.querySelector("#mesa-status");
    if (status)
      status.textContent = api
        ? "La Mesa con IA está conectada."
        : "La Mesa con IA no está conectada; te armamos la receta para que la uses en tu chat de IA";
  }
}

menuToggle.addEventListener("click", () => {
  const open = menu.hidden;
  menu.hidden = !open;
  menuToggle.setAttribute("aria-expanded", String(open));
  if (open) menu.querySelector("a").focus();
});
document.addEventListener("click", (e) => {
  if (!menu.contains(e.target) && !menuToggle.contains(e.target)) closeMenu();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !menu.hidden) {
    closeMenu();
    menuToggle.focus();
  }
});
window.addEventListener("hashchange", () => render());
window.addEventListener("online", checkApi);
window.addEventListener("offline", () => {
  api = false;
  const status = document.querySelector("#mesa-status");
  if (status)
    status.textContent =
      "La Mesa con IA no está conectada; te armamos la receta para que la uses en tu chat de IA";
});

main.addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const values = new FormData(form);
  if (form.id === "welcome-form") {
    const value = String(values.get("value") || "").trim();
    if (!value) {
      document.querySelector("#welcome-value").focus();
      return;
    }
    onboarding.profile[fields[onboarding.step].key] = value;
    if (onboarding.step < fields.length - 1) {
      onboarding.step++;
      render(false);
      document.querySelector("#welcome-value").focus();
    } else finishWelcome();
  } else if (form.id === "profile-form") {
    state.perfil = Object.fromEntries(
      fields.map((f) => [f.key, String(values.get(f.key) || "").trim()]),
    );
    persist();
    toast("Tu perfil quedó guardado.");
  } else if (form.id === "radio-form") {
    radio.numeros = {};
    for (const [key, value] of values.entries()) {
      const [symptom, field] = key.split(".");
      radio.numeros[symptom] ||= {};
      radio.numeros[symptom][field] = value;
    }
    state.radiografia = {
      sintomas: [...radio.sintomas],
      numeros: structuredClone(radio.numeros),
      fecha: new Date().toISOString(),
    };
    const largest = diagnosis(state.radiografia, data.recetas.sintomas).find(
      (s) => s.horas != null,
    );
    if (largest)
      recommendedPackage = data.recetas.recetas.find(
        (r) => r.sintoma === largest.id,
      )?.paquete;
    radio.step = 3;
    persist();
    render();
  } else if (form.id === "home-mesa-form") {
    mesaDraft = String(values.get("pedido")).trim();
    navigate("mesa");
  } else if (form.id === "mesa-form") {
    const request = String(values.get("pedido") || "").trim();
    if (request) sendMesa(request);
  }
});
main.addEventListener("input", (e) => {
  if (e.target.id === "recipe-search") {
    filters.q = e.target.value;
    refreshRecipes();
  }
  if (e.target.id === "mesa-request" || e.target.id === "home-request")
    mesaDraft = e.target.value;
  if (e.target.id === "rules-owner") {
    state.preferencias.responsable = e.target.value;
    const owner = document.querySelector("#printed-owner");
    owner.textContent = e.target.value || "[responsable]";
    owner.classList.toggle("pendiente", !e.target.value);
    save();
  }
});
main.addEventListener("change", (e) => {
  if (e.target.id === "filter-role") {
    filters.rol = e.target.value;
    const url = filters.rol ? `#/recetas?rol=${filters.rol}` : "#/recetas";
    history.replaceState(null, "", url);
    refreshRecipes();
  }
  if (e.target.id === "filter-level") {
    filters.nivel = e.target.value;
    refreshRecipes();
  }
  if (e.target.id === "theme-select") {
    state.preferencias.tema = e.target.value;
    applyTheme();
    persist();
  }
  if (e.target.id === "team-role") {
    teamRole = e.target.value;
    document.querySelector("#team-link").value = teamLink();
  }
});
main.addEventListener("click", async (e) => {
  const button = e.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "welcome-choice") {
    const input = document.querySelector("#welcome-value");
    input.value = button.dataset.value;
    input.focus();
    document
      .querySelectorAll(".welcome-form .chip")
      .forEach((c) => c.classList.toggle("selected", c === button));
  } else if (action === "welcome-back") {
    onboarding.profile[fields[onboarding.step].key] = document
      .querySelector("#welcome-value")
      .value.trim();
    onboarding.step--;
    render(false);
    document.querySelector("#welcome-value").focus();
  } else if (action === "skip-welcome") {
    onboarding.profile[fields[onboarding.step].key] = document
      .querySelector("#welcome-value")
      .value.trim();
    finishWelcome();
  } else if (action === "symptom") {
    radio.sintomas = radio.sintomas.includes(id)
      ? radio.sintomas.filter((s) => s !== id)
      : [...radio.sintomas, id];
    render(false);
    main.querySelector(`[data-action="symptom"][data-id="${id}"]`).focus();
  } else if (action === "radio-next") {
    radio.step = 2;
    render();
  } else if (action === "radio-back") {
    for (const [key, value] of new FormData(
      document.querySelector("#radio-form"),
    )) {
      const [symptom, field] = key.split(".");
      radio.numeros[symptom] ||= {};
      radio.numeros[symptom][field] = value;
    }
    radio.step = 1;
    render();
  } else if (action === "radio-edit") {
    radio.step = 1;
    render();
  } else if (
    action === "filter-symptom" ||
    action === "filter-favorites" ||
    action === "reset-filters"
  ) {
    if (action === "filter-symptom") filters.sintoma = id;
    if (action === "filter-favorites") filters.favoritas = !filters.favoritas;
    if (action === "reset-filters") {
      filters = { q: "", sintoma: "", rol: "", nivel: "", favoritas: false };
      history.replaceState(null, "", "#/recetas");
    }
    render(false);
    main
      .querySelector(
        action === "reset-filters"
          ? "#recipe-search"
          : `[data-action="${action}"]${action === "filter-symptom" ? `[data-id="${id}"]` : ""}`,
      )
      ?.focus();
  } else if (action === "favorite") {
    state.favoritas = state.favoritas.includes(id)
      ? state.favoritas.filter((r) => r !== id)
      : [...state.favoritas, id];
    persist();
    if (currentPage === "recetas" && !currentId) {
      refreshRecipes();
      main.querySelector(`[data-action="favorite"][data-id="${id}"]`)?.focus();
    } else {
      const y = window.scrollY;
      render(false);
      window.scrollTo(0, y);
      main.querySelector(`[data-action="favorite"][data-id="${id}"]`)?.focus();
    }
  } else if (action === "copy-prompt") await copy(currentPrompt);
  else if (action === "chat")
    await openChat(button.dataset.chat, currentPrompt);
  else if (action === "recipe-mesa") {
    mesaDraft = personalize(
      data.recetas.recetas.find((r) => r.id === id).prompt,
      state.perfil,
    );
    navigate("mesa");
  } else if (action === "recipe-done") {
    const next = nextChallenge(data.ruta, state.ruta.hechos);
    if (!state.ruta.recetas.includes(id)) state.ruta.recetas.push(id);
    if (next?.receta === id) markDay(next.dia);
    else {
      persist();
      toast("Receta marcada como hecha.");
    }
    render(false);
    main.querySelector('[data-action="recipe-done"]')?.focus();
  } else if (action === "challenge-done") {
    const y = window.scrollY;
    markDay(Number(button.dataset.day), true);
    render(false);
    window.scrollTo(0, y);
    main.querySelector(`[data-day="${button.dataset.day}"]`)?.focus();
  } else if (action === "mesa-example") {
    mesaDraft = button.dataset.value;
    const input = document.querySelector("#mesa-request");
    input.value = mesaDraft;
    input.focus();
  } else if (action === "copy-response" || action === "response-chat") {
    const entry =
      button.dataset.index != null
        ? state.mesa[Number(button.dataset.index)]
        : mesaResult;
    if (entry) {
      if (action === "copy-response") await copy(entry.resultado.respuesta);
      else await openChat(button.dataset.chat, entry.resultado.respuesta);
    }
  } else if (action === "print-rules") {
    document.body.classList.add("printing-rules");
    window.print();
  } else if (action === "export") {
    const file = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prende-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Exportamos una copia de tus datos.");
  } else if (action === "delete")
    document.querySelector("#delete-dialog").showModal();
  else if (action === "share-team") {
    try {
      if (navigator.share)
        await navigator.share({
          title: "Prende de Mecha",
          text: "Usa la IA en tu negocio desde hoy.",
          url: teamLink(),
        });
      else await copy(teamLink());
    } catch (error) {
      if (error.name !== "AbortError") await copy(teamLink());
    }
  }
});
window.addEventListener("afterprint", () =>
  document.body.classList.remove("printing-rules"),
);
document
  .querySelector("#cancel-delete")
  .addEventListener("click", () =>
    document.querySelector("#delete-dialog").close(),
  );
document.querySelector("#confirm-delete").addEventListener("click", () => {
  document.querySelector("#delete-dialog").close();
  mesaGeneration++;
  clear();
  applyTheme();
  onboarding = { step: 0, profile: {} };
  radio = { step: 1, sintomas: [], numeros: {} };
  mesaDraft = "";
  mesaResult = null;
  recommendedPackage = "";
  welcomeReturn = "inicio";
  navigate("inicio");
  toast("Tus datos fueron borrados de Prende.");
});

async function init() {
  applyTheme();
  try {
    const entries = await Promise.all(
      ["recetas", "ruta", "paquetes"].map(async (name) => {
        const response = await fetch(`datos/${name}.json`);
        if (!response.ok) throw new Error(name);
        return [name, await response.json()];
      }),
    );
    data = Object.fromEntries(entries);
    render();
    if (!storageAvailable)
      toast(
        "Prende funciona, pero este navegador no permite guardar tus avances.",
      );
    checkApi();
  } catch {
    main.innerHTML =
      '<section class="page-heading"><p class="eyebrow">NOS FALTÓ UNA CHISPA</p><h1 tabindex="-1">No pudimos cargar las recetas.</h1><p class="lead">Conéctate y vuelve a intentarlo. Para el primer uso, abre Prende desde un servidor, no como un archivo.</p><button class="button primary" id="retry-load">Volver a intentar</button></section>';
    focusHeading();
    document.querySelector("#retry-load").addEventListener("click", init);
  }
  if (
    "serviceWorker" in navigator &&
    (location.protocol === "https:" ||
      ["localhost", "127.0.0.1"].includes(location.hostname))
  ) {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(() =>
        toast(
          "La app funciona. El guardado para usarla sin conexión no está disponible.",
        ),
      );
  }
}
init();
