import { test, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createStore, id } from "../src/store.js";
import { createBackup, verifyBackup } from "../src/backup.js";

test("respaldo coherente incluye originales, previews y acuerdos; se restaura y detecta corrupción", async () => {
  const root = await mkdtemp(join(tmpdir(), "mecha-backup-test-"));
  let store, restored;
  try {
    store = createStore(join(root, "data"));
    const user = id(),
      job = id(),
      upload = id(),
      artifact = id();
    store.run(
      "INSERT INTO users VALUES(?,?,?,?,?)",
      user,
      "backup@example.com",
      "hash-sintético",
      Date.now(),
      "client",
    );
    store.run(
      "INSERT INTO uploads VALUES(?,?,?,?,?,?,?)",
      upload,
      user,
      "original.csv",
      "csv",
      upload + ".csv",
      "{}",
      Date.now(),
    );
    // Columnas explícitas para preservar compatibilidad con futuras migraciones.
    store.run(
      "INSERT INTO jobs(id,user_id,thread_id,prompt,status,created,updated,proposal_required,proposal_version) VALUES(?,?,?,?,?,?,?,?,?)",
      job,
      user,
      job,
      "Pedido sintético de respaldo",
      "in_progress",
      Date.now(),
      Date.now(),
      1,
      1,
    );
    store.run("INSERT INTO job_uploads VALUES(?,?,?)", job, upload, 0);
    store.run(
      "INSERT INTO proposals VALUES(?,?,?,?,?,?)",
      job,
      1,
      JSON.stringify({
        scope: "Alcance de prueba",
        amount_cents: 0,
        currency: "MXN",
      }),
      user,
      Date.now(),
      Date.now(),
    );
    store.run(
      "INSERT INTO artifacts VALUES(?,?,?,?,?,?,?,?)",
      artifact,
      job,
      user,
      "pagina.html",
      "html",
      artifact + ".html",
      "text/html",
      artifact + ".preview.html",
    );
    await writeFile(
      join(store.dir, "files", upload + ".csv"),
      "dato,prueba\nEjemplo,0",
    );
    await writeFile(
      join(store.dir, "files", artifact + ".html"),
      "<h1>Original</h1>",
    );
    await writeFile(
      join(store.dir, "files", artifact + ".preview.html"),
      "<h1>Preview</h1>",
    );
    const backup = createBackup(store.dir, join(root, "backups"));
    expect(backup.files).toBe(4);
    expect(verifyBackup(backup.path).files).toBe(4);
    restored = createStore(backup.path);
    const recovered = restored.job(job, user);
    expect(recovered.status).toBe("in_progress");
    expect(recovered.proposal.accepted_at).toBeGreaterThan(0);
    expect(recovered.attachment.id).toBe(upload);
    expect(
      await readFile(join(backup.path, "files", upload + ".csv"), "utf8"),
    ).toBe("dato,prueba\nEjemplo,0");
    restored.db.close();
    restored = null;
    await writeFile(
      join(backup.path, "files", upload + ".csv"),
      "archivo alterado",
    );
    expect(() => verifyBackup(backup.path)).toThrow("integridad");
    expect(() => createBackup(store.dir, join(store.dir, "backups"))).toThrow(
      "fuera",
    );
    await rm(join(store.dir, "files", upload + ".csv"));
    expect(() => createBackup(store.dir, join(root, "incomplete"))).toThrow();
    const failed = (await readdir(join(root, "incomplete")))[0];
    expect(await readdir(join(root, "incomplete", failed))).not.toContain(
      "manifest.json",
    );
  } finally {
    restored?.db.close();
    store?.db.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("migrar pedidos previos conserva su estado y no impone una propuesta retroactiva", async () => {
  const root = await mkdtemp(join(tmpdir(), "mecha-migrate-test-"));
  let store;
  try {
    const db = new Database(join(root, "mecha.sqlite"));
    db.exec(
      "CREATE TABLE jobs(id TEXT PRIMARY KEY,user_id TEXT,thread_id TEXT,prompt TEXT,status TEXT,response TEXT DEFAULT '',sources TEXT DEFAULT '[]',upload_id TEXT,created INTEGER,updated INTEGER,error TEXT)",
    );
    db.query(
      "INSERT INTO jobs(id,user_id,thread_id,prompt,status,created,updated) VALUES(?,?,?,?,?,?,?)",
    ).run("legacy", "client", "legacy", "Pedido previo", "in_progress", 1, 1);
    db.close();
    store = createStore(root);
    const row = store.query("SELECT * FROM jobs WHERE id='legacy'");
    expect(row.status).toBe("in_progress");
    expect(row.proposal_required).toBe(0);
    expect(row.proposal_version).toBe(0);
    expect(row.customer_notified_at).toBeNull();
  } finally {
    store?.db.close();
    await rm(root, { recursive: true, force: true });
  }
});
