import { availableServices, findServices } from "./catalog.js";
import {
  uploadAccept,
  deliveryAccept,
  MAX_ATTACHMENTS,
  FILE_LIMIT,
} from "../src/formats.js";
import { marked } from "marked";
import DOMPurify from "dompurify";

const $ = (selector, root = document) => root.querySelector(selector);
const app = $("#app");
const state = {
  user: null,
  pendingDraft: null,
  targetJob: new URLSearchParams(location.search).get("pedido"),
  profile: null,
  inviteToken: null,
  inviteEmail: null,
  resetToken: null,
  resetEmail: null,
  adminJob: null,
  adminJobs: [],
  adminFilter: "",
  adminSearch: "",
  watch: null,
  known: new Map(),
  uploads: [],
  job: null,
  authMode: "register",
  poll: null,
  busy: false,
};
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icons = {
  arrow:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>',
  attach:
    '<svg viewBox="0 0 24 24" fill="none"><path d="m8 12 6-6a3 3 0 0 1 4 4L9 19a5 5 0 0 1-7-7l9-9a4 4 0 0 1 6 6l-9 9a2 2 0 0 1-3-3l8-8"/></svg>',
  history:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 1 0 3-7M3 3v5h5m4-2v6l4 2"/></svg>',
  download:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none"><path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8M8 16h6"/></svg>',
};
async function api(path, { method = "GET", data, form } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: data ? { "Content-Type": "application/json" } : {},
    body: form || (data ? JSON.stringify(data) : undefined),
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("No pudimos comunicarnos con Mecha. Revisa tu conexión.");
  }
  if (!response.ok) {
    if (response.status === 401 && state.user) {
      resetState();
      renderAuth();
    }
    throw new Error(result.error || "No se pudo completar la solicitud.");
  }
  return result;
}
let toastTimer;
function toast(message) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 7000);
}
function resetState() {
  clearTimeout(state.poll);
  clearTimeout(state.watch);
  state.known.clear();
  Object.assign(state, {
    user: null,
    profile: null,
    uploads: [],
    job: null,
    poll: null,
    busy: false,
  });
  state.pendingDraft = null;
  closeDrawer();
}
function navigation() {
  $("#navigation").innerHTML =
    state.user?.role === "admin"
      ? `<nav class="nav-actions"><span class="header-note">OPERACIÓN MECHA</span><button class="nav-button" id="logout">Salir</button></nav>`
      : state.user && state.profile
        ? `<nav class="nav-actions" aria-label="Tu espacio"><button class="nav-button" id="history-button">${icons.history}<span>Historial</span></button><button class="business-button" id="business-button"><span class="business-dot"></span><span>${esc(state.profile.name)}</span><span class="chevron">⌄</span></button></nav>`
        : state.user
          ? `<button class="nav-button" id="logout">Salir</button>`
          : location.pathname === "/operacion"
            ? `<span class="header-note">Operación Mecha</span>`
            : `<nav class="nav-actions"><span class="header-note">MARKETING + AUTOMATIZACIÓN</span><button id="public-login" class="nav-button">Entrar</button></nav>`;
  $("#history-button")?.addEventListener("click", openDrawer);
  $("#business-button")?.addEventListener("click", () => {
    renderProfile(true);
    $("#profile-dialog").showModal();
  });
  $("#logout")?.addEventListener("click", logout);
  $("#public-login")?.addEventListener("click", () => {
    state.pendingDraft = {
      prompt: $("#prompt")?.value || "",
      goal: $("#desired-result")?.value || "",
    };
    state.authMode = "login";
    renderAuth();
  });
}
async function logout() {
  try {
    await api("/api/logout", { method: "POST" });
    $("#profile-dialog").close();
    resetState();
    navigation();
    location.pathname === "/operacion" ? renderAuth() : renderHome();
  } catch (e) {
    toast(e.message);
  }
}
function renderAuth() {
  window.scrollTo(0, 0);
  navigation();
  const operator = location.pathname === "/operacion";
  const signup =
    state.inviteToken || (!operator && state.authMode === "register");
  app.className = "auth-layout";
  app.innerHTML = `<section class="auth-story"><div class="eyebrow"><span class="spark"></span>UN SOLO LUGAR. MUCHAS POSIBILIDADES.</div><h1>Tu siguiente <br>mejora, <br><em>con Mecha.</em></h1><p>Marketing y automatización para resolver lo que está frenando a tu negocio.</p><p class="story-last">Pídeselo a Mecha. Nosotros lo llevamos a la entrega.</p><span class="story-line" aria-hidden="true"></span></section><section class="auth-card"><span class="step-label">EMPIEZA AQUÍ</span><h2>${signup ? (operator ? "Crea tu acceso a Mecha." : "Dale un espacio a tu negocio.") : operator ? "Tu bandeja de pedidos." : state.targetJob ? "Entra para ver tu pedido." : "Qué bueno verte de nuevo."}</h2><p class="muted">${signup ? (operator ? "Elige tu contraseña para revisar pedidos y publicar entregas." : "Crea tu cuenta. Después, cuéntanos qué haces.") : "Entra para continuar con tus ideas y entregas."}</p><form id="auth-form"><label>Correo electrónico<input name="email" type="email" value="${esc(state.inviteEmail || "")}" ${state.inviteEmail ? "readonly" : ""} autocomplete="email" placeholder="tu@negocio.com" maxlength="254" required></label><label>Contraseña<input name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" placeholder="Al menos 10 caracteres" minlength="10" maxlength="200" required></label><p class="form-error" id="auth-error" role="alert"></p><button class="primary full" type="submit">${signup ? "Crear mi cuenta" : "Entrar a Mecha"}<span>↗</span></button></form><p class="auth-switch">${signup ? "¿Ya tienes cuenta?" : "¿Es tu primera vez?"} <button class="text-button" id="auth-switch">${signup ? "Inicia sesión" : "Crea tu cuenta"}</button></p>${!signup && !operator ? '<p class="small muted auth-forgot">¿Olvidaste tu contraseña? Escríbele a Mecha y te enviamos un enlace para elegir una nueva.</p>' : ""}<p class="small muted auth-footnote">Antes de empezar, acordamos alcance, monto y plazo. Tus pedidos y entregas se guardan en tu cuenta.</p></section>`;
  if (!operator) {
    const back = document.createElement("button");
    back.className = "text-button auth-back";
    back.type = "button";
    back.textContent = "← Volver al buscador";
    back.onclick = renderHome;
    $(".auth-card").append(back);
  }
  if (operator)
    $(".auth-switch").innerHTML =
      `<a href="/" class="text-button">Ir al espacio de clientes</a>`;
  $("#auth-switch")?.addEventListener("click", () => {
    state.authMode = signup ? "login" : "register";
    renderAuth();
  });
  $("#auth-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $("button[type=submit]", form);
    button.disabled = true;
    $("#auth-error").textContent = "";
    try {
      const data = Object.fromEntries(new FormData(form));
      if (state.inviteToken) data.inviteToken = state.inviteToken;
      const result = await api(signup ? "/api/register" : "/api/login", {
        method: "POST",
        data,
      });
      Object.assign(state, result);
      navigation();
      state.inviteToken = null;
      state.inviteEmail = null;
      enterSpace();
    } catch (e) {
      $("#auth-error").textContent = e.message;
    } finally {
      button.disabled = false;
    }
  };
}
function renderReset() {
  window.scrollTo(0, 0);
  navigation();
  app.className = "auth-layout reset-layout";
  app.innerHTML = `<section class="auth-card"><span class="step-label">NUEVA CONTRASEÑA</span><h2>Elige tu nueva contraseña.</h2><p class="muted">Para ${esc(state.resetEmail)}. Al guardarla se cierran las sesiones abiertas con la anterior.</p><form id="reset-form"><label>Nueva contraseña<input name="password" type="password" autocomplete="new-password" placeholder="Al menos 10 caracteres" minlength="10" maxlength="200" required></label><label>Repítela<input name="confirm" type="password" autocomplete="new-password" minlength="10" maxlength="200" required></label><p class="form-error" role="alert"></p><button class="primary full" type="submit">Guardar y entrar<span>↗</span></button></form></section>`;
  $("#reset-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget,
      button = $("button[type=submit]", form),
      error = $(".form-error", form);
    error.textContent = "";
    if (form.password.value !== form.confirm.value) {
      error.textContent = "Las contraseñas no coinciden.";
      return;
    }
    button.disabled = true;
    try {
      const result = await api("/api/reset", {
        method: "POST",
        data: { token: state.resetToken, password: form.password.value },
      });
      Object.assign(state, result, { resetToken: null, resetEmail: null });
      toast("Tu contraseña quedó actualizada.");
      enterSpace();
    } catch (e) {
      error.textContent = e.message;
    } finally {
      button.disabled = false;
    }
  };
}
function profileFields() {
  const p = state.profile || {};
  return `<div class="form-grid"><label class="span-2">Nombre del negocio<input name="name" value="${esc(p.name)}" placeholder="¿Cómo se llama tu negocio?" minlength="2" maxlength="120" required></label><label class="span-2">¿A qué te dedicas?<textarea name="activity" placeholder="Qué vendes, qué haces y a quién ayudas." minlength="5" maxlength="1200" rows="3" required>${esc(p.activity)}</textarea></label><label>Ciudad<input name="city" value="${esc(p.city)}" placeholder="Ciudad y estado" maxlength="120"></label><label>WhatsApp<input name="whatsapp" type="tel" value="${esc(p.whatsapp)}" placeholder="Código de país y número" maxlength="30"></label><label class="span-2">Página web actual <span>opcional</span><input name="website" value="${esc(p.website)}" placeholder="https://tunegocio.com" maxlength="500"></label><label>Instagram <span>opcional</span><input name="instagram" value="${esc(p.instagram)}" placeholder="instagram.com/tunegocio" maxlength="500"></label><label>Facebook <span>opcional</span><input name="facebook" value="${esc(p.facebook)}" placeholder="facebook.com/tunegocio" maxlength="500"></label><label class="span-2">¿Qué te gustaría mejorar? <span>opcional</span><textarea name="goal" placeholder="Por ejemplo: cotizar más rápido o entender mejor mis ventas." maxlength="1200" rows="2">${esc(p.goal)}</textarea></label></div>`;
}
function renderProfile(dialog = false) {
  const root = dialog ? $("#profile-content") : app;
  if (!dialog) {
    app.className = "onboarding";
    window.scrollTo(0, 0);
  }
  root.innerHTML = `<section class="profile-card">${dialog ? '<button id="close-profile" class="close-profile icon-button" aria-label="Cerrar">×</button>' : '<div class="step-progress"><span></span><span></span></div>'}<div class="step-label">${dialog ? "TU NEGOCIO" : "TU CUENTA ESTÁ LISTA"}</div><h${dialog ? "2" : "1"}>${dialog ? "Lo que Mecha sabe de ti." : "Cuéntanos qué haces."}</h${dialog ? "2" : "1"}><p class="muted">Mecha usará este contexto para cada solicitud. Puedes cambiarlo después.</p><form id="profile-form">${profileFields()}<p class="form-error" role="alert"></p><button class="primary full" type="submit">${dialog ? "Guardar cambios" : "Ir a mi espacio"}<span>↗</span></button></form>${dialog ? '<button class="logout-button text-button" id="profile-logout">Cerrar sesión</button>' : '<p class="small muted">Si todavía no tienes redes o página web, deja esos campos vacíos.</p>'}</section>`;
  $("#close-profile", root)?.addEventListener("click", () =>
    $("#profile-dialog").close(),
  );
  $("#profile-logout", root)?.addEventListener("click", logout);
  $("#profile-form", root).onsubmit = async (e) => {
    e.preventDefault();
    const button = $("button[type=submit]", e.currentTarget);
    button.disabled = true;
    const error = $(".form-error", e.currentTarget);
    error.textContent = "";
    try {
      const result = await api("/api/profile", {
        method: "PUT",
        data: Object.fromEntries(new FormData(e.currentTarget)),
      });
      state.profile = result.profile;
      navigation();
      if (dialog) {
        $("#profile-dialog").close();
        toast("El contexto de tu negocio se actualizó.");
      } else if (state.targetJob) {
        const target = state.targetJob;
        state.targetJob = null;
        openCustomerJob(target);
      } else renderHome();
    } catch (ex) {
      error.textContent = ex.message;
    } finally {
      button.disabled = false;
    }
  };
}
function composer() {
  return `<form id="request-form" class="composer"><label class="sr-only" for="prompt">¿Qué necesita tu negocio?</label><textarea id="prompt" name="prompt" rows="2" maxlength="10000" placeholder="Cuéntanos qué te está quitando tiempo o frenando tus ventas…" required></textarea>${!state.job || state.job.status === "delivered" ? `<details class="request-goal"><summary>¿Qué resultado buscas? <span>opcional</span></summary><label class="sr-only" for="desired-result">Resultado que buscas</label><textarea id="desired-result" rows="2" maxlength="1500" placeholder="Qué debería cambiar y cómo lo comprobarías con tus datos."></textarea></details>` : ""}<div id="attachment"></div><div class="composer-bottom"><button class="attach-button" id="attach-button" type="button" title="Adjuntar un archivo">${icons.attach}<span>Adjuntar</span></button><span class="composer-hint">Enter para enviar</span><button class="send-button" id="send-button" type="submit" aria-label="Enviar solicitud">${icons.arrow}</button></div><input class="sr-only" tabindex="-1" id="file-input" aria-label="Archivos adjuntos" type="file" multiple accept="${uploadAccept}"></form><p class="composer-caption">Primero acordamos alcance, monto y plazo. Tú apruebas antes de empezar.</p>`;
}
function renderHome() {
  window.scrollTo(0, 0);
  clearTimeout(state.poll);
  state.job = null;
  state.uploads = [];
  state.busy = false;
  navigation();
  app.className = "home";
  app.innerHTML = `<section class="workspace"><div class="workspace-heading"><div class="eyebrow"><span class="spark"></span>TU EQUIPO MECHA</div><h1>¿Qué está frenando<br class="mobile-break"> a tu negocio?</h1><p>Marketing + automatización, con implementación y seguimiento de Mecha.</p></div>${composer()}<div class="suggestions" aria-label="Problemas que podemos resolver"><button data-suggestion="whatsapp"><span>↗</span> Tardo en contestar WhatsApp</button><button data-suggestion="quotes"><span>↗</span> Cotizo y doy seguimiento a mano</button><button data-suggestion="data"><span>↗</span> No sé qué está funcionando</button><button data-suggestion="web"><span>↗</span> Necesito captar más clientes</button></div><button id="explore-services" class="text-button catalog-trigger">Ver qué puedes pedir ↗</button></section>`;
  $("#explore-services").onclick = openCatalog;
  bindComposer();
  const campaign = new URLSearchParams(location.search).get("problema");
  if (state.pendingDraft) {
    $("#prompt").value = state.pendingDraft.prompt;
    $("#desired-result").value = state.pendingDraft.goal;
    state.pendingDraft = null;
  } else if (symptomPrompts[campaign])
    $("#prompt").value = symptomPrompts[campaign];
  resizePrompt();
  if ($("#desired-result").value) $(".request-goal").open = true;
  document.querySelectorAll("[data-suggestion]").forEach(
    (button) =>
      (button.onclick = () => {
        const prompts = symptomPrompts;
        $("#prompt").value = prompts[button.dataset.suggestion];
        resizePrompt();
        $("#prompt").focus();
      }),
  );
}
function resizePrompt() {
  const prompt = $("#prompt");
  if (!prompt) return;
  prompt.style.height = "auto";
  prompt.style.height = Math.min(200, prompt.scrollHeight) + "px";
  prompt.style.overflowY = prompt.scrollHeight > 200 ? "auto" : "hidden";
}
function bindComposer() {
  const form = $("#request-form"),
    input = $("#file-input"),
    prompt = $("#prompt");
  $("#attach-button").onclick = () => {
    if (!state.user) return beginRequestLogin();
    input.click();
  };
  $("#attach-button").title =
    "Hasta 8 archivos de 8 MB; para archivos grandes, pega un enlace";
  prompt.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  };
  prompt.oninput = resizePrompt;
  input.onchange = () => {
    if (input.files.length) uploadFiles([...input.files]);
    input.value = "";
  };
  form.ondragover = (e) => {
    e.preventDefault();
    if (!state.busy) form.classList.add("dragover");
  };
  form.ondragleave = () => form.classList.remove("dragover");
  form.ondrop = (e) => {
    e.preventDefault();
    form.classList.remove("dragover");
    if (e.dataTransfer.files.length) uploadFiles([...e.dataTransfer.files]);
  };
  form.onsubmit = sendRequest;
  renderAttachment();
  setBusy(state.busy);
}
function setBusy(value) {
  state.busy = value;
  const send = $("#send-button");
  if (send) send.disabled = value;
  const attach = $("#attach-button");
  if (attach) attach.disabled = value;
  const input = $("#prompt");
  if (input) input.disabled = value;
  document
    .querySelectorAll(
      "[data-remove-upload],#new-request,#history-button,#explore-services",
    )
    .forEach((button) => (button.disabled = value));
}
async function uploadFiles(files) {
  if (state.busy) return;
  if (!state.user) return beginRequestLogin();
  if (state.uploads.length + files.length > MAX_ATTACHMENTS)
    return toast("Puedes adjuntar hasta ocho archivos por mensaje.");
  if (files.some((f) => f.size > FILE_LIMIT || !f.size))
    return toast(
      "Cada archivo debe tener contenido y pesar hasta 8 MB. Para archivos más grandes, pega un enlace en tu pedido.",
    );
  setBusy(true);
  try {
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      const upload = await api("/api/uploads", { method: "POST", form });
      state.uploads.push(upload);
      renderAttachment();
    }
    if (!$("#prompt")?.value)
      $("#prompt").value =
        "Revisa estos archivos y prepara lo que necesita mi negocio.";
  } catch (e) {
    toast(e.message);
    renderAttachment();
  } finally {
    setBusy(false);
    $("#prompt")?.focus();
  }
}
function renderAttachment() {
  const target = $("#attachment");
  if (!target) return;
  target.innerHTML = state.uploads
    .map(
      (upload) =>
        `<div class="attachment-chip">${icons.file}<span><strong>${esc(upload.name)}</strong><small>${upload.summary.type === "file" ? `${(upload.summary.bytes / 1024).toFixed(1)} KB` : "Archivo original"} · adjunto al pedido</small></span><button type="button" data-remove-upload="${upload.id}" class="icon-button" aria-label="Quitar ${esc(upload.name)}" ${state.busy ? "disabled" : ""}>×</button></div>`,
    )
    .join("");
  target.querySelectorAll("[data-remove-upload]").forEach(
    (button) =>
      (button.onclick = async () => {
        if (state.busy) return;
        const uid = button.dataset.removeUpload;
        button.disabled = true;
        try {
          await api("/api/uploads/" + uid, { method: "DELETE" });
          state.uploads = state.uploads.filter((u) => u.id !== uid);
          renderAttachment();
        } catch (e) {
          toast(e.message);
          button.disabled = false;
        }
      }),
  );
}
function originalFiles(files) {
  return (files || [])
    .map(
      (file) =>
        `<a class="original-file" href="/api/uploads/${file.id}">${icons.file}${esc(file.name)} · original</a>`,
    )
    .join("");
}
async function sendRequest(e) {
  e.preventDefault();
  if (state.busy) return;
  const prompt = $("#prompt").value.trim();
  if (prompt.length < 3)
    return toast("Cuéntanos un poco más sobre lo que necesitas.");
  if (!state.user) return beginRequestLogin();
  const desiredResult = $("#desired-result")?.value.trim() || "";
  const adding = state.job && state.job.status !== "delivered";
  setBusy(true);
  try {
    const result = await api(
      adding ? `/api/jobs/${state.job.id}/comments` : "/api/jobs",
      {
        method: "POST",
        data: adding
          ? { message: prompt, uploadIds: state.uploads.map((u) => u.id) }
          : {
              prompt,
              uploadIds: state.uploads.map((u) => u.id),
              parentId: state.job?.id,
              desiredResult,
            },
      },
    );
    state.job = result.job;
    state.uploads = [];
    state.busy = false;
    renderJob();
    pollJob();
    toast(
      adding
        ? "Mecha recibió la información de tu pedido."
        : "Mecha recibió tu pedido. Puedes seguir su avance aquí.",
    );
  } catch (ex) {
    toast(ex.message);
    setBusy(false);
  }
}
const statusLabels = {
  received: "Solicitud recibida",
  awaiting_approval: "Por aprobar",
  in_progress: "En proceso",
  needs_info: "Necesitamos información",
  delivered: "Entregado",
};
const stamp = (value) =>
  new Date(value).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const badge = (status) =>
  `<span class="order-status ${esc(status)}"><span></span>${statusLabels[status] || esc(status)}</span>`;
function markdown(text) {
  return DOMPurify.sanitize(marked.parse(text || ""), {
    FORBID_TAGS: ["style", "iframe", "form", "input", "button"],
    FORBID_ATTR: ["style"],
  });
}
function renderComments(job) {
  return job.comments?.length
    ? `<div class="order-messages"><h3>Conversación del pedido</h3>${job.comments.map((c) => `<article class="order-message ${c.role === "admin" ? "mecha-message" : ""}"><div><strong>${c.role === "admin" ? "Mecha" : "Cliente"}</strong><time>${stamp(c.created)}</time></div><p>${esc(c.body)}</p>${originalFiles(c.attachments)}</article>`).join("")}</div>`
    : "";
}
function bindPreviews() {
  document.querySelectorAll("[data-preview]").forEach(
    (button) =>
      (button.onclick = () => {
        $("#preview-dialog iframe").src =
          `/api/artifacts/${button.dataset.preview}/preview`;
        $("#preview-dialog").showModal();
      }),
  );
  document.querySelectorAll(".markdown a").forEach((a) => {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });
}
function renderJob(preserve = false) {
  const draft = preserve ? $("#prompt")?.value || "" : "",
    goalDraft = preserve ? $("#desired-result")?.value : null,
    feedbackDraft = preserve ? $("#feedback")?.value : null,
    focusedField = preserve ? document.activeElement?.id : null,
    scroll = window.scrollY;
  if (!preserve) window.scrollTo(0, 0);
  const job = state.job,
    delivered = job.status === "delivered";
  state.busy = false;
  app.className = "result-layout";
  app.innerHTML = `<section class="result-workspace"><div class="result-top"><button class="nav-button" id="new-request">${icons.plus}Nuevo pedido</button>${badge(job.status)}</div><div class="request-bubble"><span class="step-label">TU PEDIDO · ${stamp(job.created)}</span><p>${esc(job.prompt)}</p>${originalFiles(job.attachments)}${job.desired_result ? `<div class="desired-result"><strong>Resultado que buscas</strong><p>${esc(job.desired_result)}</p></div>` : ""}</div>${renderProposal(job)}<section class="delivery" aria-live="polite">${delivered ? `<div class="delivery-heading"><span class="eyebrow"><span class="spark"></span>PREPARADO POR MECHA</span><span class="small muted">${stamp(job.updated)}</span></div><div class="markdown">${markdown(job.response)}</div>${job.delivery_url ? `<a class="primary delivery-link" href="${esc(job.delivery_url)}" target="_blank" rel="noopener noreferrer">Abrir entrega ↗</a>` : ""}${renderArtifacts(job.artifacts || [])}` : `<div class="working"><span class="manual-mark" aria-hidden="true">↗</span><div><h2>${{ received: "Recibimos tu solicitud.", awaiting_approval: "Tu propuesta está lista.", needs_info: "Nos falta un detalle.", in_progress: "Tu pedido está en proceso." }[job.status] || "Tu pedido está guardado."}</h2><p>${{ received: "Mecha revisará lo que necesitas y te propondrá alcance, monto y plazo. Enviar esta solicitud todavía no genera un cobro ni inicia el trabajo.", awaiting_approval: "Revisa el alcance, monto, plazo y ajustes de la propuesta. El trabajo inicia cuando la apruebas.", needs_info: "Revisa el mensaje de Mecha y responde abajo para que podamos continuar.", in_progress: "Estamos trabajando en lo acordado. Cuando publiquemos la entrega, aparecerá en este espacio." }[job.status] || ""}</p></div></div><p class="small muted order-note">Puedes cerrar esta página y regresar desde tu historial.</p>`}</section>${renderComments(job)}${delivered ? renderFeedback(job) : ""}<div class="follow-up"><p class="follow-up-label">${delivered ? "¿Necesitas un ajuste? Envíalo como un nuevo pedido." : "Agrega información o archivos a este pedido."}</p>${composer()}</div></section>`;
  $("#new-request").onclick = renderHome;
  bindComposer();
  bindPreviews();
  bindClientProposal(job);
  bindFeedback(job);
  if (preserve) {
    $("#prompt").value = draft;
    resizePrompt();
    if (goalDraft != null && $("#desired-result"))
      $("#desired-result").value = goalDraft;
    if (feedbackDraft != null && $("#feedback"))
      $("#feedback").value = feedbackDraft;
    if (focusedField)
      document.getElementById(focusedField)?.focus({ preventScroll: true });
    window.scrollTo(0, scroll);
  }
}
function renderArtifacts(artifacts) {
  if (!artifacts.length) return "";
  const labels = {
    spreadsheet: "EXCEL",
    document: "WORD",
    html: "PÁGINA WEB",
    text: "DOCUMENTO",
    presentation: "PRESENTACIÓN",
    image: "IMAGEN",
    video: "VIDEO",
    audio: "AUDIO",
    pdf: "PDF",
    package: "ARCHIVOS",
  };
  return `<div class="artifacts">${artifacts.map((a) => `<article class="artifact"><span class="artifact-icon">${icons.file}</span><div><small>${labels[a.kind] || "ARCHIVO"}</small><h3>${esc(a.name)}</h3></div><div class="artifact-actions">${a.kind === "html" ? `<button data-preview="${esc(a.id)}" class="secondary">Ver página</button>` : ""}<a class="download-button" href="/api/artifacts/${encodeURIComponent(a.id)}" aria-label="Descargar ${esc(a.name)}">${icons.download}<span>Descargar</span></a></div></article>`).join("")}</div>`;
}
function renderSources(sources) {
  return sources.length
    ? `<details class="sources"><summary>Fuentes consultadas · ${sources.length}</summary><ol>${sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></li>`).join("")}</ol></details>`
    : "";
}
function pollJob() {
  clearTimeout(state.poll);
  if (!state.job || !state.user) return;
  const currentId = state.job.id;
  state.poll = setTimeout(async () => {
    try {
      if (!document.hidden && !state.busy) {
        const { job } = await api(`/api/jobs/${currentId}`);
        if (state.job?.id !== currentId) return;
        if (job.updated !== state.job.updated) {
          const delivered =
            job.status === "delivered" && state.job.status !== "delivered";
          state.job = job;
          renderJob(true);
          if (delivered)
            toast("Mecha entregó tu pedido. Ya puedes abrirlo o descargarlo.");
        }
      }
    } catch (e) {
      toast(e.message);
    }
    if (state.job?.id === currentId) pollJob();
  }, 5000);
}
function watchOrders() {
  clearTimeout(state.watch);
  if (!state.user || state.user.role === "admin") return;
  state.watch = setTimeout(async () => {
    try {
      if (!document.hidden) {
        const { jobs } = await api("/api/jobs");
        for (const j of jobs) {
          if (
            state.known.has(j.id) &&
            state.known.get(j.id) !== "delivered" &&
            j.status === "delivered" &&
            state.job?.id !== j.id
          )
            toast("Mecha entregó un pedido. Ábrelo desde tu historial.");
          state.known.set(j.id, j.status);
        }
        if (!$("#drawer").hidden) await openDrawer();
      }
    } catch (e) {
      toast(e.message);
    }
    watchOrders();
  }, 10000);
}
function closeDrawer() {
  $("#drawer").hidden = true;
  $("#drawer-shade").hidden = true;
  $("#history-button")?.focus();
}
async function openDrawer() {
  $("#drawer").hidden = false;
  $("#drawer-shade").hidden = false;
  $("#drawer").innerHTML =
    '<div class="drawer-head"><h2>Tus pedidos</h2><button class="icon-button" id="close-history" aria-label="Cerrar historial">×</button></div><p class="muted">Cargando tus solicitudes…</p>';
  $("#close-history").onclick = closeDrawer;
  try {
    const { jobs } = await api("/api/jobs");
    const status = statusLabels;
    $("#drawer").innerHTML =
      `<div class="drawer-head"><h2>Tus pedidos</h2><button class="icon-button" id="close-history" aria-label="Cerrar historial">×</button></div><button class="secondary full" id="history-new">${icons.plus}Nuevo pedido</button><div class="history-list">${jobs.length ? jobs.map((j) => `<article><button class="history-item" data-job="${esc(j.id)}"><span>${esc(j.prompt)}</span><small>${status[j.status]} · ${new Date(j.created).toLocaleDateString("es-MX")}</small></button>${j.status === "delivered" ? `<button class="delete-job" data-delete="${esc(j.id)}" aria-label="Eliminar solicitud" title="Eliminar">×</button>` : ""}</article>`).join("") : '<div class="empty-history">Aquí aparecerán tus ideas y entregas.<br>Empieza con tu primer pedido.</div>'}</div>`;
    $("#close-history").onclick = closeDrawer;
    $("#history-new").onclick = () => {
      closeDrawer();
      renderHome();
    };
    document.querySelectorAll("[data-job]").forEach(
      (button) =>
        (button.onclick = async () => {
          try {
            clearTimeout(state.poll);
            const { job } = await api(`/api/jobs/${button.dataset.job}`);
            state.job = job;
            state.uploads = [];
            closeDrawer();
            renderJob();
            pollJob();
          } catch (e) {
            toast(e.message);
          }
        }),
    );
    document.querySelectorAll("[data-delete]").forEach(
      (button) =>
        (button.onclick = async () => {
          if (!confirm("¿Eliminar esta solicitud y sus entregas?")) return;
          try {
            await api(`/api/jobs/${button.dataset.delete}`, {
              method: "DELETE",
            });
            if (state.job?.id === button.dataset.delete) renderHome();
            await openDrawer();
          } catch (e) {
            toast(e.message);
          }
        }),
    );
    $("#close-history").focus();
  } catch (e) {
    toast(e.message);
    closeDrawer();
  }
}
$("#drawer-shade").onclick = closeDrawer;
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
});
$("#close-preview").onclick = () => {
  $("#preview-dialog").close();
  $("#preview-dialog iframe").src = "about:blank";
};
document.querySelectorAll("dialog").forEach((dialog) =>
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  }),
);
async function boot() {
  try {
    const result = await api("/api/session");
    Object.assign(state, result);
    navigation();
    const hash = new URLSearchParams(location.hash.slice(1)),
      token = hash.get("alta"),
      resetToken = hash.get("clave");
    if (resetToken) {
      history.replaceState(null, "", location.pathname);
      const reset = await api("/api/reset/check", {
        method: "POST",
        data: { token: resetToken },
      });
      state.resetToken = resetToken;
      state.resetEmail = reset.email;
      renderReset();
    } else if (token) {
      history.replaceState(null, "", location.pathname);
      const invitation = await api("/api/invite", {
        method: "POST",
        data: { token },
      });
      state.inviteToken = token;
      state.inviteEmail = invitation.email;
      state.authMode = "register";
      renderAuth();
    } else enterSpace();
  } catch (e) {
    app.innerHTML = `<div class="boot"><p>${esc(e.message)}</p><button id="boot-retry" class="secondary">Volver a conectar</button></div>`;
    $("#boot-retry").onclick = boot;
  }
}
function enterSpace() {
  navigation();
  if (!state.user) {
    if (state.targetJob) state.authMode = "login";
    return location.pathname === "/operacion" || state.targetJob
      ? renderAuth()
      : renderHome();
  }
  if (state.user.role === "admin") return renderAdmin();
  if (location.pathname === "/operacion") {
    app.className = "auth-layout";
    app.innerHTML =
      '<section class="auth-card"><h1>Esta cuenta es de cliente.</h1><p>La bandeja de operación necesita una cuenta de administrador.</p><a class="primary" href="/">Ir a mi espacio</a><button id="other-account" class="text-button">Entrar con otra cuenta</button></section>';
    $("#other-account").onclick = logout;
    return;
  }
  if (state.profile && state.targetJob) {
    const target = state.targetJob;
    state.targetJob = null;
    openCustomerJob(target);
  } else state.profile ? renderHome() : renderProfile();
  watchOrders();
}
async function renderAdmin() {
  clearTimeout(state.watch);
  clearTimeout(state.poll);
  app.className = "operator";
  navigation();
  app.innerHTML = `<section class="operator-heading"><div><span class="eyebrow"><span class="spark"></span>MECHA · OPERACIÓN</span><h1>De la idea a la entrega.</h1><p class="muted">Revisa el pedido, prepara el producto y publícalo cuando esté listo.</p></div><button id="refresh-orders" class="secondary">Actualizar pedidos ↻</button></section><div id="order-counts" class="order-counts"></div><div class="operator-grid"><aside class="order-inbox"><h2>Pedidos</h2><label class="sr-only" for="order-search">Buscar pedidos</label><input id="order-search" type="search" placeholder="Buscar negocio, correo o pedido…" value="${esc(state.adminSearch)}"><label class="sr-only" for="order-filter">Filtrar pedidos</label><select id="order-filter"><option value="">Todos</option><option value="received">Solicitudes recibidas</option><option value="awaiting_approval">Por aprobar</option><option value="in_progress">En proceso</option><option value="needs_info">Falta información</option><option value="delivered">Entregados</option></select><div id="order-list"><p class="muted">Cargando pedidos…</p></div></aside><section id="order-detail" class="operator-detail"><div class="empty-order"><span>↗</span><h2>Cada pedido empieza con una idea.</h2><p>Selecciona uno para revisar el negocio y preparar su entrega.</p></div></section></div>`;
  $("#order-search").oninput = (e) => {
    state.adminSearch = e.target.value;
    renderInbox();
  };
  $("#order-filter").value = state.adminFilter;
  $("#order-filter").onchange = (e) => {
    state.adminFilter = e.target.value;
    renderInbox();
  };
  $("#refresh-orders").onclick = async () => {
    await loadInbox();
    if (state.adminJob) await selectOrder(state.adminJob.id);
  };
  await loadInbox();
  scheduleInbox();
}
async function loadInbox() {
  try {
    const { jobs, counts } = await api("/api/admin/jobs");
    state.adminJobs = jobs;
    if (!$("#order-counts")) return;
    $("#order-counts").innerHTML = [
      ["received", "Recibidas"],
      ["awaiting_approval", "Por aprobar"],
      ["in_progress", "En proceso"],
      ["needs_info", "Falta información"],
      ["delivered", "Entregados"],
    ]
      .map(
        ([key, label]) =>
          `<div><strong>${counts[key] || 0}</strong><span>${label}</span></div>`,
      )
      .join("");
    renderInbox();
  } catch (e) {
    toast(e.message);
  }
}
function scheduleInbox() {
  clearTimeout(state.watch);
  if (state.user?.role !== "admin") return;
  state.watch = setTimeout(async () => {
    if (!document.hidden) await loadInbox();
    scheduleInbox();
  }, 10000);
}
function renderInbox() {
  const list = $("#order-list");
  if (!list) return;
  const query = state.adminSearch.toLowerCase();
  const jobs = state.adminJobs.filter(
    (j) =>
      (!state.adminFilter || j.status === state.adminFilter) &&
      `${j.profile.name} ${j.email} ${j.prompt}`.toLowerCase().includes(query),
  );
  list.innerHTML = jobs.length
    ? jobs
        .map(
          (j) =>
            `<button class="inbox-order ${state.adminJob?.id === j.id ? "selected" : ""}" data-order="${j.id}"><div><strong>${esc(j.profile.name || "Negocio")}</strong><time>${stamp(j.created)}</time></div><p>${esc(j.prompt)}</p>${badge(j.status)}${j.status === "delivered" && !j.customer_notified_at ? '<small class="pending-notice">Pendiente avisar</small>' : ""}</button>`,
        )
        .join("")
    : '<p class="empty-history">No hay pedidos con este filtro.</p>';
  list
    .querySelectorAll("[data-order]")
    .forEach((b) => (b.onclick = () => selectOrder(b.dataset.order)));
}
async function selectOrder(id) {
  try {
    const { job } = await api(`/api/admin/jobs/${id}`);
    state.adminJob = job;
    renderInbox();
    renderOrderDetail();
  } catch (e) {
    toast(e.message);
  }
}
function renderOrderDetail() {
  const job = state.adminJob,
    p = job.profile || {},
    root = $("#order-detail");
  if (!root) return;
  const links = ["website", "instagram", "facebook"]
    .filter((k) => p[k])
    .map(
      (k) =>
        `<a href="${esc(p[k])}" target="_blank" rel="noopener noreferrer">${{ website: "Página web", instagram: "Instagram", facebook: "Facebook" }[k]} ↗</a>`,
    )
    .join("");
  root.innerHTML = `<div class="operator-detail-top"><span class="step-label">PEDIDO · ${stamp(job.created)}</span>${badge(job.status)}</div><section class="business-context"><h2>${esc(p.name || "Negocio")}</h2><p>${esc(p.activity)}</p><p class="small muted">${esc(job.email)}${p.city ? " · " + esc(p.city) : ""}</p>${p.whatsapp ? `<p class="small">WhatsApp: ${esc(p.whatsapp)}</p>` : ""}<div class="business-links">${links}</div>${p.goal ? `<p><strong>Objetivo:</strong> ${esc(p.goal)}</p>` : ""}<details class="account-reset"><summary>¿El cliente olvidó su contraseña?</summary><p class="small muted">Genera un enlace de un solo uso (vence en 48 h) y envíaselo tú. Al usarlo se cierran sus sesiones abiertas.</p><button type="button" class="secondary" id="account-reset">Generar enlace</button><input id="account-reset-link" readonly hidden><p class="form-error" role="alert"></p></details></section><section class="operator-request"><span class="step-label">LO QUE NECESITA</span><p>${esc(job.prompt)}</p>${originalFiles(job.attachments)}${job.desired_result ? `<p class="desired-result"><strong>Resultado esperado:</strong> ${esc(job.desired_result)}</p>` : ""}</section>${renderProposal(job, true)}${proposalForm(job)}${noticePanel(job)}${job.feedback ? `<div class="feedback-summary"><h3>Resultado reportado por el cliente</h3><p>${esc(job.feedback)}</p><small>Declaración del cliente; revisa sus datos antes de usarla como caso de éxito.</small></div>` : ""}${job.related?.length ? `<div class="related-orders"><h3>Pedidos de esta conversación</h3>${job.related.map((j) => `<button class="text-button" data-related="${j.id}">${esc(j.prompt)} · ${statusLabels[j.status]} ↗</button>`).join("")}</div>` : ""}${renderComments(job)}${job.status === "delivered" ? `<section class="published-delivery"><h3>Entrega publicada</h3><div class="markdown">${markdown(job.response)}</div>${job.delivery_url ? `<a class="text-button" href="${esc(job.delivery_url)}" target="_blank" rel="noopener noreferrer">Abrir enlace entregado ↗</a>` : ""}${renderArtifacts(job.artifacts || [])}</section>` : ""}<form id="status-form" class="operator-form"><h3>Comunícate con el cliente</h3><label>Mensaje<textarea name="message" rows="3" maxlength="10000" placeholder="Explica qué necesitas para continuar…"></textarea></label><div class="status-actions"><button class="secondary" type="submit" value="needs_info" name="status">Pedir información</button><button class="text-button" type="submit" value="in_progress" name="status">Marcar en proceso</button></div><p class="form-error" role="alert"></p></form><form id="delivery-form" class="operator-form delivery-form"><span class="step-label">${job.status === "delivered" ? "ACTUALIZAR ENTREGA" : "PUBLICAR ENTREGA"}</span><h3>El producto está listo.</h3><p class="small muted">Al publicar, el cliente verá “Entregado” y podrá abrir estos archivos o el enlace.</p><label>Mensaje o contenido de la entrega<textarea name="message" rows="5" maxlength="10000" placeholder="Qué estás entregando y cómo usarlo…">${job.status === "delivered" ? esc(job.response) : ""}</textarea></label><label>Enlace de entrega <span>opcional</span><input name="url" type="url" value="${job.status === "delivered" ? esc(job.delivery_url) : ""}" placeholder="https://…" maxlength="1500"></label><label>Archivos de entrega <span>opcional</span><input name="files" type="file" multiple accept="${deliveryAccept}"></label><p class="small muted">Hasta 8 archivos y 20 MB por publicación. Puedes entregar documentos, presentaciones, imágenes, video, audio, HTML o ZIP. Para archivos más grandes, agrega un enlace.</p><p class="form-error" role="alert"></p><button class="primary full" type="submit">Publicar entrega <span>↗</span></button></form>`;
  bindPreviews();
  root
    .querySelectorAll("[data-related]")
    .forEach((b) => (b.onclick = () => selectOrder(b.dataset.related)));
  bindOperatorProposal(job);
  bindNotice(job);
  $("#account-reset")?.addEventListener("click", async (e) => {
    const button = e.currentTarget,
      output = $("#account-reset-link"),
      error = $(".account-reset .form-error");
    button.disabled = true;
    error.textContent = "";
    try {
      const { url } = await api(`/api/admin/jobs/${job.id}/reset`, {
        method: "POST",
        data: {},
      });
      output.value = url;
      output.hidden = false;
      output.select();
      await navigator.clipboard.writeText(url).then(
        () => toast("Enlace copiado. Envíalo solo al cliente."),
        () => toast("Selecciona y copia el enlace."),
      );
    } catch (err) {
      error.textContent = err.message;
    } finally {
      button.disabled = false;
    }
  });
  const agreementPending = job.proposal_required && !job.proposal?.accepted_at;
  if (agreementPending) {
    $("#status-form button[value=in_progress]").disabled = true;
    $("#delivery-form button[type=submit]").disabled = true;
    $("#delivery-form .muted").textContent =
      "Falta la aprobación del cliente. Puedes preparar la entrega, pero solo podrás publicarla cuando acepte la propuesta vigente.";
  }
  $("#status-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget,
      data = Object.fromEntries(new FormData(form));
    data.status = e.submitter.value;
    data.updated = job.updated;
    await adminAction(form, async () => {
      const result = await api(`/api/admin/jobs/${job.id}`, {
        method: "PATCH",
        data,
      });
      state.adminJob = result.job;
      renderOrderDetail();
      await loadInbox();
      toast("El estado y el mensaje se actualizaron para el cliente.");
    });
  };
  $("#delivery-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget,
      formData = new FormData(form);
    formData.append("updated", job.updated);
    await adminAction(form, async () => {
      const result = await api(`/api/admin/jobs/${job.id}/delivery`, {
        method: "POST",
        form: formData,
      });
      state.adminJob = result.job;
      renderOrderDetail();
      await loadInbox();
      toast("Entrega publicada. El cliente ya puede verla en su cuenta.");
    });
  };
}
async function adminAction(form, action) {
  const buttons = [...form.querySelectorAll("button")];
  if (buttons.some((b) => b.disabled)) return;
  buttons.forEach((b) => (b.disabled = true));
  $(".form-error", form).textContent = "";
  try {
    await action();
  } catch (e) {
    $(".form-error", form).textContent = e.message;
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

window.addEventListener("hashchange", () => {
  const hash = new URLSearchParams(location.hash.slice(1));
  if (hash.has("alta") || hash.has("clave")) boot();
});
function openCatalog() {
  const categories = [...new Set(availableServices.map((s) => s.category))];
  $("#catalog-category").innerHTML =
    '<option value="">Todas las categorías</option>' +
    categories
      .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
      .join("");
  $("#catalog-search").value = "";
  $("#catalog-search").oninput = renderCatalog;
  $("#catalog-category").onchange = renderCatalog;
  $("#close-catalog").onclick = () => $("#catalog-dialog").close();
  renderCatalog();
  $("#catalog-dialog").showModal();
  $("#catalog-search").focus();
}
function renderCatalog() {
  const query = $("#catalog-search").value,
    category = $("#catalog-category").value;
  const services = findServices(query, category).sort(
    (a, b) => Number(b.featured) - Number(a.featured) || a.id - b.id,
  );
  $("#catalog-count").textContent =
    `${services.length} ${services.length === 1 ? "opción" : "opciones"} para pedir a Mecha`;
  $("#catalog-results").innerHTML = services.length
    ? services
        .map(
          (service) =>
            `<button type="button" class="catalog-service" data-service="${service.id}"><div><span>${esc(service.category)}</span>${service.featured ? "<small>PARA EMPEZAR</small>" : ""}</div><h3>${esc(service.title)} <span>↗</span></h3><p>${esc(service.prompt)}</p>${service.setup ? '<small class="setup-note">Proyecto de implementación · definimos contigo accesos y reglas.</small>' : ""}</button>`,
        )
        .join("")
    : '<div class="empty-history">No encontramos esa opción. Puedes escribir tu pedido con tus propias palabras.</div>';
  $("#catalog-results")
    .querySelectorAll("[data-service]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          const service = availableServices.find(
            (s) => s.id === Number(button.dataset.service),
          );
          $("#catalog-dialog").close();
          $("#prompt").value = service.prompt;
          $("#prompt").focus();
          $("#prompt").dispatchEvent(new Event("input"));
        }),
    );
}

const symptomPrompts = {
  whatsapp:
    "Tardo en contestar WhatsApp y pierdo seguimiento de los prospectos. Ayúdenme a organizar la captación desde mis redes, las respuestas y el seguimiento. Revisemos mis canales y qué resultado podríamos medir.",
  quotes:
    "Cotizo a mano y se me olvidan los seguimientos. Quiero un proceso para preparar cotizaciones con mis precios, registrar oportunidades y dar seguimiento. Primero definamos alcance, accesos y qué vamos a medir.",
  data: "No sé qué está funcionando en mis ventas o campañas. Ayúdenme a ordenar mis datos y preparar un reporte con indicadores verificables y siguientes acciones.",
  web: "Quiero captar clientes para mi servicio. Revisemos mi oferta, una página con formulario y el proceso para atender y dar seguimiento a los contactos que lleguen.",
};
function beginRequestLogin() {
  state.pendingDraft = {
    prompt: $("#prompt")?.value || "",
    goal: $("#desired-result")?.value || "",
  };
  state.authMode = "register";
  renderAuth();
  toast(
    "Crea tu cuenta para guardar esta solicitud. Tu texto se conserva durante este proceso.",
  );
}
async function openCustomerJob(id) {
  try {
    const { job } = await api("/api/jobs/" + encodeURIComponent(id));
    state.job = job;
    state.uploads = [];
    renderJob();
    pollJob();
  } catch (e) {
    renderHome();
    toast(e.message);
  }
}
const money = (cents) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(
    cents / 100,
  );
function renderProposal(job, operator = false) {
  const p = job.proposal;
  if (!p) return "";
  const previous =
    job.proposal_history?.filter((x) => x.version !== p.version) || [];
  return `<section class="proposal-card"><div class="proposal-heading"><span class="step-label">PROPUESTA MECHA · VERSIÓN ${p.version}</span><span class="order-status ${p.accepted_at ? "delivered" : "awaiting_approval"}">${p.accepted_at ? "Aceptada" : "Por aprobar"}</span></div><h2>Esto es lo que vamos a resolver.</h2><dl><div><dt>Alcance y entregables</dt><dd>${esc(p.scope)}</dd></div><div><dt>Queda fuera</dt><dd>${esc(p.exclusions)}</dd></div><div><dt>Monto acordado</dt><dd class="proposal-price">${money(p.amount_cents)} MXN</dd></div><div><dt>Plazo y condiciones para iniciar</dt><dd>${esc(p.delivery)}</dd></div><div><dt>Rondas de ajustes incluidas</dt><dd>${p.revisions}</dd></div><div><dt>Impuestos, herramientas y otros costos</dt><dd>${esc(p.costs)}</dd></div></dl>${p.accepted_at ? `<p class="small muted">Aceptada desde esta cuenta el ${stamp(p.accepted_at)}.</p>` : operator ? '<p class="small muted">El cliente debe aprobar esta versión antes de iniciar o publicar la entrega.</p>' : `<form id="accept-proposal"><label class="agreement-check"><input type="checkbox" name="accepted" required><span>Revisé y acepto el alcance, monto, plazo, costos y ajustes de esta propuesta.</span></label><p class="small muted">Esta acción registra tu aprobación. La app no realiza cobros.</p><p class="form-error" role="alert"></p><button class="primary full" type="submit">Aprobar propuesta y comenzar ↗</button></form>`}${previous.length ? `<details class="proposal-versions"><summary>Versiones anteriores</summary>${previous.map((q) => `<article><strong>Versión ${q.version} · ${q.accepted_at ? "Aceptada" : "Sin aceptación"}</strong><p>${esc(q.scope)}</p><p>${money(q.amount_cents)} MXN · ${esc(q.delivery)} · ${q.revisions} rondas de ajustes</p><p>Fuera: ${esc(q.exclusions)}<br>Costos: ${esc(q.costs)}</p></article>`).join("")}</details>` : ""}</section>`;
}
function bindClientProposal(job) {
  const form = $("#accept-proposal");
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const button = $("button", form);
    button.disabled = true;
    state.busy = true;
    try {
      const result = await api("/api/jobs/" + job.id + "/accept", {
        method: "POST",
        data: {
          version: job.proposal.version,
          accepted: form.accepted.checked,
        },
      });
      state.job = result.job;
      renderJob(true);
      toast("Propuesta aceptada. Mecha ya puede comenzar con lo acordado.");
    } catch (e) {
      $(".form-error", form).textContent = e.message;
      button.disabled = false;
      state.busy = false;
    }
  };
}
function proposalForm(job) {
  if (job.status === "delivered") return "";
  const p = job.proposal || {};
  return `<form id="proposal-form" class="operator-form"><span class="step-label">ACORDAR ANTES DE TRABAJAR</span><h3>${job.proposal ? "Actualizar propuesta" : "Preparar propuesta"}</h3><p class="small muted">Confirma alcance, precio, plazo y costos reales. Cada cambio crea una versión que el cliente debe aprobar.</p><label>Alcance y entregables<textarea name="scope" rows="4" minlength="10" maxlength="5000" placeholder="Qué producto recibirá y qué incluye la implementación…" required>${esc(p.scope || "")}</textarea></label><label>Qué queda fuera<textarea name="exclusions" rows="2" minlength="3" maxlength="3000" placeholder="Define qué requerirá un pedido o acuerdo adicional…" required>${esc(p.exclusions || "")}</textarea></label><div class="form-grid"><label>Monto confirmado en MXN<input name="amount" type="number" min="0" step="0.01" value="${p.amount_cents != null ? (p.amount_cents / 100).toFixed(2) : ""}" placeholder="Por confirmar" required></label><label>Rondas de ajustes<input name="revisions" type="number" min="0" max="20" step="1" value="${p.revisions ?? ""}" placeholder="Por confirmar" required></label></div><label>Plazo y condiciones para iniciar<input name="delivery" minlength="3" maxlength="500" value="${esc(p.delivery || "")}" placeholder="Fecha o plazo confirmado, con sus condiciones…" required></label><label>Impuestos y costos externos<textarea name="costs" rows="2" minlength="3" maxlength="1500" placeholder="Qué está incluido; qué paga el cliente por hosting, mensajería o herramientas…" required>${esc(p.costs || "")}</textarea></label><p class="form-error" role="alert"></p><button class="primary full" type="submit">Enviar propuesta para aprobación ↗</button></form>`;
}
function bindOperatorProposal(job) {
  const form = $("#proposal-form");
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.revisions = Number(data.revisions);
    data.updated = job.updated;
    await adminAction(form, async () => {
      const result = await api("/api/admin/jobs/" + job.id + "/proposal", {
        method: "POST",
        data,
      });
      state.adminJob = result.job;
      renderOrderDetail();
      await loadInbox();
      toast("Propuesta enviada. El trabajo espera la aprobación del cliente.");
    });
  };
}
function renderFeedback(job) {
  return `<form id="feedback-form" class="feedback-card"><span class="step-label">DEL ENTREGABLE AL RESULTADO</span><h3>¿Qué cambió en tu negocio?</h3><p class="small muted">Cuéntanos qué pudiste hacer con esta entrega. Si ya mediste un resultado, indica el dato, periodo y fuente; también puedes decir que aún no lo sabes.</p><label class="sr-only" for="feedback">Resultado de la entrega</label><textarea id="feedback" name="feedback" rows="3" minlength="3" maxlength="1500" required placeholder="Resultado observado y cómo lo comprobaste…">${esc(job.feedback || "")}</textarea><p class="form-error" role="alert"></p><button class="secondary" type="submit">Guardar resultado</button></form>`;
}
function bindFeedback(job) {
  const form = $("#feedback-form");
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    $("button", form).disabled = true;
    try {
      const result = await api("/api/jobs/" + job.id + "/feedback", {
        method: "POST",
        data: { feedback: form.feedback.value },
      });
      state.job = result.job;
      toast("Resultado guardado para dar seguimiento con Mecha.");
    } catch (e) {
      $(".form-error", form).textContent = e.message;
    } finally {
      $("button", form).disabled = false;
    }
  };
}

function noticePanel(job) {
  if (job.status !== "delivered") return "";
  const link = new URL("/?pedido=" + job.id, location.origin).href;
  const local = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(
    location.hostname,
  );
  return `<section class="notice-card"><span class="step-label">AVISO MANUAL AL CLIENTE</span><h3>${job.customer_notified_at ? "Aviso registrado" : "La entrega está publicada. Falta avisar."}</h3><p class="small muted">${job.customer_notified_at ? "Confirmaste el aviso el " + stamp(job.customer_notified_at) + ". Si vuelves a publicar, debes avisar otra vez." : "El cliente la verá al entrar a su cuenta. La app no envía mensajes externos."}</p><label class="small">Enlace privado al pedido<input id="delivery-private-link" readonly value="${esc(link)}"></label>${local ? '<p class="small muted">Este enlace es local y no abre en la computadora del cliente. Configura el dominio público antes de compartirlo.</p>' : '<button type="button" class="secondary" id="copy-delivery-link">Copiar enlace</button>'}<form id="notice-form"><label class="agreement-check"><input type="checkbox" name="confirmed" required><span>Confirmo que avisé personalmente al cliente de esta entrega.</span></label><p class="form-error" role="alert"></p><button class="secondary" type="submit">Registrar aviso</button></form></section>`;
}
function bindNotice(job) {
  const form = $("#notice-form");
  if (!form) return;
  $("#copy-delivery-link")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText($("#delivery-private-link").value);
      toast("Enlace copiado. El cliente necesitará entrar a su cuenta.");
    } catch {
      $("#delivery-private-link").select();
      toast("Selecciona y copia el enlace.");
    }
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    await adminAction(form, async () => {
      const result = await api("/api/admin/jobs/" + job.id + "/notice", {
        method: "POST",
        data: { confirmed: form.confirmed.checked, updated: job.updated },
      });
      state.adminJob = result.job;
      renderOrderDetail();
      await loadInbox();
      toast("Tu confirmación quedó registrada.");
    });
  };
}
boot();
