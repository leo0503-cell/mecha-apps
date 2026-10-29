import fs from "node:fs";
import { chromium } from "playwright";
const url = process.env.APP_URL ?? "http://localhost:4218";
const capturas = process.env.CAPTURAS_DIR ?? "docs/capturas/despues/fase-7/pwa";
fs.mkdirSync(capturas, {
  recursive: true,
});
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_BIN,
});
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    serviceWorkers: "allow",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url + "/calculadora", { waitUntil: "networkidle" });
  await page.waitForFunction(
    () => navigator.serviceWorker.controller != null,
    null,
    {
      timeout: 60000,
    },
  );
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await context.newCDPSession(page);
  const manifest = await cdp.send("Page.getAppManifest");
  if (manifest.errors?.length) throw new Error(JSON.stringify(manifest.errors));
  await context.setOffline(true);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Calcular", exact: true }).click();
  try {
    await page
      .getByText("Unidades cargadas", { exact: true })
      .waitFor({ timeout: 10000 });
  } catch (e) {
    console.log("OFFLINE", await page.locator("body").innerText(), errors);
    await page.screenshot({
      path: capturas + "/offline-error.png",
      fullPage: true,
    });
    throw e;
  }

  await page.waitForTimeout(2200);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: capturas + "/calculadora-offline-390.png",
    fullPage: true,
  });
  await page.goto(url + "/catalogos/equipos", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Equipos", exact: true }).waitFor();
  const filas = await page.getByRole("row").count();
  if (filas < 15) throw new Error("Catálogo global incompleto offline");
  await page.screenshot({
    path: capturas + "/catalogo-offline-390.png",
    fullPage: true,
  });
  const cacheUrls = await page.evaluate(async () => {
    const urls = [];
    for (const name of await caches.keys())
      for (const req of await (await caches.open(name)).keys())
        urls.push(req.url);
    return urls;
  });
  if (cacheUrls.some((u) => /\/api\/|\/p\//.test(u)))
    throw new Error("Se cacheó una ruta privada o token");
  if (errors.length) throw new Error(errors.join("\n"));
  fs.writeFileSync(
    "docs/pwa-e2e.json",
    JSON.stringify(
      {
        status: "pasa",
        manifest: manifest.url,
        manifestErrors: manifest.errors,
        offline: ["calculadora y Worker", "14 equipos globales"],
        cachePrivado: false,
        errors,
      },
      null,
      2,
    ),
  );
  console.log("PWA y offline verificados");
} finally {
  await browser.close();
}
