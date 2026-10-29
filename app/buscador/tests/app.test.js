import { availableServices, findServices } from "../public/catalog.js";
import { deliveryTypes } from "../src/formats.js";
import { test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/server.js";
import { digest } from "../src/store.js";
import { safeName } from "../src/artifacts.js";

let app, dir, alice, bob, admin, jobId, uploadId, artifactId;
const origin = "http://localhost:4195",
  password = "prueba-segura-2026";
async function request(
  path,
  { method = "GET", data, cookie, form, source = origin } = {},
) {
  return app.fetch(
    new Request(origin + path, {
      method,
      headers: {
        ...(method !== "GET" ? { Origin: source } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      body: form || (data ? JSON.stringify(data) : undefined),
    }),
  );
}
async function register(email, extra = {}) {
  const r = await request("/api/register", {
    method: "POST",
    data: { email, password, ...extra },
  });
  expect(r.status).toBe(200);
  return r.headers.get("set-cookie").split(";")[0];
}
const delivery = (
  updated,
  files = [],
  message = "Tu producto está listo.",
  url = "",
) => {
  const f = new FormData();
  f.append("updated", String(updated));
  f.append("message", message);
  f.append("url", url);
  for (const file of files) f.append("files", file);
  return f;
};
const getJob = async (cookie = alice) =>
  (await (await request("/api/jobs/" + jobId, { cookie })).json()).job;
const sampleTerms = {
  scope: "Entregable sintético para probar aprobación y versiones.",
  exclusions: "Sin ampliaciones fuera del pedido de prueba.",
  amount: "0.00",
  revisions: 0,
  delivery: "Plazo de prueba, sin compromiso comercial real.",
  costs: "Sin costos externos en esta prueba sintética.",
};
async function approveOrder(id, cookie = alice) {
  const job = (await (await request("/api/jobs/" + id, { cookie })).json()).job;
  const sent = await request("/api/admin/jobs/" + id + "/proposal", {
    method: "POST",
    cookie: admin,
    data: { ...sampleTerms, updated: job.updated },
  });
  expect(sent.status).toBe(200);
  const proposal = (await sent.json()).job.proposal;
  const accepted = await request("/api/jobs/" + id + "/accept", {
    method: "POST",
    cookie,
    data: { accepted: true, version: proposal.version },
  });
  expect(accepted.status).toBe(200);
  return (await accepted.json()).job;
}
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "mecha-manual-"));
  app = createApp({ dataDir: dir });
});
afterAll(async () => {
  app.store.db.close();
  await rm(dir, { recursive: true, force: true });
});

test("cuentas privadas, contraseñas cifradas y CSRF; registro público no asigna administrador", async () => {
  expect(
    (
      await request("/api/register", {
        method: "POST",
        source: "https://otro.example",
        data: { email: "x@example.com", password },
      })
    ).status,
  ).toBe(403);
  alice = await register("alice@example.com", { role: "admin" });
  bob = await register("bob@example.com");
  const session = await (
    await request("/api/session", { cookie: alice })
  ).json();
  expect(session.user.role).toBe("client");
  expect(session.workflow).toBe("manual");
  expect(
    app.store.query(
      "SELECT password FROM users WHERE email=?",
      "alice@example.com",
    ).password,
  ).not.toContain(password);
  expect((await request("/api/admin/jobs", { cookie: alice })).status).toBe(
    403,
  );
  expect((await request("/api/jobs")).status).toBe(401);
});
test("invitación ligada a correo, caducidad y consumo único", async () => {
  const token = "invitacion-prueba-administrador-2026-aleatoria";
  app.store.run(
    "INSERT INTO admin_invites VALUES(?,?,?)",
    digest(token),
    "owner@example.com",
    Date.now() + 60000,
  );
  expect(
    (
      await request("/api/register", {
        method: "POST",
        data: { email: "otro@example.com", password, inviteToken: token },
      })
    ).status,
  ).toBe(403);
  const lookup = await (
    await request("/api/invite", { method: "POST", data: { token } })
  ).json();
  expect(lookup.email).toBe("owner@example.com");
  admin = await register("owner@example.com", { inviteToken: token });
  expect(
    (await (await request("/api/session", { cookie: admin })).json()).user.role,
  ).toBe("admin");
  expect(
    (await request("/api/invite", { method: "POST", data: { token } })).status,
  ).toBe(400);
  const expired = "invitacion-expirada-con-longitud-valida";
  app.store.run(
    "INSERT INTO admin_invites VALUES(?,?,?)",
    digest(expired),
    "caducado@example.com",
    Date.now() - 100,
  );
  expect(
    (await request("/api/invite", { method: "POST", data: { token: expired } }))
      .status,
  ).toBe(400);
});
test("registro del negocio y recepción de pedido sin generación ni llamadas externas", async () => {
  const profile = {
    name: "Negocio de prueba",
    activity: "Servicios de prueba para verificar pedidos",
    website: "example.com",
    whatsapp: "525500000000",
  };
  expect(
    (
      await request("/api/profile", {
        method: "PUT",
        cookie: alice,
        data: profile,
      })
    ).status,
  ).toBe(200);
  const form = new FormData();
  form.append("file", new File(["producto,cantidad\nEjemplo,1"], "datos.csv"));
  const upload = await (
    await request("/api/uploads", { method: "POST", cookie: alice, form })
  ).json();
  uploadId = upload.id;
  const originalFetch = globalThis.fetch;
  let network = 0;
  globalThis.fetch = () => {
    network++;
    throw new Error("No debe llamar a IA");
  };
  try {
    const result = await request("/api/jobs", {
      method: "POST",
      cookie: alice,
      data: {
        prompt: "Revisa mi archivo y prepara un reporte.",
        uploadId,
        status: "delivered",
        response: "falsa entrega",
        desiredResult:
          "Verificar el reporte con los datos originales de prueba.",
      },
    });
    expect(result.status).toBe(201);
    const { job } = await result.json();
    jobId = job.id;
    expect(job.status).toBe("received");
    expect(job.proposal_required).toBe(1);
    expect(job.desired_result).toContain("datos originales");
    expect(job.artifacts).toEqual([]);
    expect(job.response).toBe("");
    expect(network).toBe(0);
  } finally {
    globalThis.fetch = originalFetch;
  }
  expect((await getJob()).profile.name).toBe(profile.name);
});
test("solicitudes recibidas persisten al reiniciar y usan el contexto al solicitar", async () => {
  app.store.db.close();
  app = createApp({ dataDir: dir });
  expect((await getJob()).status).toBe("received");
  await request("/api/profile", {
    method: "PUT",
    cookie: alice,
    data: {
      name: "Nuevo nombre",
      activity: "Actividad modificada para prueba",
    },
  });
  expect((await getJob()).profile.name).toBe("Negocio de prueba");
  expect(
    (await request("/api/jobs/" + jobId, { method: "DELETE", cookie: alice }))
      .status,
  ).toBe(400);
});
test("clientes no ven pedidos ajenos ni adjuntos; Mecha puede revisar los vinculados", async () => {
  expect((await request("/api/jobs/" + jobId, { cookie: bob })).status).toBe(
    404,
  );
  expect(
    (await request("/api/uploads/" + uploadId, { cookie: bob })).status,
  ).toBe(404);
  expect(
    (await request("/api/uploads/" + uploadId, { cookie: admin })).status,
  ).toBe(200);
  const queue = await (
    await request("/api/admin/jobs", { cookie: admin })
  ).json();
  expect(queue.jobs[0].email).toBe("alice@example.com");
  expect(queue.counts.received).toBe(1);
  expect(
    (
      await request("/api/admin/jobs/" + jobId + "/delivery", {
        method: "POST",
        cookie: alice,
        form: delivery((await getJob()).updated),
      })
    ).status,
  ).toBe(403);
});
test("Mecha pide información y el cliente responde dentro del mismo pedido", async () => {
  const job = await getJob();
  const ask = await request("/api/admin/jobs/" + jobId, {
    method: "PATCH",
    cookie: admin,
    data: {
      status: "needs_info",
      updated: job.updated,
      message: "¿Qué periodo debo revisar?",
    },
  });
  expect(ask.status).toBe(200);
  expect((await getJob()).status).toBe("needs_info");
  const reply = await request("/api/jobs/" + jobId + "/comments", {
    method: "POST",
    cookie: alice,
    data: { message: "El archivo contiene el periodo de prueba.", uploadId },
  });
  expect(reply.status).toBe(201);
  const after = await getJob();
  expect(after.status).toBe("received");
  expect(after.comments.map((c) => c.role)).toEqual(["admin", "client"]);
  expect(after.comments[1].attachment.id).toBe(uploadId);
  expect(
    (
      await request("/api/admin/jobs/" + jobId, {
        method: "PATCH",
        cookie: admin,
        data: { status: "delivered", updated: after.updated },
      })
    ).status,
  ).toBe(400);
});
test("la propuesta exige aprobación vigente, conserva versiones y aísla a los clientes", async () => {
  let job = await getJob();
  expect(
    (
      await request("/api/admin/jobs/" + jobId, {
        method: "PATCH",
        cookie: admin,
        data: { status: "in_progress", updated: job.updated },
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request("/api/admin/jobs/" + jobId + "/delivery", {
        method: "POST",
        cookie: admin,
        form: delivery(job.updated),
      })
    ).status,
  ).toBe(409);
  for (const amount of ["-10", "1.001", "abc", null])
    expect(
      (
        await request("/api/admin/jobs/" + jobId + "/proposal", {
          method: "POST",
          cookie: admin,
          data: { ...sampleTerms, amount, updated: job.updated },
        })
      ).status,
    ).toBe(400);
  expect(
    (
      await request("/api/admin/jobs/" + jobId + "/proposal", {
        method: "POST",
        cookie: alice,
        data: { ...sampleTerms, updated: job.updated },
      })
    ).status,
  ).toBe(403);
  job = await approveOrder(jobId);
  expect(job.status).toBe("in_progress");
  expect(job.proposal.accepted_at).toBeGreaterThan(0);
  expect(job.proposal.amount_cents).toBe(0);
  const acceptedAt = job.proposal.accepted_at;
  const v2 = await request("/api/admin/jobs/" + jobId + "/proposal", {
    method: "POST",
    cookie: admin,
    data: {
      ...sampleTerms,
      scope: "Segunda versión sintética con alcance modificado.",
      amount: "12.34",
      updated: job.updated,
    },
  });
  expect(v2.status).toBe(200);
  job = (await v2.json()).job;
  expect(job.status).toBe("awaiting_approval");
  expect(job.proposal.amount_cents).toBe(1234);
  expect(job.proposal.accepted_at).toBeNull();
  expect(job.proposal_history[0].accepted_at).toBe(acceptedAt);
  expect(job.proposal_history[0].scope).toBe(sampleTerms.scope);
  expect(
    (
      await request("/api/jobs/" + jobId + "/accept", {
        method: "POST",
        cookie: bob,
        data: { accepted: true, version: 2 },
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await request("/api/jobs/" + jobId + "/accept", {
        method: "POST",
        cookie: alice,
        data: { accepted: true, version: 1 },
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request("/api/jobs/" + jobId + "/accept", {
        method: "POST",
        cookie: alice,
        data: { accepted: false, version: 2 },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request("/api/admin/jobs/" + jobId + "/delivery", {
        method: "POST",
        cookie: admin,
        form: delivery(job.updated),
      })
    ).status,
  ).toBe(409);
  const response = await request("/api/jobs/" + jobId + "/accept", {
    method: "POST",
    cookie: alice,
    data: { accepted: true, version: 2 },
  });
  expect(response.status).toBe(200);
  job = (await response.json()).job;
  expect(job.status).toBe("in_progress");
  const again = await request("/api/jobs/" + jobId + "/accept", {
    method: "POST",
    cookie: alice,
    data: { accepted: true, version: 2 },
  });
  expect((await again.json()).job.updated).toBe(job.updated);
  expect(
    (
      await request("/api/jobs/" + jobId + "/feedback", {
        method: "POST",
        cookie: alice,
        data: { feedback: "Aún no hay entrega." },
      })
    ).status,
  ).toBe(409);
});
test("cambiar la propuesta durante una publicación bloquea la entrega obsoleta", async () => {
  const received = (
    await (
      await request("/api/jobs", {
        method: "POST",
        cookie: alice,
        data: {
          prompt:
            "Pedido sintético para probar un cambio simultáneo de propuesta.",
        },
      })
    ).json()
  ).job;
  const approved = await approveOrder(received.id);
  let resume;
  const gate = new Promise((resolve) => (resume = resolve));
  const req = new Request(
    origin + "/api/admin/jobs/" + received.id + "/delivery",
    {
      method: "POST",
      headers: { Origin: origin, Cookie: admin },
      body: delivery(approved.updated, [
        new File(["Entrega de prueba"], "cambio.txt"),
      ]),
    },
  );
  const parse = req.formData.bind(req);
  req.formData = async () => {
    await gate;
    return parse();
  };
  const pending = app.fetch(req);
  const changed = await request(
    "/api/admin/jobs/" + received.id + "/proposal",
    {
      method: "POST",
      cookie: admin,
      data: {
        ...sampleTerms,
        scope: "Alcance cambiado mientras la publicación estaba pendiente.",
        updated: approved.updated,
      },
    },
  );
  expect(changed.status).toBe(200);
  const paths = await readdir(join(dir, "files"));
  resume();
  expect((await pending).status).toBe(409);
  expect(await readdir(join(dir, "files"))).toEqual(paths);
  const after = (
    await (
      await request("/api/admin/jobs/" + received.id, { cookie: admin })
    ).json()
  ).job;
  expect(after.status).toBe("awaiting_approval");
  expect(after.artifacts).toEqual([]);
  expect(after.proposal.version).toBe(2);
});
test("publicación exige contenido válido y detecta cambios concurrentes sin archivos huérfanos", async () => {
  const job = await getJob(),
    paths = await readdir(join(dir, "files"));
  const cases = [
    delivery(job.updated, [], "", ""),
    delivery(job.updated, [], "Listo", "javascript:alert(1)"),
    delivery(job.updated, [new File(["no"], "no.exe")]),
    delivery(job.updated, [new File(["no"], "falso.pdf")]),
    delivery(job.updated - 1, [new File(["contenido"], "nota.txt")]),
  ];
  for (const form of cases)
    expect(
      (
        await request("/api/admin/jobs/" + jobId + "/delivery", {
          method: "POST",
          cookie: admin,
          form,
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);
  expect(await readdir(join(dir, "files"))).toEqual(paths);
  expect((await getJob()).status).toBe("in_progress");
});
test("publicar entrega habilita archivos y enlace; original HTML intacto y vista previa aislada", async () => {
  const html = "<h1>Entrega de prueba</h1><script>alert(1)</script>",
    text = "Contenido del reporte de prueba.";
  const before = await getJob();
  function delayed(path, cookie, method, data) {
    let resume;
    const gate = new Promise((resolve) => (resume = resolve));
    const req = new Request(origin + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    const read = req.text.bind(req);
    req.text = async () => {
      await gate;
      return read();
    };
    return { promise: app.fetch(req), resume };
  }
  const pendingStatus = delayed("/api/admin/jobs/" + jobId, admin, "PATCH", {
    status: "in_progress",
    message: "Mensaje obsoleto.",
    updated: before.updated,
  });
  const pendingReply = delayed(
    "/api/jobs/" + jobId + "/comments",
    alice,
    "POST",
    { message: "Aclaración que llegó durante la publicación." },
  );
  const result = await request("/api/admin/jobs/" + jobId + "/delivery", {
    method: "POST",
    cookie: admin,
    form: delivery(
      (await getJob()).updated,
      [new File([html], "pagina.html"), new File([text], "reporte.txt")],
      "Reporte listo para revisar.",
      "https://example.com/entrega",
    ),
  });
  expect(result.status).toBe(200);
  pendingStatus.resume();
  pendingReply.resume();
  expect((await pendingStatus.promise).status).toBe(409);
  expect((await pendingReply.promise).status).toBe(409);
  const job = await getJob();
  expect(job.status).toBe("delivered");
  expect(job.artifacts.length).toBe(2);
  expect(job.delivery_url).toBe("https://example.com/entrega");
  artifactId = job.artifacts.find((a) => a.kind === "html").id;
  expect(
    await (
      await request("/api/artifacts/" + artifactId, { cookie: alice })
    ).text(),
  ).toBe(html);
  const preview = await request("/api/artifacts/" + artifactId + "/preview", {
    cookie: alice,
  });
  expect(preview.headers.get("content-security-policy")).toContain("sandbox");
  expect(await preview.text()).not.toContain("<script>");
  expect(
    (await request("/api/artifacts/" + artifactId, { cookie: bob })).status,
  ).toBe(404);
  expect(
    (
      await request("/api/artifacts/" + artifactId + "/preview", {
        cookie: bob,
      })
    ).status,
  ).toBe(404);
  expect(
    await (
      await request(
        "/api/artifacts/" + job.artifacts.find((a) => a.kind === "text").id,
        { cookie: alice },
      )
    ).text(),
  ).toBe(text);
});
test("resultados y aviso manual no se inventan ni se envían automáticamente", async () => {
  let job = await getJob();
  expect(job.feedback).toBe("");
  expect(job.customer_notified_at).toBeNull();
  expect(
    (
      await request("/api/jobs/" + jobId + "/feedback", {
        method: "POST",
        cookie: bob,
        data: { feedback: "Resultado ajeno" },
      })
    ).status,
  ).toBe(404);
  const feedback = await request("/api/jobs/" + jobId + "/feedback", {
    method: "POST",
    cookie: alice,
    data: { feedback: "Aún no medimos el resultado de esta prueba." },
  });
  expect(feedback.status).toBe(200);
  job = (await feedback.json()).job;
  expect(job.feedback).toContain("Aún no medimos");
  expect(
    (
      await request("/api/admin/jobs/" + jobId + "/notice", {
        method: "POST",
        cookie: alice,
        data: { confirmed: true, updated: job.updated },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await request("/api/admin/jobs/" + jobId + "/notice", {
        method: "POST",
        cookie: admin,
        data: { confirmed: false, updated: job.updated },
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await request("/api/admin/jobs/" + jobId + "/notice", {
        method: "POST",
        cookie: admin,
        data: { confirmed: true, updated: job.updated - 1 },
      })
    ).status,
  ).toBe(409);
  const notice = await request("/api/admin/jobs/" + jobId + "/notice", {
    method: "POST",
    cookie: admin,
    data: { confirmed: true, updated: job.updated },
  });
  expect(notice.status).toBe(200);
  expect((await notice.json()).job.customer_notified_at).toBeGreaterThan(0);
});
test("regresar a proceso oculta entregas anteriores incluso por URL directa", async () => {
  const job = await getJob();
  expect(
    (
      await request("/api/admin/jobs/" + jobId, {
        method: "PATCH",
        cookie: admin,
        data: {
          status: "in_progress",
          updated: job.updated,
          message: "Revisando ajuste.",
        },
      })
    ).status,
  ).toBe(200);
  const hidden = await getJob();
  expect(hidden.artifacts).toEqual([]);
  expect(hidden.response).toBe("");
  expect(hidden.delivery_url).toBe("");
  expect(
    (await request("/api/artifacts/" + artifactId, { cookie: alice })).status,
  ).toBe(404);
  expect(
    (await request("/api/artifacts/" + artifactId, { cookie: admin })).status,
  ).toBe(200);
  expect(
    (
      await request("/api/admin/jobs/" + jobId + "/delivery", {
        method: "POST",
        cookie: admin,
        form: delivery(
          hidden.updated,
          [],
          "Entrega revisada.",
          "https://example.com/entrega",
        ),
      })
    ).status,
  ).toBe(200);
});
test("ajustes crean un pedido vinculado y conservan el adjunto al borrar la entrega anterior", async () => {
  expect((await getJob()).customer_notified_at).toBeNull();
  const next = await (
    await request("/api/jobs", {
      method: "POST",
      cookie: alice,
      data: { prompt: "Haz un ajuste al reporte.", parentId: jobId },
    })
  ).json();
  expect(next.job.status).toBe("received");
  expect(next.job.attachment.id).toBe(uploadId);
  expect(next.job.thread_id).toBe((await getJob()).thread_id);
  expect(
    (await request("/api/jobs/" + jobId, { method: "DELETE", cookie: alice }))
      .status,
  ).toBe(200);
  expect(
    (await request("/api/artifacts/" + artifactId, { cookie: alice })).status,
  ).toBe(404);
  expect(
    (await request("/api/uploads/" + uploadId, { cookie: alice })).status,
  ).toBe(200);
});
test("catálogo conserva las 140 solicitudes, medios y búsqueda por palabras sin acentos", () => {
  expect(availableServices.length).toBe(140);
  expect(new Set(availableServices.map((s) => s.id)).size).toBe(140);
  expect(findServices("reparar formulas").map((s) => s.id)).toContain(4);
  expect(findServices("video", "Video y audio").length).toBeGreaterThan(0);
  expect(findServices("limpiar", "Excel y datos").map((s) => s.id)).toContain(
    1,
  );
  expect(availableServices.find((s) => s.id === 133).setup).toBe(true);
  expect(deliveryTypes.pptx[0]).toBe("presentation");
  expect(deliveryTypes.mp4[0]).toBe("video");
});
test("varios originales y aclaraciones: aislamiento, descarga de Mecha y eliminación sin perder archivos compartidos", async () => {
  async function upload(cookie, name, bytes) {
    const form = new FormData();
    form.append("file", new File([bytes], name));
    const r = await request("/api/uploads", { method: "POST", cookie, form });
    expect(r.status).toBe(201);
    return (await r.json()).id;
  }
  const one = await upload(
    alice,
    "sucursal-uno.csv",
    "producto,total\nPrueba,0",
  );
  const two = await upload(
    alice,
    "factura.xml",
    "<factura>Prueba de adjunto</factura>",
  );
  const foreign = await upload(bob, "privado.csv", "datos privados de prueba");
  expect(
    (
      await request("/api/jobs", {
        method: "POST",
        cookie: alice,
        data: { prompt: "Cruza los archivos.", uploadIds: [one, foreign] },
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await request("/api/jobs", {
        method: "POST",
        cookie: alice,
        data: { prompt: "Cruza los archivos.", uploadIds: [one, null] },
      })
    ).status,
  ).toBe(400);
  const job = (
    await (
      await request("/api/jobs", {
        method: "POST",
        cookie: alice,
        data: {
          prompt: "Junta los archivos de prueba.",
          uploadIds: [one, two],
        },
      })
    ).json()
  ).job;
  expect(job.attachments.map((f) => f.id)).toEqual([one, two]);
  expect((await request("/api/uploads/" + two, { cookie: bob })).status).toBe(
    404,
  );
  expect((await request("/api/uploads/" + two, { cookie: admin })).status).toBe(
    200,
  );
  expect(
    (await request("/api/uploads/" + foreign, { cookie: admin })).status,
  ).toBe(404);
  expect(
    (await request("/api/uploads/" + two, { method: "DELETE", cookie: alice }))
      .status,
  ).toBe(400);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=",
    "base64",
  );
  const photo = await upload(alice, "referencia.png", png),
    note = await upload(
      alice,
      "nota.mp3",
      "audio sintético para prueba de almacenamiento",
    );
  const clarification = (
    await (
      await request("/api/jobs/" + job.id + "/comments", {
        method: "POST",
        cookie: alice,
        data: {
          message: "Referencias de la entrega.",
          uploadIds: [photo, note],
        },
      })
    ).json()
  ).job;
  expect(clarification.comments[0].attachments.map((f) => f.id)).toEqual([
    photo,
    note,
  ]);
  expect(
    (await request("/api/uploads/" + note, { cookie: admin })).status,
  ).toBe(200);
  const published = await request("/api/admin/jobs/" + job.id + "/delivery", {
    method: "POST",
    cookie: admin,
    form: delivery(
      (await approveOrder(job.id)).updated,
      [
        new File([png], "resultado.png"),
        new File(["PKcontenido de prueba preservado"], "presentacion.pptx"),
      ],
      "Entregables de prueba.",
    ),
  });
  expect(published.status).toBe(200);
  const delivered = (await published.json()).job;
  expect(delivered.artifacts.map((a) => a.kind).sort()).toEqual([
    "image",
    "presentation",
  ]);
  const image = delivered.artifacts.find((a) => a.kind === "image");
  expect(
    Buffer.from(
      await (
        await request("/api/artifacts/" + image.id, { cookie: alice })
      ).arrayBuffer(),
    ),
  ).toEqual(png);
  const next = (
    await (
      await request("/api/jobs", {
        method: "POST",
        cookie: alice,
        data: { prompt: "Ajusta la entrega de prueba.", parentId: job.id },
      })
    ).json()
  ).job;
  expect(next.attachments.map((f) => f.id)).toEqual([one, two]);
  const operator = (
    await (
      await request("/api/admin/jobs/" + next.id, { cookie: admin })
    ).json()
  ).job;
  expect(operator.related.map((j) => j.id)).toContain(job.id);
  expect(
    (await request("/api/jobs/" + job.id, { method: "DELETE", cookie: alice }))
      .status,
  ).toBe(200);
  expect(
    (await request("/api/uploads/" + photo, { cookie: alice })).status,
  ).toBe(404);
  expect(
    (await request("/api/uploads/" + note, { cookie: alice })).status,
  ).toBe(404);
  expect((await request("/api/uploads/" + two, { cookie: alice })).status).toBe(
    200,
  );
  await request("/api/admin/jobs/" + next.id + "/delivery", {
    method: "POST",
    cookie: admin,
    form: delivery((await approveOrder(next.id)).updated),
  });
  await request("/api/jobs/" + next.id, { method: "DELETE", cookie: alice });
  expect((await request("/api/uploads/" + one, { cookie: alice })).status).toBe(
    404,
  );
  expect((await request("/api/uploads/" + two, { cookie: alice })).status).toBe(
    404,
  );
  expect(
    (await request("/api/uploads/" + foreign, { cookie: bob })).status,
  ).toBe(200);
});
test("archivos y enlace de operador no se exponen sin sesión y cierre de sesión invalida cookie", async () => {
  expect((await request("/api/uploads/" + uploadId)).status).toBe(401);
  expect((await request("/api/admin/jobs")).status).toBe(401);
  expect((await request("/operacion")).status).toBe(200);
  expect((await request("/data/acceso-mecha.json")).status).toBe(404);
  await request("/api/logout", { method: "POST", cookie: bob });
  expect((await request("/api/jobs", { cookie: bob })).status).toBe(401);
});
test("Mecha genera un enlace de un solo uso para restablecer la contraseña del cliente", async () => {
  const carla = await register("carla@example.com");
  await request("/api/profile", {
    method: "PUT",
    cookie: carla,
    data: { name: "Negocio sintético", activity: "Pruebas de recuperación." },
  });
  const order = (
    await (
      await request("/api/jobs", {
        method: "POST",
        cookie: carla,
        data: { prompt: "Pedido sintético para probar recuperación." },
      })
    ).json()
  ).job;
  expect(
    (
      await request("/api/admin/jobs/" + order.id + "/reset", {
        method: "POST",
        cookie: carla,
        data: {},
      })
    ).status,
  ).toBe(403);
  const generated = await request("/api/admin/jobs/" + order.id + "/reset", {
    method: "POST",
    cookie: admin,
    data: {},
  });
  expect(generated.status).toBe(200);
  const token = new URL((await generated.json()).url).hash.split("clave=")[1];
  expect(app.store.query("SELECT token FROM password_resets").token).not.toBe(
    token,
  );
  const lookup = await request("/api/reset/check", {
    method: "POST",
    data: { token },
  });
  expect((await lookup.json()).email).toBe("carla@example.com");
  expect(
    (
      await request("/api/reset", {
        method: "POST",
        data: { token, password: "corta" },
      })
    ).status,
  ).toBe(400);
  const nueva = "nueva-clave-sintetica-2026";
  const reset = await request("/api/reset", {
    method: "POST",
    data: { token, password: nueva },
  });
  expect(reset.status).toBe(200);
  expect((await request("/api/jobs", { cookie: carla })).status).toBe(401);
  expect(
    (
      await request("/api/reset", {
        method: "POST",
        data: { token, password: "otra-clave-sintetica-2026" },
      })
    ).status,
  ).toBe(400);
  const login = (pass) =>
    request("/api/login", {
      method: "POST",
      data: { email: "carla@example.com", password: pass },
    });
  expect((await login(password)).status).toBe(401);
  expect((await login(nueva)).status).toBe(200);
});
test("el operador no puede restablecer cuentas de operador desde el panel", async () => {
  const adminUser = app.store.query(
    "SELECT id FROM users WHERE role='admin' LIMIT 1",
  );
  const own = crypto.randomUUID();
  app.store.run(
    "INSERT INTO jobs(id,user_id,thread_id,prompt,status,created,updated) VALUES(?,?,?,?,?,?,?)",
    own,
    adminUser.id,
    own,
    "Pedido sintético del operador.",
    "received",
    Date.now(),
    Date.now(),
  );
  expect(
    (
      await request("/api/admin/jobs/" + own + "/reset", {
        method: "POST",
        cookie: admin,
        data: {},
      })
    ).status,
  ).toBe(403);
  app.store.run("DELETE FROM jobs WHERE id=?", own);
});
test("correo inexistente y contraseña incorrecta responden igual", async () => {
  const unknown = await request("/api/login", {
    method: "POST",
    data: { email: "nadie@example.com", password },
  });
  const wrong = await request("/api/login", {
    method: "POST",
    data: { email: "bob@example.com", password: "incorrecta-2026" },
  });
  expect(unknown.status).toBe(401);
  expect(await unknown.json()).toEqual(await wrong.json());
});
test("nombres de archivo seguros conservan la extensión", () => {
  expect(safeName("cotización final.xlsx")).toBe("cotizacion final.xlsx");
  expect(safeName("📊.xlsx")).toBe("entrega.xlsx");
  expect(safeName('a"b;c.pdf')).toBe("abc.pdf");
  expect(safeName("")).toBe("entrega");
  expect(safeName("../../etc/passwd")).toBe("passwd");
});
test("adjuntos nunca enviados se eliminan después de un día", async () => {
  const form = new FormData();
  form.append("file", new File(["borrador"], "olvidado.txt"));
  const sent = await request("/api/uploads", {
    method: "POST",
    cookie: alice,
    form,
  });
  const orphan = (await sent.json()).id;
  await app.cleanOrphans();
  expect(
    (await request("/api/uploads/" + orphan, { cookie: alice })).status,
  ).toBe(200);
  app.store.run("UPDATE uploads SET created=0 WHERE id=?", orphan);
  const linked = app.store.query("SELECT upload_id FROM job_uploads LIMIT 1");
  if (linked)
    app.store.run("UPDATE uploads SET created=0 WHERE id=?", linked.upload_id);
  await app.cleanOrphans();
  expect(
    (await request("/api/uploads/" + orphan, { cookie: alice })).status,
  ).toBe(404);
  if (linked)
    expect(
      app.store.query("SELECT id FROM uploads WHERE id=?", linked.upload_id),
    ).toBeTruthy();
});

test("subida por stream sin Content-Length se corta antes de leer el exceso", async () => {
  let produced = 0;
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      produced++;
      controller.enqueue(new Uint8Array(1024 * 1024));
      if (produced === 100) controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = await app.fetch(
    new Request(origin + "/api/uploads", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: alice,
        "Content-Type": "multipart/form-data; boundary=test",
      },
      body,
      duplex: "half",
    }),
  );
  expect(response.status).toBe(413);
  expect(cancelled).toBe(true);
  expect(produced).toBeLessThan(12);
});

test("multipart malformado responde 400, no error interno", async () => {
  const response = await app.fetch(
    new Request(origin + "/api/uploads", {
      method: "POST",
      headers: { Origin: origin, Cookie: alice, "Content-Type": "text/plain" },
      body: "no es un formulario",
    }),
  );
  expect(response.status).toBe(400);
});
