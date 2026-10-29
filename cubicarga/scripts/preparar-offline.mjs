import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
const archivos = [];
function recorrer(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) recorrer(p);
    else if (/\.(js|css|woff2)$/.test(p))
      archivos.push(
        "/_next/static/" +
          path.relative(".next/static", p).split(path.sep).join("/"),
      );
  }
}
recorrer(".next/static");
archivos.sort();
const version = createHash("sha256")
  .update(fs.readFileSync(".next/BUILD_ID", "utf8") + archivos.join("\n"))
  .digest("hex")
  .slice(0, 16);
fs.writeFileSync(
  "public/offline-assets.json",
  JSON.stringify({ version, assets: archivos }),
);
const nueva = 'let version = "cubicarga-' + version + '";';
const sw = fs
  .readFileSync("src/lib/pwa/service-worker.js", "utf8")
  .replace(/let version = "[^"]+";/, nueva);
fs.writeFileSync("public/sw.js", sw);
console.log("Assets offline", archivos.length);
