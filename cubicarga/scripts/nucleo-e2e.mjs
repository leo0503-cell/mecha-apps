import { chromium } from "playwright";
import fs from "node:fs";
const url = process.env.APP_URL ?? "http://localhost:4218",
  out = process.env.CAPTURAS_DIR ?? "docs/capturas/despues/fase-3";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_BIN,
});
const errors = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      acceptDownloads: true,
    });
    page.on("pageerror", (e) => errors.push(e.message));
    page.setDefaultTimeout(20000);
    await page.goto(`${url}/planificar`, { waitUntil: "networkidle" });
    await page
      .getByLabel("Nombre del escenario", { exact: true })
      .fill("Prueba de integración");
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await page
      .getByRole("button", { name: "Agregar material", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Agregar material", exact: true })
      .click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({
      path: `${out}/carga-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await page.getByRole("button", { name: "Siguiente", exact: true }).click();
    await page
      .getByLabel("Agregar equipo a la flota", { exact: true })
      .selectOption({ label: "Contenedor 20' DV" });
    await page
      .getByRole("button", { name: "Calcular plan", exact: true })
      .click();
    await page.getByText("Unidades cargadas", { exact: true }).waitFor();
    await page.waitForTimeout(500);
    await page
      .getByRole("button", { name: "Guardar escenario", exact: true })
      .click();
    await page.getByText("Escenario guardado", { exact: true }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${out}/plan-${width}.png`, fullPage: true });
    for (const name of ["Exportar Excel", "Exportar PNG"]) {
      const result = page.waitForEvent("download");
      await page.getByRole("button", { name, exact: true }).click();
      const download = await result;
      if (await download.failure()) throw new Error(`Descarga fallida ${name}`);
      console.log(name, download.suggestedFilename());
    }
    const popup = page.waitForEvent("popup");
    await page
      .getByRole("button", { name: "PDF / imprimir", exact: true })
      .click();
    const report = await popup;
    await report.waitForLoadState();
    if (!(await report.locator("body").innerText()).includes("Paso a paso"))
      throw new Error("Informe incompleto");
    await report.pdf({
      path: `${out}/informe-${width}.pdf`,
      format: "A4",
      printBackground: true,
    });
    await report.close();
    await page.goto(`${url}/proyectos`, { waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: "Prueba de integración", exact: true })
      .first()
      .waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({
      path: `${out}/proyectos-${width}.png`,
      fullPage: true,
    });
    await page.goto(`${url}/almacen`, { waitUntil: "networkidle" });
    await page.getByLabel("Altura por nivel mm", { exact: true }).fill("2200");
    await page
      .getByRole("button", { name: "Calcular capacidad", exact: true })
      .click();
    await page
      .getByText(/posiciones/)
      .first()
      .waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    await page.screenshot({
      path: `${out}/racks-${width}.png`,
      fullPage: true,
    });
    const response = await page.request.get(
      `${url}/api/planes/${"a".repeat(32)}`,
    );
    if (response.status() !== 404)
      throw new Error("Token inexistente no devuelve 404");
    console.log("Flujo núcleo", width, "completo");
    await page.close();
  }
  if (errors.length) throw new Error(errors.join("\n"));
  fs.writeFileSync(
    "docs/nucleo-e2e.json",
    JSON.stringify(
      {
        viewport: [1440, 390],
        status: "pasa",
        errors,
        flows: [
          "asistente",
          "mixto",
          "guardar local",
          "XLSX",
          "PNG",
          "informe PDF",
          "proyectos",
          "racks",
          "token 404",
        ],
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
