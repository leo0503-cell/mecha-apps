import { chromium } from "playwright";
import fs from "node:fs";
const url = process.env.APP_URL ?? "http://localhost:4218",
  out = process.env.CAPTURAS_DIR ?? "docs/capturas/despues/fase-5";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_BIN,
});
const errors = [];
try {
  for (const reduced of [false, true]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.__entrada = { maxX: 0, muestras: 0 };
      for (const cls of [
        window.WebGLRenderingContext,
        window.WebGL2RenderingContext,
      ])
        if (cls)
          for (const method of ["bufferData", "bufferSubData"]) {
            const original = cls.prototype[method];
            cls.prototype[method] = function (...args) {
              const data = args[method === "bufferData" ? 1 : 2];
              if (data instanceof Float32Array && data.length === 700 * 16) {
                for (let i = 0; i < 700; i++) {
                  if (data[i * 16] > 0.0001)
                    window.__entrada.maxX = Math.max(
                      window.__entrada.maxX,
                      data[i * 16 + 12],
                    );
                }
                window.__entrada.muestras++;
              }
              return original.apply(this, args);
            };
          }
    });
    await page.goto(url + "/calculadora", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Calcular", exact: true }).click();
    await page.getByText("Unidades cargadas", { exact: true }).waitFor();
    await page.waitForTimeout(2400);
    const captura = await page.evaluate(() => window.__entrada);
    console.log("Muestras", captura);
    if (!reduced && captura.maxX <= 12.032)
      throw new Error(
        "No se observó una caja entrando desde fuera de la puerta",
      );
    if (reduced && captura.maxX > 12.5)
      throw new Error("Reduced motion ejecutó una trayectoria de entrada");
    await page.getByLabel("Explotar capas", { exact: true }).check();
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "Superior", exact: true }).click();
    await page.waitForTimeout(700);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: out + (reduced ? "/reducido-1440.png" : "/capas-1440.png"),
      fullPage: true,
    });
    await page.getByLabel("Modo simple", { exact: true }).check();
    await page
      .getByLabel("Velocidad de carga", { exact: true })
      .selectOption("4");
    await page
      .getByRole("button", { name: "Reproducir secuencia", exact: true })
      .click();
    await page.waitForTimeout(350);
    if (
      reduced &&
      (await page
        .getByRole("button", { name: "Pausar secuencia", exact: true })
        .count())
    )
      throw new Error("La secuencia no se detuvo con reduced motion");
    console.log(reduced ? "Reduced motion" : "Movimiento", captura);
    await page.close();
  }
  if (errors.length) throw new Error(errors.join("\n"));
  fs.writeFileSync(
    "docs/motion-e2e.json",
    JSON.stringify(
      {
        status: "pasa",
        errors,
        checks: [
          "matrices con entrada por puerta",
          "reduced motion sin trayectoria",
          "explotar capas",
          "vista superior",
          "modo simple",
          "velocidad 4×",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
