import fs from "node:fs";
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";
const url = process.env.APP_URL ?? "http://localhost:4218",
  out = "docs/capturas/despues/fase-7";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.BROWSER_BIN,
});
const resultados = [],
  errores = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      colorScheme: "light",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errores.push(e.message));
    async function revisar(nombre) {
      await page.waitForTimeout(350);
      const r = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      resultados.push({
        nombre,
        width,
        violaciones: r.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          descripcion: v.description,
          nodos: v.nodes.map((n) => ({
            target: n.target,
            resumen: n.failureSummary,
          })),
        })),
        revisionManual: r.incomplete.map((v) => v.id),
      });
      await page.screenshot({
        path: `${out}/${nombre}-${width}.png`,
        fullPage: true,
      });
    }
    for (const [ruta, nombre] of [
      ["/", "landing"],
      ["/calculadora", "calculadora"],
      ["/planificar", "planificar"],
      ["/proyectos", "proyectos"],
      ["/almacen", "almacen"],
      ["/herramientas", "herramientas"],
      ["/catalogos/materiales", "materiales"],
      ["/catalogos/equipos", "equipos"],
      ["/catalogos/tarimas", "tarimas"],
      ["/entrar", "entrar"],
    ]) {
      await page.goto(url + ruta, { waitUntil: "networkidle" });
      await revisar(nombre);
      if (ruta === "/calculadora") {
        await page
          .getByRole("button", { name: "Calcular", exact: true })
          .click();
        await page.getByText("Unidades cargadas", { exact: true }).waitFor();
        await page.waitForTimeout(1800);
        await revisar("resultado");
      }
      if (ruta === "/planificar") {
        await page
          .getByRole("button", { name: "Siguiente", exact: true })
          .click();
        await revisar("asistente-carga");
        await page
          .getByRole("button", { name: "Agregar material", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Siguiente", exact: true })
          .click();
        await revisar("asistente-unidad");
        await page
          .getByRole("button", { name: "Siguiente", exact: true })
          .click();
        await revisar("asistente-equipo");
      }
    }
    await context.close();
  }
  const c = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const p = await c.newPage();
  await p.goto(url + "/calculadora", { waitUntil: "networkidle" });
  const dark = await new AxeBuilder({ page: p })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  resultados.push({
    nombre: "calculadora-oscura",
    width: 1440,
    violaciones: dark.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodos: v.nodes.map((n) => ({
        target: n.target,
        resumen: n.failureSummary,
      })),
    })),
    revisionManual: dark.incomplete.map((v) => v.id),
  });
  await p.screenshot({
    path: `${out}/calculadora-oscura-1440.png`,
    fullPage: true,
  });
  await c.close();
  const informe = {
    entorno:
      "Chrome de Mac, 1440/390 px; axe WCAG A/AA, no sustituye revisión manual",
    errores,
    resultados,
  };
  fs.writeFileSync("docs/cierre-e2e.json", JSON.stringify(informe, null, 2));
  const fallas = resultados.reduce((s, r) => s + r.violaciones.length, 0);
  console.log(
    "Pantallas",
    resultados.length,
    "violaciones",
    fallas,
    "errores",
    errores.length,
  );
  if (fallas || errores.length) process.exitCode = 1;
} finally {
  await browser.close();
}
