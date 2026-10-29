import { chromium } from "playwright";
import fs from "node:fs";
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.BROWSER_BIN || undefined,
    args: ["--enable-precise-memory-info"],
  });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.__channels = 0;
    const Original = window.MessageChannel;
    window.MessageChannel = class extends Original {
      constructor() {
        super();
        window.__channels++;
      }
    };
    window.__frames = { draws: 0, rendered: 0, total: 0 };
    window.__gpu = {};
    const registrados = new WeakSet(),
      eliminados = new WeakSet();
    for (const type of [
      window.WebGLRenderingContext,
      window.WebGL2RenderingContext,
    ])
      if (type) {
        for (const recurso of [
          "Buffer",
          "VertexArray",
          "Texture",
          "Framebuffer",
          "Renderbuffer",
        ]) {
          const crear = type.prototype["create" + recurso],
            borrar = type.prototype["delete" + recurso];
          if (!crear || !borrar) continue;
          type.prototype["create" + recurso] = function (...args) {
            const objeto = crear.apply(this, args);
            if (objeto && !registrados.has(objeto)) {
              registrados.add(objeto);
              window.__gpu[recurso] = (window.__gpu[recurso] ?? 0) + 1;
            }
            return objeto;
          };
          type.prototype["delete" + recurso] = function (objeto) {
            if (objeto && registrados.has(objeto) && !eliminados.has(objeto)) {
              eliminados.add(objeto);
              window.__gpu[recurso]--;
            }
            return borrar.call(this, objeto);
          };
        }
        for (const method of [
          "drawElements",
          "drawArrays",
          "drawElementsInstanced",
          "drawArraysInstanced",
        ]) {
          const original = type.prototype[method];
          if (!original) continue;
          type.prototype[method] = function (...args) {
            window.__frames.draws++;
            return original.apply(this, args);
          };
        }
      }
    function sample() {
      if (window.__frames.draws > 0) window.__frames.rendered++;
      window.__frames.total++;
      window.__frames.draws = 0;
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await page.goto(
    `${process.env.APP_URL || "http://localhost:4218"}/calculadora`,
    { waitUntil: "networkidle" },
  );
  await page.getByLabel("Largo", { exact: true }).fill("300");
  await page.getByLabel("Ancho", { exact: true }).fill("200");
  await page.getByLabel("Alto", { exact: true }).fill("200");
  await page.getByLabel("Cantidad", { exact: true }).fill("1500");
  const calculate = async () => {
    await page.getByRole("button", { name: "Calcular", exact: true }).click();
    await page.getByRole("button", { name: "Calcular", exact: true }).waitFor();
    await page.getByText("1,500", { exact: true }).first().waitFor();
    await page.waitForTimeout(150);
  };
  for (let i = 0; i < 3; i++) await calculate();
  const cdp = await page.context().newCDPSession(page);
  const heap = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    return (await cdp.send("Runtime.getHeapUsage")).usedSize;
  };
  // Medir ambos extremos después de terminar intro (1.5 s) y cámara.
  await page.waitForTimeout(2000);
  const before = await heap();
  const channelsBefore = await page.evaluate(() => window.__channels);
  const gpuBefore = await page.evaluate(() => ({ ...window.__gpu }));
  for (let i = 0; i < 20; i++) await calculate();
  await page.waitForTimeout(2000);
  const after = await heap();
  const channelsAfter = await page.evaluate(() => window.__channels);
  const gpuAfter = await page.evaluate(() => ({ ...window.__gpu }));
  const gpuDelta = Object.fromEntries(
    Object.entries(gpuAfter).map(([k, v]) => [k, v - (gpuBefore[k] ?? 0)]),
  );
  await page.evaluate(() => {
    window.__frames.rendered = 0;
    window.__frames.total = 0;
  });
  const start = Date.now();
  await page.waitForTimeout(5000);
  const elapsed = (Date.now() - start) / 1000;
  const frames = await page.evaluate(() => window.__frames);
  const result = {
    environment:
      "Chrome headless instalado en Mac; viewport móvil emulado, DPR2; no móvil físico",
    bultos: 1500,
    recalculos: 20,
    warmup: 3,
    estabilizacionMs: 2000,
    heapBefore: before,
    heapAfter: after,
    deltaPct: ((after - before) / before) * 100,
    canalesNuevos: channelsAfter - channelsBefore,
    gpuRecursosAntes: gpuBefore,
    gpuRecursosDespues: gpuAfter,
    gpuDelta,
    renderedFrames: frames.rendered,
    seconds: elapsed,
    renderedFps: frames.rendered / elapsed,
    errors,
  };
  fs.writeFileSync(
    process.env.VISOR_REPORT ?? "docs/visor-rendimiento.json",
    JSON.stringify(result, null, 2),
  );
  console.log(result);
  await browser.close();
  if (
    Object.values(gpuDelta).some((delta) => delta > 0) ||
    result.canalesNuevos !== 0 ||
    result.deltaPct > 10 ||
    result.renderedFps < 30 ||
    errors.length
  )
    throw new Error(
      "No se cumple el presupuesto de memoria/FPS/canales; revisar el reporte",
    );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
