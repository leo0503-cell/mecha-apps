import { requireAgreement } from "./proposals.js";
import { deliveryTypes as types } from "./formats.js";
import { writeFile, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import { id } from "./store.js";
import { safeName, cleanWebsite } from "./artifacts.js";
import { check } from "./errors.js";

export const DELIVERY_LIMIT = 20 * 1024 * 1024;
export const allowedLink = (value) => {
  if (!value) return "";
  check(
    typeof value === "string" && value.length <= 1500,
    "El enlace de entrega es demasiado largo.",
  );
  let url;
  try {
    url = new URL(value);
  } catch {
    check(
      false,
      "Incluye un enlace de entrega válido, empezando por https://.",
    );
  }
  check(
    ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password,
    "El enlace debe ser http o https y no incluir credenciales.",
  );
  return url.href;
};
export async function publishDelivery(store, job, actor, form) {
  requireAgreement(job);
  const expected = Number(form.get("updated"));
  check(
    Number.isSafeInteger(expected) && expected === job.updated,
    "El pedido cambió desde que lo abriste. Actualiza la vista antes de entregar.",
    409,
  );
  const message = String(form.get("message") || "").trim();
  check(
    message.length <= 10000,
    "El mensaje de entrega supera 10,000 caracteres.",
  );
  const url = allowedLink(String(form.get("url") || "").trim());
  const files = form
    .getAll("files")
    .filter((f) => f instanceof File && f.size > 0);
  check(files.length <= 8, "Puedes subir hasta ocho archivos por entrega.");
  check(
    files.reduce((n, f) => n + f.size, 0) <= DELIVERY_LIMIT,
    "La entrega supera 20 MB.",
    413,
  );
  check(
    message ||
      url ||
      files.length ||
      store.query("SELECT id FROM artifacts WHERE job_id=?", job.id),
    "Agrega un archivo, un enlace o el contenido de la entrega antes de publicarla.",
  );
  const existing = store.query(
    "SELECT COUNT(*) AS n FROM artifacts WHERE job_id=?",
    job.id,
  ).n;
  check(
    existing + files.length <= 16,
    "Este pedido ya alcanzó el límite de archivos.",
  );
  const prepared = [];
  for (const file of files) {
    const ext = extname(file.name).slice(1).toLowerCase();
    check(
      types[ext],
      "El formato de entrega no está disponible. Usa un formato del catálogo o un ZIP.",
    );
    const buffer = Buffer.from(await file.arrayBuffer());
    if (["xlsx", "xlsm", "docx", "pptx", "ods", "odt", "zip"].includes(ext))
      check(
        buffer.subarray(0, 2).toString() === "PK",
        "El archivo no tiene el formato indicado.",
      );
    if (ext === "pdf")
      check(
        buffer.subarray(0, 5).toString() === "%PDF-",
        "El PDF no es válido.",
      );
    const fileId = id(),
      path = `${fileId}.${ext}`;
    const [kind, mime] = types[ext];
    let preview;
    if (["html", "htm"].includes(ext)) {
      check(
        file.size <= 300000,
        "La página HTML supera 300 KB. Entrégala en un ZIP si es más grande.",
      );
      preview = Buffer.from(cleanWebsite(buffer.toString("utf8")));
    }
    prepared.push({
      id: fileId,
      path,
      kind,
      mime,
      name: safeName(file.name),
      buffer,
      preview_path: preview ? `${fileId}.preview.html` : null,
      preview,
    });
  }
  const paths = [];
  try {
    for (const file of prepared) {
      paths.push(file.path);
      await writeFile(join(store.dir, "files", file.path), file.buffer, {
        mode: 0o600,
      });
      if (file.preview) {
        paths.push(file.preview_path);
        await writeFile(
          join(store.dir, "files", file.preview_path),
          file.preview,
          { mode: 0o600 },
        );
      }
    }
    store.db.transaction(() => {
      const current = store.query(
        "SELECT updated FROM jobs WHERE id=?",
        job.id,
      );
      check(
        current && current.updated === expected,
        "El pedido se actualizó mientras subías la entrega. Revisa los cambios.",
        409,
      );
      requireAgreement(store.job(job.id, actor.id, true));
      for (const f of prepared)
        store.run(
          "INSERT INTO artifacts(id,job_id,user_id,name,kind,path,mime,preview_path) VALUES(?,?,?,?,?,?,?,?)",
          f.id,
          job.id,
          job.user_id,
          f.name,
          f.kind,
          f.path,
          f.mime,
          f.preview_path,
        );
      const now = Math.max(Date.now(), expected + 1);
      store.run(
        "UPDATE jobs SET status='delivered',response=?,delivery_url=?,error=NULL,customer_notified_at=NULL,updated=? WHERE id=?",
        message,
        url,
        now,
        job.id,
      );
      store.run(
        "INSERT INTO comments(id,job_id,author_id,role,body,created) VALUES(?,?,?,?,?,?)",
        id(),
        job.id,
        actor.id,
        "admin",
        "Mecha publicó la entrega.",
        now,
      );
    })();
  } catch (e) {
    await Promise.all(
      paths.map((p) => unlink(join(store.dir, "files", p)).catch(() => {})),
    );
    throw e;
  }
  return store.job(job.id, actor.id, true);
}
