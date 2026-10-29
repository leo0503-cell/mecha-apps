import fs from "node:fs";
import lighthouse from "lighthouse";
import { launch } from "chrome-launcher";
const url = process.env.APP_URL ?? "http://localhost:4218";
fs.mkdirSync("docs/lighthouse", { recursive: true });
const resultados = [];
for (let i = 1; i <= 3; i++) {
  const chrome = await launch({
    chromePath: process.env.BROWSER_BIN,
    chromeFlags: ["--headless", "--no-first-run"],
    port: 9228,
    connectionPollInterval: 1000,
    maxConnectionRetries: 90,
  });
  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      logLevel: "error",
      output: ["json", "html"],
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });
    fs.writeFileSync(`docs/lighthouse/corrida-${i}.json`, result.report[0]);
    fs.writeFileSync(`docs/lighthouse/corrida-${i}.html`, result.report[1]);
    const row = {
      corrida: i,
      performance: result.lhr.categories.performance.score * 100,
      accessibility: result.lhr.categories.accessibility.score * 100,
      bestPractices: result.lhr.categories["best-practices"].score * 100,
      seo: result.lhr.categories.seo.score * 100,
      lcpMs: result.lhr.audits["largest-contentful-paint"].numericValue,
    };
    resultados.push(row);
    console.log(row);
  } finally {
    await chrome.kill();
  }
}
const mediana = (k) => resultados.map((r) => r[k]).sort((a, b) => a - b)[1];
const resumen = {
  entorno:
    "Chrome instalado en Mac, Lighthouse móvil con throttling simulado; producción local",
  corridas: resultados,
  medianas: {
    performance: mediana("performance"),
    accessibility: mediana("accessibility"),
    bestPractices: mediana("bestPractices"),
    seo: mediana("seo"),
    lcpMs: mediana("lcpMs"),
  },
};
fs.writeFileSync(
  "docs/lighthouse/resumen.json",
  JSON.stringify(resumen, null, 2),
);
