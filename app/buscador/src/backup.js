import { Database } from "bun:sqlite";
import {
  mkdirSync,
  copyFileSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from "node:fs";
import { resolve, join, basename } from "node:path";
import { randomUUID, createHash } from "node:crypto";

// Los archivos son inmutables. Si una eliminación concurrente impide copiarlos,
// el respaldo queda sin manifiesto y debe repetirse; nunca se declara completo.
export function createBackup(dataDir, outputDir) {
  const source = resolve(dataDir),
    root = resolve(outputDir);
  if (root === source || root.startsWith(source + "/"))
    throw new Error("Guarda los respaldos fuera del directorio de datos.");
  const destination = join(
    root,
    new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID(),
  );
  mkdirSync(join(destination, "files"), { recursive: true, mode: 0o700 });
  const db = new Database(join(source, "mecha.sqlite"), { readonly: true });
  try {
    db.query("VACUUM INTO ?").run(join(destination, "mecha.sqlite"));
  } finally {
    db.close();
  }
  chmodSync(join(destination, "mecha.sqlite"), 0o600);
  const snapshot = new Database(join(destination, "mecha.sqlite"), {
    readonly: true,
  });
  let files;
  try {
    if (snapshot.query("PRAGMA integrity_check").get().integrity_check !== "ok")
      throw new Error("La copia SQLite no pasó la verificación.");
    if (snapshot.query("PRAGMA foreign_key_check").all().length)
      throw new Error("El respaldo contiene referencias inválidas.");
    files = [
      ...new Set([
        ...snapshot
          .query("SELECT path FROM uploads")
          .all()
          .map((r) => r.path),
        ...snapshot
          .query("SELECT path,preview_path FROM artifacts")
          .all()
          .flatMap((r) => [r.path, r.preview_path])
          .filter(Boolean),
      ]),
    ];
  } finally {
    snapshot.close();
  }
  const records = [];
  for (const filename of ["mecha.sqlite", ...files.map((f) => "files/" + f)]) {
    if (filename !== "mecha.sqlite") {
      const file = filename.slice(6);
      if (
        basename(file) !== file ||
        !/^[a-f0-9-]{36}(\.preview)?\.[a-z0-9]+$/.test(file)
      )
        throw new Error("El respaldo contiene una ruta de archivo inválida.");
      copyFileSync(join(source, filename), join(destination, filename));
      chmodSync(join(destination, filename), 0o600);
    }
    const content = readFileSync(join(destination, filename));
    records.push({
      path: filename,
      bytes: content.length,
      sha256: createHash("sha256").update(content).digest("hex"),
    });
  }
  writeFileSync(
    join(destination, "manifest.json"),
    JSON.stringify(
      { complete: true, created: new Date().toISOString(), files: records },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  return { path: destination, files: records.length };
}

export function verifyBackup(directory) {
  const root = resolve(directory),
    manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  if (
    manifest.complete !== true ||
    !Array.isArray(manifest.files) ||
    !manifest.files.some((f) => f.path === "mecha.sqlite")
  )
    throw new Error("El respaldo está incompleto.");
  for (const file of manifest.files) {
    if (
      file.path !== "mecha.sqlite" &&
      !/^files\/[a-f0-9-]{36}(\.preview)?\.[a-z0-9]+$/.test(file.path)
    )
      throw new Error("Ruta inválida en el manifiesto.");
    const content = readFileSync(join(root, file.path));
    if (
      content.length !== file.bytes ||
      createHash("sha256").update(content).digest("hex") !== file.sha256
    )
      throw new Error("La integridad de un archivo del respaldo no coincide.");
  }
  return { files: manifest.files.length, created: manifest.created };
}

if (import.meta.main) {
  const result =
    process.argv[2] === "verify"
      ? verifyBackup(process.argv[3])
      : createBackup(
          process.env.DATA_DIR || resolve(import.meta.dir, "../data"),
          process.env.BACKUP_DIR || resolve(import.meta.dir, "../backups"),
        );
  console.log(JSON.stringify(result));
}
