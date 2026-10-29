import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  randomUUID,
  randomBytes,
  createHash,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { check } from "./errors.js";

const derive = promisify(scrypt);
export const id = () => randomUUID();
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await derive(password, salt, 64);
  return `${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password, value) {
  const [salt, hash] = value.split(":");
  const actual = await derive(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
export function createStore(directory) {
  const dir = resolve(directory);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  mkdirSync(resolve(dir, "files"), { recursive: true, mode: 0o700 });
  const db = new Database(resolve(dir, "mecha.sqlite"), { create: true });
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS businesses(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,profile TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS uploads(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,ext TEXT NOT NULL,path TEXT NOT NULL,summary TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,thread_id TEXT NOT NULL,prompt TEXT NOT NULL,status TEXT NOT NULL,response TEXT NOT NULL DEFAULT '',sources TEXT NOT NULL DEFAULT '[]',upload_id TEXT REFERENCES uploads(id),created INTEGER NOT NULL,updated INTEGER NOT NULL,error TEXT);
    CREATE TABLE IF NOT EXISTS artifacts(id TEXT PRIMARY KEY,job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,kind TEXT NOT NULL,path TEXT NOT NULL,mime TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS jobs_user_time ON jobs(user_id,created);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);`);
  const migrate = (table, column, definition) => {
    if (
      !db
        .query(`PRAGMA table_info(${table})`)
        .all()
        .some((c) => c.name === column)
    )
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  };
  migrate("users", "role", "TEXT NOT NULL DEFAULT 'client'");
  migrate("jobs", "business_snapshot", "TEXT NOT NULL DEFAULT '{}'");
  migrate("jobs", "delivery_url", "TEXT NOT NULL DEFAULT ''");
  migrate("artifacts", "preview_path", "TEXT");
  migrate("jobs", "proposal_required", "INTEGER NOT NULL DEFAULT 0");
  migrate("jobs", "proposal_version", "INTEGER NOT NULL DEFAULT 0");
  migrate("jobs", "desired_result", "TEXT NOT NULL DEFAULT ''");
  migrate("jobs", "customer_notified_at", "INTEGER");
  migrate("jobs", "feedback", "TEXT NOT NULL DEFAULT ''");

  db.exec(`CREATE TABLE IF NOT EXISTS comments(id TEXT PRIMARY KEY,job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,author_id TEXT NOT NULL REFERENCES users(id),role TEXT NOT NULL,body TEXT NOT NULL,upload_id TEXT REFERENCES uploads(id),created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS job_uploads(job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,upload_id TEXT NOT NULL REFERENCES uploads(id),position INTEGER NOT NULL,PRIMARY KEY(job_id,upload_id));
    CREATE TABLE IF NOT EXISTS comment_uploads(comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,upload_id TEXT NOT NULL REFERENCES uploads(id),position INTEGER NOT NULL,PRIMARY KEY(comment_id,upload_id));
    INSERT OR IGNORE INTO job_uploads SELECT id,upload_id,0 FROM jobs WHERE upload_id IS NOT NULL;
    INSERT OR IGNORE INTO comment_uploads SELECT id,upload_id,0 FROM comments WHERE upload_id IS NOT NULL;
    CREATE TABLE IF NOT EXISTS proposals(job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,version INTEGER NOT NULL,terms TEXT NOT NULL,author_id TEXT NOT NULL REFERENCES users(id),created INTEGER NOT NULL,accepted_at INTEGER,PRIMARY KEY(job_id,version));
    CREATE TABLE IF NOT EXISTS admin_invites(token TEXT PRIMARY KEY,email TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS password_resets(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS comments_job_time ON comments(job_id,created);
    UPDATE jobs SET status='delivered' WHERE status='done';
    UPDATE jobs SET status='in_progress',error=NULL WHERE status IN ('running','failed');`);
  const query = (sql, ...args) => db.query(sql).get(...args);
  const all = (sql, ...args) => db.query(sql).all(...args);
  const run = (sql, ...args) => db.query(sql).run(...args);
  function session(userId) {
    run("DELETE FROM sessions WHERE expires < ?", Date.now());
    const token = randomBytes(32).toString("base64url");
    run(
      "INSERT INTO sessions VALUES(?,?,?)",
      digest(token),
      userId,
      Date.now() + 1000 * 60 * 60 * 24 * 14,
    );
    return token;
  }
  function userFromCookie(cookie) {
    const token = cookie?.match(/(?:^|;\s*)mecha_session=([^;]+)/)?.[1];
    if (!token) return null;
    return query(
      "SELECT u.id,u.email,u.role FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?",
      digest(token),
      Date.now(),
    );
  }
  function profile(userId) {
    const row = query("SELECT profile FROM businesses WHERE user_id=?", userId);
    return row ? JSON.parse(row.profile) : null;
  }
  function upload(uploadId, userId) {
    const row = query(
      "SELECT * FROM uploads WHERE id=? AND user_id=?",
      uploadId,
      userId,
    );
    check(row, "Archivo no encontrado.", 404);
    return { ...row, summary: JSON.parse(row.summary) };
  }
  function job(jobId, userId, admin = false) {
    const row = admin
      ? query("SELECT * FROM jobs WHERE id=?", jobId)
      : query("SELECT * FROM jobs WHERE id=? AND user_id=?", jobId, userId);
    check(row, "Solicitud no encontrada.", 404);
    const publicUpload = (uid) => {
      const file = upload(uid, row.user_id);
      return { id: file.id, name: file.name, summary: file.summary };
    };
    const attachments = all(
      "SELECT upload_id FROM job_uploads WHERE job_id=? ORDER BY position",
      jobId,
    ).map((file) => publicUpload(file.upload_id));
    const comments = all(
      "SELECT * FROM comments WHERE job_id=? ORDER BY created,id",
      jobId,
    ).map((c) => {
      const attachments = all(
        "SELECT upload_id FROM comment_uploads WHERE comment_id=? ORDER BY position",
        c.id,
      ).map((file) => publicUpload(file.upload_id));
      return { ...c, attachments, attachment: attachments[0] || null };
    });
    let snapshot = JSON.parse(row.business_snapshot);
    if (!snapshot.name) snapshot = profile(row.user_id) || {};
    const isDelivered = row.status === "delivered";
    return {
      ...row,
      response: admin || isDelivered ? row.response : "",
      delivery_url: admin || isDelivered ? row.delivery_url : "",
      profile: snapshot,
      email: admin
        ? query("SELECT email FROM users WHERE id=?", row.user_id)?.email
        : undefined,
      comments,
      proposal: (() => {
        const p = query(
          "SELECT * FROM proposals WHERE job_id=? AND version=?",
          row.id,
          row.proposal_version,
        );
        return p
          ? {
              ...JSON.parse(p.terms),
              version: p.version,
              created: p.created,
              accepted_at: p.accepted_at,
            }
          : null;
      })(),
      proposal_history: all(
        "SELECT version,terms,created,accepted_at FROM proposals WHERE job_id=? ORDER BY version",
        row.id,
      ).map((p) => ({
        ...JSON.parse(p.terms),
        version: p.version,
        created: p.created,
        accepted_at: p.accepted_at,
      })),
      related: admin
        ? all(
            "SELECT id,prompt,status,created FROM jobs WHERE user_id=? AND thread_id=? AND id!=? ORDER BY created",
            row.user_id,
            row.thread_id,
            row.id,
          )
        : [],
      sources: JSON.parse(row.sources),
      attachments,
      attachment: attachments[0] || null,
      artifacts:
        admin || isDelivered
          ? all(
              "SELECT id,name,kind,mime FROM artifacts WHERE job_id=? AND user_id=?",
              jobId,
              row.user_id,
            )
          : [],
    };
  }
  function uploadLinked(uploadId) {
    return !!(
      query("SELECT job_id FROM job_uploads WHERE upload_id=?", uploadId) ||
      query(
        "SELECT comment_id FROM comment_uploads WHERE upload_id=?",
        uploadId,
      ) ||
      query("SELECT id FROM jobs WHERE upload_id=?", uploadId) ||
      query("SELECT id FROM comments WHERE upload_id=?", uploadId)
    );
  }
  // Adjuntos que el cliente subió pero nunca envió en un pedido o mensaje.
  function orphanUploads(olderThan = Date.now() - 24 * 60 * 60 * 1000) {
    return all(
      `SELECT id,path FROM uploads u WHERE created<? AND NOT EXISTS(SELECT 1 FROM job_uploads WHERE upload_id=u.id) AND NOT EXISTS(SELECT 1 FROM comment_uploads WHERE upload_id=u.id) AND NOT EXISTS(SELECT 1 FROM jobs WHERE upload_id=u.id) AND NOT EXISTS(SELECT 1 FROM comments WHERE upload_id=u.id)`,
      olderThan,
    );
  }
  return {
    db,
    dir,
    query,
    all,
    run,
    session,
    userFromCookie,
    profile,
    upload,
    uploadLinked,
    orphanUploads,
    job,
  };
}
