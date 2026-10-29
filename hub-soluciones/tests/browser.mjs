import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_BIN ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:4325");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
  assert.equal(await page.locator(".project-card").count(), 6);
  await page.getByRole("button", { name: "Finanzas", exact: true }).click();
  assert.equal(await page.locator(".project-card").count(), 1);
  await page.getByRole("button", { name: "Todas", exact: false }).click();
  await page.getByLabel("Buscar demo", { exact: true }).fill("inexistente");
  assert.equal(await page.locator(".project-card").count(), 0);
  await page.getByRole("button", { name: "Ver todas las demos" }).click();
  await page
    .locator(".project-card")
    .first()
    .getByRole("button", { name: "Probar demo en vivo" })
    .click();
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page.locator(".app-kpis strong").first().textContent(),
    "128",
  );
  await page.getByRole("button", { name: "Registrar salida" }).first().click();
  assert.equal(
    await page.locator(".app-kpis strong").first().textContent(),
    "127",
  );
  await page.getByRole("button", { name: "Cerrar demo" }).click();
  await page.evaluate(() =>
    sessionStorage.setItem(
      "mecha.hub.trial.inventario",
      String(Date.now() - 1000),
    ),
  );
  await page
    .locator(".project-card")
    .first()
    .getByRole("button", { name: "Probar demo en vivo" })
    .click();
  await page
    .getByRole("button", { name: "Ver paquetes y cotizar mi proyecto" })
    .waitFor();
  assert.equal(await page.locator(".app-sandbox").getAttribute("inert"), "");
  await page.screenshot({ path: "artifacts/lock.png" });
  await page
    .getByRole("button", { name: "Ver paquetes y cotizar mi proyecto" })
    .click();
  assert.equal(
    await page.getByLabel("Demo de interés", { exact: true }).inputValue(),
    "Inventario vivo",
  );
  await page.getByRole("link", { name: "Impulsar mi empresa" }).click();
  assert.equal(
    await page.getByLabel("Paquete de interés").inputValue(),
    "Business",
  );
  // Exercise all distinct apps.
  await page
    .locator(".project-card")
    .nth(1)
    .getByRole("button", { name: "Probar demo en vivo" })
    .click();
  await page.getByRole("button", { name: "Calcular volumen" }).click();
  assert.match(
    await page.locator(".cargo-result>strong").textContent(),
    /1.92/,
  );
  await page.keyboard.press("Escape");
  await page
    .locator(".project-card")
    .nth(2)
    .getByRole("button", { name: "Probar demo en vivo" })
    .click();
  await page.getByRole("button", { name: "Ir a la evaluación" }).click();
  await page
    .getByLabel("Detengo la maniobra y aviso al responsable", { exact: true })
    .check();
  await page.getByRole("button", { name: "Comprobar respuesta" }).click();
  assert.match(await page.getByRole("status").textContent(), /Correcto/);
  await page.keyboard.press("Escape");
  await page
    .locator(".project-card")
    .nth(3)
    .getByRole("button", { name: "Probar demo en vivo" })
    .click();
  await page.getByRole("button", { name: "Marcar como revisado" }).click();
  await page.getByRole("button", { name: "Expediente revisado" }).waitFor();
  await page.keyboard.press("Escape");
  await page
    .locator(".project-card")
    .nth(4)
    .getByRole("button", { name: "Probar demo en vivo" })
    .click();
  await page.getByLabel("Respuesta de práctica").selectOption("review");
  await page.getByRole("button", { name: "Comprobar práctica" }).click();
  assert.match(await page.getByRole("status").textContent(), /correcta/);
  await page.keyboard.press("Escape");
  await page
    .locator(".project-card")
    .nth(5)
    .getByRole("button", { name: "Probar demo en vivo" })
    .click();
  await page.getByRole("button", { name: "Preparar instrucción" }).click();
  assert.match(
    await page.locator(".prompt-output pre").textContent(),
    /No inventes precios/,
  );
  await page.keyboard.press("Escape");
  // Check the actual 30-second boundary with browser clock, without waiting in real time.
  await page.evaluate(() =>
    sessionStorage.removeItem("mecha.hub.trial.cubicarga"),
  );
  await page.clock.install();
  await page
    .locator(".project-card")
    .nth(1)
    .getByRole("button", { name: "Probar demo en vivo" })
    .click();
  assert.match(await page.getByRole("timer").textContent(), /00:30/);
  await page.clock.fastForward(29_000);
  assert.match(await page.getByRole("timer").textContent(), /00:01/);
  await page.clock.fastForward(1_000);
  await page
    .getByRole("button", { name: "Ver paquetes y cotizar mi proyecto" })
    .waitFor();
  await page.keyboard.press("Escape");
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("http://127.0.0.1:4325");
    await page.screenshot({
      path: `artifacts/mobile-${width}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `Overflow ${width}`,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: catalog filters, six demos, expiry, inert, quote context, keyboard and mobile overflow.",
  );
} finally {
  await browser.close();
}
