import { chromium } from "playwright";
import fs from "node:fs";
const url = process.env.APP_URL ?? "http://localhost:4218",
  out = process.env.CAPTURAS_DIR ?? "docs/capturas/despues/fase-4";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_BIN,
});
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${url}/planificar`, { waitUntil: "networkidle" });
  await page
    .getByLabel("Nombre del escenario", { exact: true })
    .fill("Carga recurrente de prueba");
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page
    .getByRole("button", { name: "Agregar material", exact: true })
    .click();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page
    .getByLabel("Agregar equipo a la flota", { exact: true })
    .selectOption({ label: "Contenedor 20' DV" });
  await page
    .getByRole("button", { name: "Calcular plan", exact: true })
    .click();
  await page.getByText("Unidades cargadas", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Guardar escenario", exact: true })
    .click();
  await page.getByText("Escenario guardado", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Guardar como plantilla", exact: true })
    .click();
  await page.getByText("Plantilla guardada", { exact: true }).waitFor();
  await page
    .getByLabel("Seleccionar bulto para editar (número global)", {
      exact: true,
    })
    .fill("1");
  await page.getByLabel("X mm", { exact: true }).fill("20000");
  await page.getByRole("alert").first().waitFor();
  const visor = page.getByRole("region", {
    name: "Visor del plan de carga",
    exact: true,
  });
  await visor.focus();
  await page.keyboard.press("Control+z");
  if (
    await page
      .getByRole("button", { name: "Exportar Excel", exact: true })
      .isDisabled()
  )
    throw new Error("Deshacer no restauró un plan exportable");
  await page.keyboard.press("2");
  await page
    .getByRole("button", { name: "Modo montacarguista", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.getByLabel("Paso cumplido", { exact: true }).check();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await page.screenshot({ path: `${out}/montacarguista-1440.png` });
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Sugerir relleno", exact: true })
    .click();
  await page.getByText(/Se encontraron/).waitFor();
  await page.goto(`${url}/proyectos`, { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: "Duplicar escenario", exact: true })
    .first()
    .click();
  await page.getByText("Escenario duplicado", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Restaurar versión 1", exact: true })
    .first()
    .click();
  await page
    .getByText("Versión restaurada como nueva versión", { exact: true })
    .waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${out}/versiones-1440.png`, fullPage: true });
  await page.goto(`${url}/planificar`, { waitUntil: "networkidle" });
  await page
    .getByLabel("Carga recurrente", { exact: true })
    .selectOption({ label: "Carga recurrente de prueba" });
  await page
    .getByRole("button", { name: "Agregar material", exact: true })
    .waitFor();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${out}/plantilla-1440.png`, fullPage: true });
  if (errors.length) throw new Error(errors.join("\n"));
  fs.writeFileSync(
    "docs/operacion-e2e.json",
    JSON.stringify(
      {
        status: "pasa",
        errors,
        flows: [
          "plantilla recurrente",
          "edición inválida",
          "Ctrl+Z",
          "vistas 1–4",
          "montacarguista",
          "relleno",
          "duplicar",
          "restaurar sin sobrescribir",
        ],
      },
      null,
      2,
    ),
  );
  console.log("Operación verificada");
} finally {
  await browser.close();
}
