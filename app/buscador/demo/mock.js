// Servidor simulado para la demo pública: responde las mismas rutas que
// src/server.js, pero en memoria y con datos de ejemplo. Nada sale del navegador.
const HOUR = 60 * 60 * 1000,
  DAY = 24 * HOUR;
const uid = () =>
  crypto.randomUUID?.() ||
  "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () =>
    ((Math.random() * 16) | 0).toString(16),
  );

const SAMPLE_PAGE = `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>Pedidos para eventos</title></head><body style="margin:0;font-family:Georgia,serif;background:#fbf6ee;color:#2b2118"><header style="padding:40px 28px;background:#2b2118;color:#fbf6ee"><p style="letter-spacing:.2em;font-size:12px;margin:0 0 10px">PANADERÍA DE EJEMPLO</p><h1 style="margin:0;font-size:34px">Pide tu pastel para evento en 3 pasos</h1><p style="max-width:520px">Elige el tamaño, el sabor y la fecha. Te confirmamos disponibilidad por WhatsApp.</p></header><main style="padding:28px;display:grid;gap:16px;max-width:640px"><section style="background:#fff;border:1px solid #eadfcd;border-radius:12px;padding:18px"><h2 style="margin-top:0">1. Tamaño</h2><p>Chico, mediano o grande. El precio se confirma al cotizar.</p></section><section style="background:#fff;border:1px solid #eadfcd;border-radius:12px;padding:18px"><h2 style="margin-top:0">2. Sabor y decoración</h2><p>Vainilla, chocolate o tres leches. Puedes adjuntar una foto de referencia.</p></section><section style="background:#fff;border:1px solid #eadfcd;border-radius:12px;padding:18px"><h2 style="margin-top:0">3. Fecha y entrega</h2><p>Recoger en tienda o envío. Te respondemos con la cotización.</p></section></main></body></html>`;

const kinds = {
  xlsx: "spreadsheet",
  xls: "spreadsheet",
  csv: "spreadsheet",
  docx: "document",
  doc: "document",
  pptx: "presentation",
  pdf: "pdf",
  html: "html",
  htm: "html",
  txt: "text",
  md: "text",
  zip: "package",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  mp4: "video",
  mov: "video",
  mp3: "audio",
  wav: "audio",
};

function seed() {
  const now = Date.now();
  const db = {
    as: "client",
    users: {
      cliente: { id: "cliente", email: "demo@panaderia.example", role: "client" },
      despacho: { id: "despacho", email: "demo@despacho.example", role: "client" },
      mecha: { id: "mecha", email: "operacion@mecha.example", role: "admin" },
    },
    profiles: {
      cliente: {
        name: "Panadería de ejemplo",
        activity:
          "Panadería con pedidos de pasteles para eventos y venta a cafeterías. Hoy todo llega por WhatsApp.",
        city: "Aguascalientes, Ags.",
        website: "",
        instagram: "https://instagram.com/panaderia.ejemplo",
        facebook: "",
        whatsapp: "",
        goal: "Cotizar más rápido y no perder pedidos entre mensajes.",
      },
      despacho: {
        name: "Despacho contable de ejemplo",
        activity: "Contabilidad y nómina para PyMEs. Agendan citas por mensaje.",
        city: "León, Gto.",
        website: "",
        instagram: "",
        facebook: "",
        whatsapp: "",
        goal: "Ordenar la agenda de citas.",
      },
    },
    uploads: {},
    jobs: [],
  };
  const upload = (owner, name) => {
    const id = uid();
    db.uploads[id] = {
      id,
      user_id: owner,
      name,
      summary: { type: "file", bytes: 48200 },
    };
    return id;
  };
  const terms = (scope, exclusions, delivery, costs, revisions) => ({
    scope,
    exclusions,
    delivery,
    costs,
    amount_cents: null,
    currency: "MXN",
    revisions,
  });
  const job = (owner, ago, prompt, extra = {}) => {
    const created = now - ago;
    const j = {
      id: uid(),
      user_id: owner,
      thread_id: uid(),
      prompt,
      status: "received",
      desired_result: "",
      created,
      updated: created,
      proposal_required: 1,
      response: "",
      delivery_url: "",
      customer_notified_at: null,
      feedback: "",
      attachments: [],
      comments: [],
      proposals: [],
      artifacts: [],
      business_snapshot: { ...db.profiles[owner] },
      ...extra,
    };
    db.jobs.push(j);
    return j;
  };
  const say = (j, role, body, at) =>
    j.comments.push({
      id: uid(),
      role,
      author_id: role === "admin" ? "mecha" : j.user_id,
      body,
      created: at,
      attachments: [],
    });

  // 1. Entregado: cotizador + página de pedidos.
  const delivered = job(
    "cliente",
    6 * DAY,
    "Cotizo los pasteles a mano por WhatsApp y tardo mucho en responder. Quiero algo para cotizar rápido y una página donde la gente haga su pedido.",
    {
      desired_result:
        "Responder cotizaciones el mismo día y que los pedidos lleguen con la información completa.",
    },
  );
  delivered.proposals.push({
    ...terms(
      "Hoja de cálculo para cotizar pasteles por tamaño, sabor y decoración, y una página de pedidos para eventos con guía de uso.",
      "No incluye cobros en línea, dominio ni conexión directa a WhatsApp.",
      "Entrega en los días acordados después de recibir tu lista de precios.",
      "Sin costos externos para esta entrega.",
      2,
    ),
    version: 1,
    created: now - 6 * DAY + 3 * HOUR,
    accepted_at: now - 5 * DAY,
  });
  delivered.proposal_version = 1;
  say(
    delivered,
    "admin",
    "Mecha envió una propuesta con alcance, monto, plazo y ajustes para tu aprobación.",
    now - 6 * DAY + 3 * HOUR,
  );
  say(delivered, "client", "El cliente aceptó la propuesta de Mecha.", now - 5 * DAY);
  delivered.artifacts.push(
    {
      id: uid(),
      name: "Cotizador de pasteles.xlsx",
      kind: "spreadsheet",
      mime: "application/vnd.ms-excel",
    },
    {
      id: uid(),
      name: "Pagina de pedidos.html",
      kind: "html",
      mime: "text/html",
      html: SAMPLE_PAGE,
    },
  );
  delivered.status = "delivered";
  delivered.response =
    "**Tu cotizador y tu página de pedidos están listos.**\n\n1. Abre el cotizador, escribe tamaño, sabor y decoración: el total sale solo.\n2. La página de pedidos junta los datos que antes pedías mensaje por mensaje.\n3. Si quieres cambiar precios, edita la pestaña *Precios*.\n\nCualquier ajuste dentro de las dos rondas incluidas, pídelo como nuevo pedido desde aquí.";
  delivered.updated = now - DAY;
  say(delivered, "admin", "Mecha publicó la entrega.", now - DAY);

  // 2. Por aprobar: propuesta enviada.
  const awaiting = job(
    "cliente",
    2 * DAY,
    "Quiero publicar en Instagram cada semana pero no sé qué subir. Ayúdame con un calendario de contenido.",
  );
  awaiting.proposals.push({
    ...terms(
      "Calendario de contenido para Instagram de cuatro semanas con ideas, textos y formato sugerido para cada publicación.",
      "No incluye fotografía, diseño de piezas ni manejo de la cuenta.",
      "Entrega después de una llamada corta para conocer tus productos.",
      "Sin costos externos.",
      1,
    ),
    version: 1,
    created: now - DAY,
    accepted_at: null,
  });
  awaiting.proposal_version = 1;
  awaiting.status = "awaiting_approval";
  awaiting.updated = now - DAY;
  say(
    awaiting,
    "admin",
    "Mecha envió una propuesta con alcance, monto, plazo y ajustes para tu aprobación.",
    now - DAY,
  );

  // 3. Falta información: Excel adjunto.
  const info = job(
    "cliente",
    20 * HOUR,
    "Limpia mi Excel de clientes: hay duplicados y los teléfonos vienen en formatos distintos.",
    { attachments: [upload("cliente", "clientes.xlsx")] },
  );
  info.status = "needs_info";
  info.updated = now - 18 * HOUR;
  say(
    info,
    "admin",
    "¿Quieres conservar los clientes sin teléfono o los separamos en otra pestaña?",
    now - 18 * HOUR,
  );

  // 4. Otro negocio, en proceso.
  const other = job(
    "despacho",
    3 * DAY,
    "Los clientes me piden cita por mensaje y se me cruzan. Quiero una forma de agendar sin estar contestando todo el día.",
  );
  other.proposals.push({
    ...terms(
      "Proceso de agenda con formulario de cita, confirmación y recordatorio, más una guía para operarlo.",
      "No incluye la suscripción a la herramienta de agenda.",
      "Inicia al recibir los accesos acordados.",
      "La herramienta de agenda se paga aparte, según el plan que elijas.",
      1,
    ),
    version: 1,
    created: now - 2 * DAY,
    accepted_at: now - 40 * HOUR,
  });
  other.proposal_version = 1;
  other.status = "in_progress";
  other.updated = now - 40 * HOUR;
  say(other, "client", "El cliente aceptó la propuesta de Mecha.", now - 40 * HOUR);

  // 5. Recién recibido.
  const fresh = job(
    "despacho",
    2 * HOUR,
    "Necesito un reporte mensual de mis gastos a partir del Excel que ya uso.",
    { attachments: [upload("despacho", "gastos.xlsx")] },
  );
  fresh.desired_result = "Ver en una sola hoja en qué se va el dinero cada mes.";
  return db;
}

let db = seed();
export const demo = {
  reset() {
    db = seed();
  },
  setRole(role) {
    db.as = role;
  },
  role: () => db.as,
};

class Fail extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const check = (ok, message, status) => {
  if (!ok) throw new Fail(message, status);
};
const me = () =>
  db.as === "admin"
    ? db.users.mecha
    : db.as === "client"
      ? db.users.cliente
      : null;
const tick = (j) => (j.updated = Math.max(Date.now(), j.updated + 1));
const publicUpload = (id) => {
  const u = db.uploads[id];
  return u && { id: u.id, name: u.name, summary: u.summary };
};

function view(j, admin) {
  const delivered = j.status === "delivered";
  const proposal = (p) => {
    const { ...rest } = p;
    return rest;
  };
  const current = j.proposals.find((p) => p.version === j.proposal_version);
  const attachments = j.attachments.map(publicUpload).filter(Boolean);
  return {
    id: j.id,
    user_id: j.user_id,
    thread_id: j.thread_id,
    prompt: j.prompt,
    status: j.status,
    created: j.created,
    updated: j.updated,
    desired_result: j.desired_result,
    proposal_required: j.proposal_required,
    proposal_version: j.proposal_version || 0,
    customer_notified_at: j.customer_notified_at,
    feedback: j.feedback,
    response: admin || delivered ? j.response : "",
    delivery_url: admin || delivered ? j.delivery_url : "",
    profile: j.business_snapshot,
    email: admin ? db.users[j.user_id].email : undefined,
    comments: j.comments.map((c) => {
      const files = c.attachments.map(publicUpload).filter(Boolean);
      return { ...c, attachments: files, attachment: files[0] || null };
    }),
    proposal: current ? proposal(current) : null,
    proposal_history: j.proposals.map(proposal),
    related: admin
      ? db.jobs
          .filter(
            (o) =>
              o.user_id === j.user_id &&
              o.thread_id === j.thread_id &&
              o.id !== j.id,
          )
          .map((o) => ({
            id: o.id,
            prompt: o.prompt,
            status: o.status,
            created: o.created,
          }))
      : [],
    sources: [],
    attachments,
    attachment: attachments[0] || null,
    artifacts:
      admin || delivered
        ? j.artifacts.map(({ id, name, kind, mime }) => ({ id, name, kind, mime }))
        : [],
  };
}
function find(id, user, admin = false) {
  const j = db.jobs.find((x) => x.id === id && (admin || x.user_id === user.id));
  check(j, "Solicitud no encontrada.", 404);
  return j;
}
function replyStatus(j) {
  const p = j.proposals.find((x) => x.version === j.proposal_version);
  if (!j.proposal_required || p?.accepted_at) return "in_progress";
  return p ? "awaiting_approval" : "received";
}
function attachIds(input, user) {
  const ids = [...new Set(input.uploadIds || [])];
  check(ids.length <= 8, "Adjunta hasta ocho archivos.");
  for (const id of ids)
    check(db.uploads[id]?.user_id === user.id, "Archivo no encontrado.", 404);
  return ids;
}
function terms(input) {
  const text = (key, label, min) => {
    const v = String(input[key] || "").trim();
    check(v.length >= min, `Completa ${label}.`);
    return v;
  };
  const scope = text("scope", "el alcance y entregables", 10),
    exclusions = text("exclusions", "qué queda fuera", 3),
    delivery = text("delivery", "el plazo y condiciones", 3),
    costs = text("costs", "los costos externos", 3);
  const amount = String(input.amount || "");
  check(
    /^\d{1,8}(\.\d{1,2})?$/.test(amount),
    "Confirma un monto en MXN con hasta dos decimales.",
  );
  const [whole, dec = ""] = amount.split(".");
  const revisions = Number(input.revisions);
  check(
    Number.isInteger(revisions) && revisions >= 0 && revisions <= 20,
    "Confirma cuántas rondas de ajustes incluye.",
  );
  return {
    scope,
    exclusions,
    delivery,
    costs,
    amount_cents: Number(whole) * 100 + Number(dec.padEnd(2, "0")),
    currency: "MXN",
    revisions,
  };
}

async function handle(path, method, body) {
  const user = me();
  const json = (v) => v;
  if (path === "/api/health") return { ok: true, workflow: "manual" };
  if (path === "/api/session")
    return {
      user,
      profile: user && user.role === "client" ? db.profiles[user.id] : null,
      workflow: "manual",
    };
  if (path === "/api/login" || path === "/api/register") {
    db.as = "client";
    return { user: me(), profile: db.profiles.cliente, workflow: "manual" };
  }
  if (path === "/api/invite" || path.startsWith("/api/reset"))
    throw new Fail("Este enlace no funciona en la demo.");
  check(user, "Inicia sesión para continuar.", 401);
  if (path === "/api/logout") {
    db.as = null;
    return { ok: true };
  }
  if (path === "/api/profile" && method === "PUT") {
    const p = {};
    for (const k of [
      "name",
      "activity",
      "city",
      "website",
      "instagram",
      "facebook",
      "whatsapp",
      "goal",
    ])
      p[k] = String(body[k] || "").trim();
    check(p.name.length >= 2, "Escribe el nombre de tu negocio.");
    check(p.activity.length >= 5, "Cuéntanos a qué se dedica tu negocio.");
    db.profiles[user.id] = p;
    return { profile: p };
  }

  if (path.startsWith("/api/admin/")) {
    check(user.role === "admin", "Solo Mecha puede administrar los pedidos.", 403);
    if (path === "/api/admin/jobs") {
      const jobs = [...db.jobs]
        .sort((a, b) => b.updated - a.updated)
        .map((j) => ({
          id: j.id,
          prompt: j.prompt,
          status: j.status,
          created: j.created,
          updated: j.updated,
          customer_notified_at: j.customer_notified_at,
          email: db.users[j.user_id].email,
          profile: j.business_snapshot,
        }));
      const counts = {};
      for (const j of db.jobs) counts[j.status] = (counts[j.status] || 0) + 1;
      return { jobs, counts };
    }
    const m = path.match(
      /^\/api\/admin\/jobs\/([a-f0-9-]+)(\/(delivery|proposal|notice|reset))?$/,
    );
    check(m, "Ruta no encontrada.", 404);
    const j = find(m[1], user, true);
    const action = m[3];
    if (!action && method === "GET") return { job: view(j, true) };
    if (!action && method === "PATCH") {
      const message = String(body.message || "").trim();
      check(
        ["in_progress", "needs_info"].includes(body.status),
        "Publica una entrega para marcar el pedido como entregado.",
      );
      check(
        body.status !== "needs_info" || message.length >= 3,
        "Explica qué información falta.",
      );
      if (body.status === "in_progress")
        check(
          replyStatus(j) === "in_progress",
          "El cliente debe aceptar la propuesta vigente antes de iniciar o publicar la entrega.",
          409,
        );
      tick(j);
      if (message)
        j.comments.push({
          id: uid(),
          role: "admin",
          author_id: user.id,
          body: message,
          created: j.updated,
          attachments: [],
        });
      j.status = body.status;
      return { job: view(j, true) };
    }
    if (action === "proposal") {
      check(
        j.status !== "delivered",
        "Crea una solicitud de ajuste para cotizar cambios a una entrega.",
      );
      const t = terms(body);
      tick(j);
      const version = (j.proposal_version || 0) + 1;
      j.proposals.push({ ...t, version, created: j.updated, accepted_at: null });
      j.proposal_version = version;
      j.status = "awaiting_approval";
      j.comments.push({
        id: uid(),
        role: "admin",
        author_id: user.id,
        body: "Mecha envió una propuesta con alcance, monto, plazo y ajustes para tu aprobación.",
        created: j.updated,
        attachments: [],
      });
      return { job: view(j, true) };
    }
    if (action === "delivery") {
      check(
        replyStatus(j) === "in_progress",
        "El cliente debe aceptar la propuesta vigente antes de iniciar o publicar la entrega.",
        409,
      );
      const message = String(body.get("message") || "").trim(),
        url = String(body.get("url") || "").trim(),
        files = body.getAll("files").filter((f) => f instanceof File && f.size);
      check(
        message || url || files.length || j.artifacts.length,
        "Agrega un archivo, un enlace o el contenido de la entrega antes de publicarla.",
      );
      if (url)
        check(/^https?:\/\/[^\s]+$/i.test(url), "Incluye un enlace válido, empezando por https://.");
      for (const f of files) {
        const ext = f.name.split(".").pop().toLowerCase();
        j.artifacts.push({
          id: uid(),
          name: f.name,
          kind: kinds[ext] || "package",
          mime: f.type,
          html: ["html", "htm"].includes(ext) ? await f.text() : null,
        });
      }
      tick(j);
      j.status = "delivered";
      j.response = message;
      j.delivery_url = url;
      j.customer_notified_at = null;
      j.comments.push({
        id: uid(),
        role: "admin",
        author_id: user.id,
        body: "Mecha publicó la entrega.",
        created: j.updated,
        attachments: [],
      });
      return { job: view(j, true) };
    }
    if (action === "notice") {
      check(body.confirmed === true, "Confirma que avisaste al cliente.");
      check(j.status === "delivered", "Publica la entrega antes de registrar el aviso.", 409);
      tick(j);
      j.customer_notified_at = j.updated;
      j.comments.push({
        id: uid(),
        role: "admin",
        author_id: user.id,
        body: "Mecha registró que avisó al cliente de esta entrega.",
        created: j.updated,
        attachments: [],
      });
      return { job: view(j, true) };
    }
    if (action === "reset")
      return {
        url: "https://‹tu-dominio›/#clave=enlace-de-ejemplo",
        expires: Date.now() + 48 * HOUR,
      };
    throw new Fail("Ruta no encontrada.", 404);
  }

  if (path === "/api/uploads" && method === "POST") {
    const file = body.get("file");
    check(file instanceof File && file.size, "Selecciona un archivo.");
    check(file.size <= 8 * 1024 * 1024, "Adjunta un archivo de hasta 8 MB.", 413);
    const id = uid();
    db.uploads[id] = {
      id,
      user_id: user.id,
      name: file.name,
      summary: { type: "file", bytes: file.size },
    };
    return publicUpload(id);
  }
  const up = path.match(/^\/api\/uploads\/([a-f0-9-]+)$/);
  if (up && method === "DELETE") {
    delete db.uploads[up[1]];
    return { ok: true };
  }
  if (path === "/api/jobs" && method === "GET")
    return {
      jobs: db.jobs
        .filter((j) => j.user_id === user.id)
        .sort((a, b) => b.created - a.created)
        .map(({ id, prompt, status, created, updated }) => ({
          id,
          prompt,
          status,
          created,
          updated,
        })),
    };
  if (path === "/api/jobs" && method === "POST") {
    check(db.profiles[user.id], "Primero registra tu negocio.");
    const prompt = String(body.prompt || "").trim();
    check(prompt.length >= 3, "Escribe una solicitud de 3 a 10,000 caracteres.");
    let thread = uid(),
      attachments = attachIds(body, user);
    if (body.parentId) {
      const parent = find(body.parentId, user);
      check(parent.status === "delivered", "Agrega información al pedido que sigue en proceso.");
      thread = parent.thread_id;
      if (!attachments.length) attachments = [...parent.attachments];
    }
    const now = Date.now();
    const j = {
      id: uid(),
      user_id: user.id,
      thread_id: thread,
      prompt,
      status: "received",
      desired_result: String(body.desiredResult || "").trim(),
      created: now,
      updated: now,
      proposal_required: 1,
      proposal_version: 0,
      response: "",
      delivery_url: "",
      customer_notified_at: null,
      feedback: "",
      attachments,
      comments: [],
      proposals: [],
      artifacts: [],
      business_snapshot: { ...db.profiles[user.id] },
    };
    db.jobs.push(j);
    return { job: view(j) };
  }
  const jm = path.match(/^\/api\/jobs\/([a-f0-9-]+)(\/(accept|feedback|comments))?$/);
  check(jm, "Ruta no encontrada.", 404);
  const j = find(jm[1], user);
  const action = jm[3];
  if (!action && method === "GET") return { job: view(j) };
  if (!action && method === "DELETE") {
    check(j.status === "delivered", "Solo se pueden eliminar pedidos entregados.");
    db.jobs = db.jobs.filter((x) => x !== j);
    return { ok: true };
  }
  if (action === "accept") {
    check(body.accepted === true, "Confirma que revisaste la propuesta.");
    const p = j.proposals.find((x) => x.version === j.proposal_version);
    check(p && p.version === body.version, "La propuesta cambió. Revisa la nueva versión.", 409);
    if (!p.accepted_at) {
      tick(j);
      p.accepted_at = j.updated;
      j.status = "in_progress";
      j.comments.push({
        id: uid(),
        role: "client",
        author_id: user.id,
        body: "El cliente aceptó la propuesta de Mecha.",
        created: j.updated,
        attachments: [],
      });
    }
    return { job: view(j) };
  }
  if (action === "feedback") {
    check(j.status === "delivered", "Primero recibe la entrega.", 409);
    const feedback = String(body.feedback || "").trim();
    check(feedback.length >= 3, "Describe el resultado en hasta 1,500 caracteres.");
    tick(j);
    j.feedback = feedback;
    return { job: view(j) };
  }
  if (action === "comments") {
    check(j.status !== "delivered", "Crea un pedido de ajuste a partir de esta entrega.");
    const text = String(body.message || "").trim();
    check(text.length >= 3, "Escribe un mensaje de 3 a 10,000 caracteres.");
    const ids = attachIds(body, user);
    tick(j);
    j.comments.push({
      id: uid(),
      role: "client",
      author_id: user.id,
      body: text,
      created: j.updated,
      attachments: ids,
    });
    j.status = replyStatus(j);
    return { job: view(j) };
  }
  return json(null);
}

export function artifactHtml(id) {
  for (const j of db.jobs)
    for (const a of j.artifacts) if (a.id === id) return a.html || "";
  return "";
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const raw = typeof input === "string" ? input : input.url;
  const url = new URL(raw, "https://demo.mecha.invalid");
  if (!url.pathname.startsWith("/api/")) return realFetch(input, init);
  const method = (init.method || "GET").toUpperCase();
  let body = init.body;
  if (typeof body === "string") body = JSON.parse(body);
  await new Promise((r) => setTimeout(r, 120));
  try {
    const data = await handle(url.pathname, method, body || {});
    return new Response(JSON.stringify(data), {
      status: method === "POST" && url.pathname === "/api/jobs" ? 201 : 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const status = e instanceof Fail ? e.status : 500;
    if (!(e instanceof Fail)) console.error(e);
    return new Response(
      JSON.stringify({
        error: e instanceof Fail ? e.message : "Ocurrió un error en la demo.",
      }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  }
};
