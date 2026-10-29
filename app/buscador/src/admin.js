import { createStore, digest } from "./store.js";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const email = (process.argv[2] || "").trim().toLowerCase(),
  restore = process.argv.includes("--restablecer");
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Uso: bun run admin tu-correo@dominio.com [--restablecer]");
  process.exit(1);
}
const store = createStore(
  process.env.DATA_DIR || resolve(import.meta.dir, "../data"),
);
const db = store.db;
const user = db.query("SELECT id FROM users WHERE email=?").get(email);
const origin =
  process.env.APP_ORIGIN || `http://127.0.0.1:${process.env.PORT || 4195}`;
const save = (url) =>
  writeFileSync(
    resolve(store.dir, "acceso-mecha.json"),
    JSON.stringify({ email, url }),
    { mode: 0o600 },
  );
if (user && restore) {
  const token = randomBytes(32).toString("base64url");
  db.query("DELETE FROM password_resets WHERE user_id=?").run(user.id);
  db.query("INSERT INTO password_resets VALUES(?,?,?)").run(
    digest(token),
    user.id,
    Date.now() + 48 * 60 * 60 * 1000,
  );
  db.query("UPDATE users SET role='admin' WHERE id=?").run(user.id);
  save(`${origin}/operacion#clave=${token}`);
  console.log(
    "Enlace de un solo uso para elegir una nueva contraseña guardado en data/acceso-mecha.json (vence en 48 h).",
  );
} else if (user) {
  db.query("UPDATE users SET role='admin' WHERE id=?").run(user.id);
  console.log(
    "Acceso de operador Mecha habilitado. Entra con tu cuenta en /operacion.",
  );
} else {
  const token = randomBytes(32).toString("base64url");
  db.query("DELETE FROM admin_invites WHERE email=?").run(email);
  db.query("INSERT INTO admin_invites VALUES(?,?,?)").run(
    digest(token),
    email,
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  );
  save(`${origin}/operacion#alta=${token}`);
  console.log(
    "Invitación privada de un solo uso guardada en data/acceso-mecha.json. Permite crear tu cuenta de operador y elegir tu contraseña.",
  );
}
db.close();
