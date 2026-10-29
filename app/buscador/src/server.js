import {
  sendProposal,
  acceptProposal,
  requireAgreement,
  replyStatus,
} from "./proposals.js";
import { writeFile, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join, resolve, extname } from "node:path";
import {
  createStore,
  id,
  digest,
  hashPassword,
  verifyPassword,
} from "./store.js";
import { AppError, check } from "./errors.js";
import { safeName } from "./artifacts.js";
import { publishDelivery, DELIVERY_LIMIT } from "./deliveries.js";
import { FILE_LIMIT, MAX_ATTACHMENTS, uploadExtensions } from "./formats.js";
const PUBLIC = resolve(import.meta.dir, "../public");
const SESSION_AGE = 60 * 60 * 24 * 14;
const RESET_AGE = 1000 * 60 * 60 * 48;
// Se verifica contra este hash cuando el correo no existe, para que el tiempo
// de respuesta no revele qué cuentas están registradas.
const decoyHash = hashPassword(randomBytes(16).toString("hex"));
const cookie = (token, secure = false, age = SESSION_AGE) =>
  `mecha_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${secure ? "; Secure" : ""}`;
function validateProfile(input) {
  const profile = {};
  for (const [key, max] of Object.entries({
    name: 120,
    activity: 1200,
    city: 120,
    website: 500,
    instagram: 500,
    facebook: 500,
    whatsapp: 30,
    goal: 1200,
  })) {
    check(
      input[key] == null || typeof input[key] === "string",
      "Un campo del negocio no es válido.",
    );
    profile[key] = (input[key] || "").trim();
    check(profile[key].length <= max, `El campo ${key} es demasiado largo.`);
  }
  check(profile.name.length >= 2, "Escribe el nombre de tu negocio.");
  check(profile.activity.length >= 5, "Cuéntanos a qué se dedica tu negocio.");
  for (const key of ["website", "instagram", "facebook"]) {
    if (!profile[key]) continue;
    if (!/^https?:\/\//i.test(profile[key]))
      profile[key] = `https://${profile[key]}`;
    let url;
    try {
      url = new URL(profile[key]);
    } catch {
      throw new AppError(`Revisa el enlace de ${key}.`);
    }
    check(
      ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        url.hostname.includes("."),
      `Revisa el enlace de ${key}.`,
    );
    profile[key] = url.href;
  }
  if (profile.whatsapp) {
    check(
      /^[+\d ()-]+$/.test(profile.whatsapp),
      "El WhatsApp debe contener un número de teléfono.",
    );
    const digits = profile.whatsapp.replace(/\D/g, "");
    check(
      digits.length >= 10 && digits.length <= 15,
      "Incluye el WhatsApp con código de país.",
    );
    profile.whatsapp = digits;
  }
  return profile;
}
async function formularioLimitado(req, limite, mensaje) {
  check(req.body, "Falta el archivo.");
  const reader = req.body.getReader();
  const partes = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limite) {
        await reader.cancel();
        throw new AppError(mensaje, 413);
      }
      partes.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Response(Buffer.concat(partes), {
      headers: { "Content-Type": req.headers.get("content-type") || "" },
    }).formData();
  } catch {
    throw new AppError("Formulario de archivos inválido.", 400);
  }
}

export function createApp({
  dataDir = process.env.DATA_DIR || resolve(import.meta.dir, "../data"),
  origins = ["http://127.0.0.1:4195", "http://localhost:4195"],
  secure = false,
} = {}) {
  const store = createStore(dataDir),
    attempts = new Map();
  async function cleanOrphans() {
    for (const u of store.orphanUploads()) {
      store.run("DELETE FROM uploads WHERE id=?", u.id);
      await unlink(join(store.dir, "files", u.path)).catch(() => {});
    }
  }
  const json = (data, status = 200, headers = {}) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        ...headers,
      },
    });
  async function body(req) {
    check(
      (req.headers.get("content-type") || "").includes("application/json"),
      "Envía JSON válido.",
    );
    const text = await req.text();
    check(text.length <= 30000, "La solicitud es demasiado larga.", 413);
    try {
      const v = JSON.parse(text);
      check(
        v && typeof v === "object" && !Array.isArray(v),
        "Datos inválidos.",
      );
      return v;
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError("La solicitud no contiene JSON válido.");
    }
  }
  function limit(key, max) {
    if (attempts.size > 10000)
      for (const [k, v] of attempts)
        if (v.reset < Date.now()) attempts.delete(k);
    const prev = attempts.get(key),
      state =
        prev && prev.reset > Date.now()
          ? prev
          : { n: 0, reset: Date.now() + 15 * 60000 };
    state.n++;
    attempts.set(key, state);
    check(state.n <= max, "Demasiados intentos. Espera unos minutos.", 429);
  }
  function invite(token) {
    check(
      typeof token === "string" && token.length >= 32 && token.length <= 100,
      "La invitación no es válida.",
      400,
    );
    const invitation = store.query(
      "SELECT * FROM admin_invites WHERE token=? AND expires>?",
      digest(token),
      Date.now(),
    );
    check(invitation, "Esta invitación venció o ya fue utilizada.", 400);
    return invitation;
  }
  function passwordReset(token) {
    check(
      typeof token === "string" && token.length >= 32 && token.length <= 100,
      "El enlace para restablecer no es válido.",
    );
    const reset = store.query(
      "SELECT r.token,r.user_id,u.email FROM password_resets r JOIN users u ON u.id=r.user_id WHERE r.token=? AND r.expires>?",
      digest(token),
      Date.now(),
    );
    check(
      reset,
      "Este enlace venció o ya fue utilizado. Pide uno nuevo a Mecha.",
    );
    return reset;
  }
  function checkPassword(password) {
    check(
      typeof password === "string" &&
        password.length >= 10 &&
        password.length <= 200,
      "Usa una contraseña de 10 a 200 caracteres.",
    );
  }
  const changed = (job) => Math.max(Date.now(), job.updated + 1);
  function attachmentIds(input, userId) {
    const supplied =
      input.uploadIds ?? (input.uploadId ? [input.uploadId] : []);
    check(
      Array.isArray(supplied) &&
        supplied.length <= MAX_ATTACHMENTS &&
        supplied.every(
          (uid) => typeof uid === "string" && /^[a-f0-9-]+$/.test(uid),
        ),
      "Adjunta hasta ocho archivos válidos.",
    );
    const ids = [...new Set(supplied)];
    for (const uid of ids) store.upload(uid, userId);
    return ids;
  }
  function comment(job, user, text, uploadIds = []) {
    const commentId = id();
    store.run(
      "INSERT INTO comments(id,job_id,author_id,role,body,upload_id,created) VALUES(?,?,?,?,?,?,?)",
      commentId,
      job.id,
      user.id,
      user.role,
      text,
      uploadIds[0] || null,
      changed(job),
    );
    uploadIds.forEach((uid, position) =>
      store.run(
        "INSERT INTO comment_uploads VALUES(?,?,?)",
        commentId,
        uid,
        position,
      ),
    );
  }
  async function fetch(req, server) {
    try {
      const url = new URL(req.url),
        path = url.pathname;
      check(
        origins.includes(url.origin),
        "Origen de la aplicación inválido.",
        403,
      );
      if (path.startsWith("/api/") && !["GET", "HEAD"].includes(req.method))
        check(
          origins.includes(req.headers.get("origin")),
          "La solicitud debe enviarse desde esta app.",
          403,
        );
      if (path === "/api/health" && req.method === "GET")
        return json({ ok: true, workflow: "manual" });
      if (path === "/api/session" && req.method === "GET") {
        const user = store.userFromCookie(req.headers.get("cookie"));
        return json({
          user,
          profile: user ? store.profile(user.id) : null,
          workflow: "manual",
        });
      }
      if (path === "/api/invite" && req.method === "POST") {
        limit("invite:" + (server?.requestIP(req)?.address || "local"), 30);
        const input = await body(req),
          invitation = invite(input.token);
        return json({ email: invitation.email });
      }
      if (
        ["/api/register", "/api/login"].includes(path) &&
        req.method === "POST"
      ) {
        const input = await body(req),
          email = String(input.email || "")
            .trim()
            .toLowerCase(),
          password = input.password;
        check(
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254,
          "Escribe un correo válido.",
        );
        checkPassword(password);
        limit("auth-ip:" + (server?.requestIP(req)?.address || "local"), 40);
        limit("auth-email:" + email, 10);
        let user = store.query("SELECT * FROM users WHERE email=?", email);
        if (path === "/api/register") {
          check(!user, "Ese correo ya está registrado. Inicia sesión.", 409);
          const invitation = input.inviteToken
            ? invite(input.inviteToken)
            : null;
          if (invitation)
            check(
              invitation.email === email,
              "La invitación corresponde a otro correo.",
              403,
            );
          const passwordHash = await hashPassword(password);
          user = { id: id(), email, role: invitation ? "admin" : "client" };
          store.db.transaction(() => {
            if (invitation)
              check(
                invite(input.inviteToken).email === email,
                "Invitación inválida.",
                403,
              );
            store.run(
              "INSERT INTO users(id,email,password,created,role) VALUES(?,?,?,?,?)",
              user.id,
              email,
              passwordHash,
              Date.now(),
              user.role,
            );
            if (invitation)
              store.run(
                "DELETE FROM admin_invites WHERE token=?",
                invitation.token,
              );
          })();
        } else {
          const valid = await verifyPassword(
            password,
            user?.password || (await decoyHash),
          );
          check(user && valid, "Correo o contraseña incorrectos.", 401);
        }
        return json(
          {
            user: { id: user.id, email: user.email, role: user.role },
            profile: store.profile(user.id),
            workflow: "manual",
          },
          200,
          { "Set-Cookie": cookie(store.session(user.id), secure) },
        );
      }
      if (path === "/api/reset/check" && req.method === "POST") {
        limit("reset:" + (server?.requestIP(req)?.address || "local"), 30);
        return json({ email: passwordReset((await body(req)).token).email });
      }
      if (path === "/api/reset" && req.method === "POST") {
        limit("reset:" + (server?.requestIP(req)?.address || "local"), 30);
        const input = await body(req);
        checkPassword(input.password);
        const reset = passwordReset(input.token),
          passwordHash = await hashPassword(input.password);
        store.db.transaction(() => {
          check(
            store.query(
              "SELECT token FROM password_resets WHERE token=?",
              reset.token,
            ),
            "Este enlace ya fue utilizado.",
          );
          store.run(
            "UPDATE users SET password=? WHERE id=?",
            passwordHash,
            reset.user_id,
          );
          // Cierra las sesiones abiertas con la contraseña anterior.
          store.run("DELETE FROM sessions WHERE user_id=?", reset.user_id);
          store.run(
            "DELETE FROM password_resets WHERE user_id=?",
            reset.user_id,
          );
        })();
        const user = store.query(
          "SELECT id,email,role FROM users WHERE id=?",
          reset.user_id,
        );
        return json(
          { user, profile: store.profile(user.id), workflow: "manual" },
          200,
          { "Set-Cookie": cookie(store.session(user.id), secure) },
        );
      }
      if (path.startsWith("/api/")) {
        const user = store.userFromCookie(req.headers.get("cookie"));
        check(user, "Inicia sesión para continuar.", 401);
        if (path === "/api/logout" && req.method === "POST") {
          const token = req.headers
            .get("cookie")
            ?.match(/(?:^|;\s*)mecha_session=([^;]+)/)?.[1];
          if (token)
            store.run("DELETE FROM sessions WHERE token=?", digest(token));
          return json({ ok: true }, 200, {
            "Set-Cookie": cookie("", secure, 0),
          });
        }
        if (path === "/api/profile" && req.method === "PUT") {
          const profile = validateProfile(await body(req));
          store.run(
            "INSERT INTO businesses VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET profile=excluded.profile",
            user.id,
            JSON.stringify(profile),
          );
          return json({ profile });
        }
        if (path.startsWith("/api/admin/")) {
          check(
            user.role === "admin",
            "Solo Mecha puede administrar los pedidos.",
            403,
          );
          if (path === "/api/admin/jobs" && req.method === "GET") {
            const jobs = store
              .all(
                "SELECT j.id,j.prompt,j.status,j.created,j.updated,j.customer_notified_at,j.business_snapshot,u.email,b.profile AS current_profile FROM jobs j JOIN users u ON j.user_id=u.id LEFT JOIN businesses b ON b.user_id=u.id ORDER BY j.updated DESC LIMIT 200",
              )
              .map((j) => ({
                ...j,
                profile: JSON.parse(
                  j.business_snapshot === "{}"
                    ? j.current_profile || "{}"
                    : j.business_snapshot,
                ),
                business_snapshot: undefined,
                current_profile: undefined,
              }));
            const counts = Object.fromEntries(
              store
                .all("SELECT status,COUNT(*) AS n FROM jobs GROUP BY status")
                .map((j) => [j.status, j.n]),
            );
            return json({ jobs, counts });
          }
          const match = path.match(
            /^\/api\/admin\/jobs\/([a-f0-9-]+)(\/(delivery|proposal|notice|reset))?$/,
          );
          if (match) {
            const job = store.job(match[1], user.id, true);
            if (!match[2] && req.method === "GET") return json({ job });
            if (!match[2] && req.method === "PATCH") {
              const input = await body(req),
                message = String(input.message || "").trim();
              check(
                ["in_progress", "needs_info"].includes(input.status),
                "Publica una entrega para marcar el pedido como entregado.",
              );
              check(
                Number(input.updated) === job.updated,
                "El pedido cambió. Actualiza la vista.",
                409,
              );
              check(
                message.length <= 10000 &&
                  (input.status !== "needs_info" || message.length >= 3),
                "Explica qué información falta.",
              );
              store.db.transaction(() => {
                const current = store.query(
                  "SELECT updated FROM jobs WHERE id=?",
                  job.id,
                );
                check(
                  current && current.updated === Number(input.updated),
                  "El pedido cambió. Actualiza la vista.",
                  409,
                );
                if (input.status === "in_progress")
                  requireAgreement(store.job(job.id, user.id, true));
                if (message) comment(job, user, message);
                store.run(
                  "UPDATE jobs SET status=?,updated=? WHERE id=?",
                  input.status,
                  changed(job),
                  job.id,
                );
              })();
              return json({ job: store.job(job.id, user.id, true) });
            }
            if (match[2] === "/notice" && req.method === "POST") {
              const input = await body(req);
              check(
                input.confirmed === true,
                "Confirma que avisaste al cliente.",
              );
              store.db.transaction(() => {
                const current = store.job(job.id, user.id, true);
                check(
                  current.status === "delivered",
                  "Publica la entrega antes de registrar el aviso.",
                  409,
                );
                check(
                  Number(input.updated) === current.updated,
                  "La entrega cambió. Revisa qué debes avisar.",
                  409,
                );
                const now = Math.max(Date.now(), current.updated + 1);
                store.run(
                  "UPDATE jobs SET customer_notified_at=?,updated=? WHERE id=?",
                  now,
                  now,
                  job.id,
                );
                store.run(
                  "INSERT INTO comments(id,job_id,author_id,role,body,created) VALUES(?,?,?,?,?,?)",
                  id(),
                  job.id,
                  user.id,
                  "admin",
                  "Mecha registró que avisó al cliente de esta entrega.",
                  now,
                );
              })();
              return json({ job: store.job(job.id, user.id, true) });
            }
            if (match[2] === "/reset" && req.method === "POST") {
              const owner = store.query(
                "SELECT id,role FROM users WHERE id=?",
                job.user_id,
              );
              check(
                owner?.role === "client",
                "Las cuentas de operador se recuperan desde la terminal.",
                403,
              );
              const token = randomBytes(32).toString("base64url"),
                expires = Date.now() + RESET_AGE;
              store.db.transaction(() => {
                store.run(
                  "DELETE FROM password_resets WHERE user_id=?",
                  owner.id,
                );
                store.run(
                  "INSERT INTO password_resets VALUES(?,?,?)",
                  digest(token),
                  owner.id,
                  expires,
                );
              })();
              return json({
                url: `${origins[0]}/#clave=${token}`,
                expires,
              });
            }
            if (match[2] === "/proposal" && req.method === "POST")
              return json({
                job: sendProposal(store, job, user, await body(req)),
              });
            if (match[2] === "/delivery" && req.method === "POST") {
              check(
                Number(req.headers.get("content-length") || 0) <=
                  DELIVERY_LIMIT + 65536,
                "La entrega supera 20 MB.",
                413,
              );
              return json({
                job: await publishDelivery(
                  store,
                  job,
                  user,
                  await formularioLimitado(
                    req,
                    DELIVERY_LIMIT + 65536,
                    "La entrega supera 20 MB.",
                  ),
                ),
              });
            }
          }
          throw new AppError("Ruta no encontrada.", 404);
        }
        if (path === "/api/uploads" && req.method === "POST") {
          check(
            Number(req.headers.get("content-length") || 0) <=
              FILE_LIMIT + 65536,
            "Adjunta un archivo de hasta 8 MB.",
            413,
          );
          const form = await formularioLimitado(
              req,
              FILE_LIMIT + 65536,
              "Adjunta un archivo de hasta 8 MB.",
            ),
            file = form.get("file");
          check(
            file instanceof File && file.size > 0,
            "Selecciona un archivo.",
          );
          check(
            file.size <= FILE_LIMIT,
            "Adjunta un archivo de hasta 8 MB.",
            413,
          );
          const ext = extname(file.name).slice(1).toLowerCase();
          check(
            uploadExtensions.includes(ext),
            "Este formato no está disponible. Adjunta documentos, hojas de cálculo, presentaciones, imágenes, audio, video o ZIP.",
          );
          const count = store.query(
            "SELECT COUNT(*) AS n FROM uploads WHERE user_id=?",
            user.id,
          ).n;
          check(count < 200, "Tu espacio alcanzó el límite de archivos.", 429);
          const uploadId = id(),
            name = safeName(file.name),
            filePath = `${uploadId}.${ext}`,
            buffer = Buffer.from(await file.arrayBuffer()),
            summary = { type: "file", bytes: file.size };
          await writeFile(join(store.dir, "files", filePath), buffer, {
            mode: 0o600,
          });
          try {
            store.run(
              "INSERT INTO uploads VALUES(?,?,?,?,?,?,?)",
              uploadId,
              user.id,
              name,
              ext,
              filePath,
              JSON.stringify(summary),
              Date.now(),
            );
          } catch (e) {
            await unlink(join(store.dir, "files", filePath));
            throw e;
          }
          return json({ id: uploadId, name, summary }, 201);
        }
        const uploadMatch = path.match(/^\/api\/uploads\/([a-f0-9-]+)$/);
        if (uploadMatch && req.method === "DELETE") {
          const upload = store.upload(uploadMatch[1], user.id);
          check(
            !store.uploadLinked(upload.id),
            "Este archivo forma parte de un pedido.",
          );
          store.run("DELETE FROM uploads WHERE id=?", upload.id);
          await unlink(join(store.dir, "files", upload.path)).catch(() => {});
          return json({ ok: true });
        }
        if (path === "/api/jobs" && req.method === "GET")
          return json({
            jobs: store.all(
              "SELECT id,prompt,status,created,updated FROM jobs WHERE user_id=? ORDER BY created DESC LIMIT 200",
              user.id,
            ),
          });
        if (path === "/api/jobs" && req.method === "POST") {
          check(store.profile(user.id), "Primero registra tu negocio.");
          const count = store.query(
            "SELECT COUNT(*) AS n FROM jobs WHERE user_id=? AND created>?",
            user.id,
            Date.now() - 24 * 60 * 60 * 1000,
          ).n;
          check(
            count < Number(process.env.DAILY_JOB_LIMIT || 30),
            "Alcanzaste el límite de solicitudes de hoy.",
            429,
          );
          const input = await body(req);
          check(typeof input.prompt === "string", "Escribe qué necesitas.");
          const prompt = input.prompt.trim();
          check(
            prompt.length >= 3 && prompt.length <= 10000,
            "Escribe una solicitud de 3 a 10,000 caracteres.",
          );
          const desiredResult = String(input.desiredResult || "").trim();
          check(desiredResult.length <= 1500, "La meta es demasiado larga.");
          let uploadIds = attachmentIds(input, user.id),
            threadId = id();
          if (input.parentId) {
            const parent = store.job(input.parentId, user.id);
            check(
              parent.status === "delivered",
              "Agrega información al pedido que sigue en proceso.",
            );
            threadId = parent.thread_id;
            if (!uploadIds.length)
              uploadIds = parent.attachments.map((a) => a.id);
          }
          const jobId = id(),
            now = Date.now();
          store.db.transaction(() => {
            store.run(
              "INSERT INTO jobs(id,user_id,thread_id,prompt,status,upload_id,created,updated,business_snapshot,proposal_required,desired_result) VALUES(?,?,?,?,?,?,?,?,?,1,?)",
              jobId,
              user.id,
              threadId,
              prompt,
              "received",
              uploadIds[0] || null,
              now,
              now,
              JSON.stringify(store.profile(user.id)),
              desiredResult,
            );
            uploadIds.forEach((uid, position) =>
              store.run(
                "INSERT INTO job_uploads VALUES(?,?,?)",
                jobId,
                uid,
                position,
              ),
            );
          })();
          return json({ job: store.job(jobId, user.id) }, 201);
        }
        const approvalMatch = path.match(/^\/api\/jobs\/([a-f0-9-]+)\/accept$/);
        if (approvalMatch && req.method === "POST") {
          const job = store.job(approvalMatch[1], user.id);
          return json({
            job: acceptProposal(store, job, user, await body(req)),
          });
        }
        const feedbackMatch = path.match(
          /^\/api\/jobs\/([a-f0-9-]+)\/feedback$/,
        );
        if (feedbackMatch && req.method === "POST") {
          const job = store.job(feedbackMatch[1], user.id);
          check(job.status === "delivered", "Primero recibe la entrega.", 409);
          const input = await body(req),
            feedback = String(input.feedback || "").trim();
          check(
            feedback.length >= 3 && feedback.length <= 1500,
            "Describe el resultado en hasta 1,500 caracteres.",
          );
          store.db.transaction(() => {
            const current = store.job(job.id, user.id);
            check(
              current.status === "delivered",
              "La entrega cambió. Vuelve a revisarla.",
              409,
            );
            store.run(
              "UPDATE jobs SET feedback=?,updated=? WHERE id=?",
              feedback,
              changed(current),
              job.id,
            );
          })();
          return json({ job: store.job(job.id, user.id) });
        }
        const commentMatch = path.match(
          /^\/api\/jobs\/([a-f0-9-]+)\/comments$/,
        );
        if (commentMatch && req.method === "POST") {
          const job = store.job(commentMatch[1], user.id);
          check(
            job.status !== "delivered",
            "Crea un pedido de ajuste a partir de esta entrega.",
          );
          const input = await body(req),
            text = String(input.message || "").trim();
          check(
            text.length >= 3 && text.length <= 10000,
            "Escribe un mensaje de 3 a 10,000 caracteres.",
          );
          const uploadIds = attachmentIds(input, user.id);
          store.db.transaction(() => {
            const current = store.query(
              "SELECT updated,status FROM jobs WHERE id=?",
              job.id,
            );
            check(
              current && current.status !== "delivered",
              "La entrega ya se publicó. Abre el pedido de nuevo para solicitar un ajuste.",
              409,
            );
            comment(
              { ...job, updated: current.updated },
              user,
              text,
              uploadIds,
            );
            store.run(
              "UPDATE jobs SET status=?,updated=? WHERE id=?",
              replyStatus(store.job(job.id, user.id)),
              changed(current),
              job.id,
            );
          })();
          return json({ job: store.job(job.id, user.id) }, 201);
        }
        const jobMatch = path.match(/^\/api\/jobs\/([a-f0-9-]+)$/);
        if (jobMatch && req.method === "GET")
          return json({ job: store.job(jobMatch[1], user.id) });
        if (jobMatch && req.method === "DELETE") {
          const job = store.job(jobMatch[1], user.id);
          check(
            job.status === "delivered",
            "Solo se pueden eliminar pedidos entregados.",
          );
          const artifacts = store.all(
            "SELECT path,preview_path FROM artifacts WHERE job_id=?",
            job.id,
          );
          const uploadIds = [
            ...job.attachments.map((a) => a.id),
            ...job.comments.flatMap((c) => c.attachments.map((a) => a.id)),
          ];
          store.run("DELETE FROM jobs WHERE id=?", job.id);
          await Promise.all(
            artifacts
              .flatMap((a) => [a.path, a.preview_path].filter(Boolean))
              .map((p) => unlink(join(store.dir, "files", p)).catch(() => {})),
          );
          for (const uid of new Set(uploadIds))
            if (!store.uploadLinked(uid)) {
              const u = store.upload(uid, user.id);
              store.run("DELETE FROM uploads WHERE id=?", uid);
              await unlink(join(store.dir, "files", u.path)).catch(() => {});
            }
          return json({ ok: true });
        }
        const fileMatch = path.match(
          /^\/api\/(uploads|artifacts)\/([a-f0-9-]+)(\/preview)?$/,
        );
        if (fileMatch && req.method === "GET") {
          const [, type, fileId, preview] = fileMatch;
          let row;
          if (type === "uploads") {
            row = store.query("SELECT * FROM uploads WHERE id=?", fileId);
            check(
              row &&
                (row.user_id === user.id ||
                  (user.role === "admin" && store.uploadLinked(fileId))),
              "Archivo no encontrado.",
              404,
            );
            check(!preview, "Vista previa no disponible.", 404);
          } else {
            row = store.query(
              "SELECT a.*,j.status FROM artifacts a JOIN jobs j ON a.job_id=j.id WHERE a.id=?",
              fileId,
            );
            check(
              row &&
                (user.role === "admin" ||
                  (row.user_id === user.id && row.status === "delivered")),
              "Entrega no encontrada.",
              404,
            );
            if (preview)
              check(row.kind === "html", "Vista previa no disponible.", 404);
          }
          const file = Bun.file(
            join(
              store.dir,
              "files",
              preview ? row.preview_path || row.path : row.path,
            ),
          );
          check(await file.exists(), "El archivo ya no está disponible.", 404);
          const headers = {
            "Content-Type": preview
              ? "text/html; charset=utf-8"
              : row.mime || "application/octet-stream",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            "Content-Disposition": `${preview ? "inline" : "attachment"}; filename="${safeName(row.name)}"`,
          };
          if (preview)
            headers["Content-Security-Policy"] =
              "default-src 'none'; style-src 'unsafe-inline'; img-src data:; script-src 'none'; form-action 'none'; base-uri 'none'; sandbox";
          return new Response(file, { headers });
        }
        throw new AppError("Ruta no encontrada.", 404);
      }
      check(["GET", "HEAD"].includes(req.method), "Método no permitido.", 405);
      const allowed = ["/", "/operacion"].includes(path) ? "/index.html" : path;
      check(
        /^\/(index\.html|style\.css|build\/app\.js|assets\/(logo\.webp|tokens\.css|Archivo-VF\.woff2|DMSans-VF\.woff2))$/.test(
          allowed,
        ),
        "Página no encontrada.",
        404,
      );
      const file = Bun.file(join(PUBLIC, allowed.slice(1)));
      check(await file.exists(), "Archivo no encontrado.", 404);
      return new Response(req.method === "HEAD" ? null : file, {
        headers: {
          "Content-Type": file.type,
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "X-Frame-Options": "DENY",
          "Content-Security-Policy":
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      if (!(error instanceof AppError))
        console.error("Error interno:", error.message);
      return json(
        {
          error:
            error instanceof AppError
              ? error.message
              : "Ocurrió un error en Mecha. Vuelve a intentarlo.",
        },
        error instanceof AppError ? error.status : 500,
      );
    }
  }
  return { fetch, store, cleanOrphans };
}
if (import.meta.main) {
  const port = Number(process.env.PORT || 4195),
    hostname = process.env.HOST || "127.0.0.1";
  const origins = process.env.APP_ORIGIN
    ? [process.env.APP_ORIGIN]
    : [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
  const app = createApp({
    origins,
    secure: process.env.COOKIE_SECURE === "true",
  });
  const server = Bun.serve({
    hostname,
    port,
    fetch: app.fetch,
    maxRequestBodySize: DELIVERY_LIMIT + 65536,
    idleTimeout: 30,
  });
  app.cleanOrphans();
  setInterval(() => app.cleanOrphans(), 60 * 60 * 1000).unref();
  console.log(
    `Mecha lista en ${origins[0]}. Pedidos y entregas manuales; sin conexión a IA.`,
  );
  process.on("SIGINT", () => {
    server.stop();
    app.store.db.close();
    process.exit(0);
  });
}
