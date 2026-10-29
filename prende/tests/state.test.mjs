import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../web/js/state.js", import.meta.url),
  "utf8",
);
let run = 0;
async function readState(value) {
  globalThis.localStorage = { getItem: () => JSON.stringify(value) };
  return import(
    `data:text/javascript;base64,${Buffer.from(source).toString("base64")}#${run++}`
  );
}
test("datos locales malformados no rompen inicio, recetas o historial", async () => {
  const { state } = await readState({
    perfil: { negocio: 123, ciudad: "Aguascalientes" },
    radiografia: { sintomas: "whatsapp", numeros: [] },
    ruta: { hechos: [1, 1, -1, 31, "2"], recetas: [null, "r1"] },
    favoritas: [false, "r1"],
    mesa: [
      null,
      {},
      { pedido: "p", fecha: "2026-10-14", resultado: { respuesta: "ok" } },
    ],
    preferencias: { tema: "inventado", responsable: {} },
  });
  assert.equal(state.perfil.negocio, undefined);
  assert.deepEqual(state.radiografia.sintomas, []);
  assert.deepEqual(state.radiografia.numeros, {});
  assert.deepEqual(state.ruta.hechos, [1]);
  assert.deepEqual(state.ruta.recetas, ["r1"]);
  assert.equal(state.mesa.length, 1);
  assert.equal(state.preferencias.tema, "sistema");
  assert.equal(state.preferencias.responsable, "");
});
test("datos existentes válidos conservan perfil, cero y progreso", async () => {
  const { state } = await readState({
    perfil: { negocio: "Demo" },
    radiografia: {
      sintomas: ["competencia"],
      numeros: { competencia: { horas: "0" } },
    },
    ruta: { hechos: [1, 2] },
    preferencias: { tema: "dark", responsable: "Demo" },
  });
  assert.equal(state.perfil.negocio, "Demo");
  assert.equal(state.radiografia.numeros.competencia.horas, "0");
  assert.deepEqual(state.ruta.hechos, [1, 2]);
  assert.equal(state.preferencias.tema, "dark");
});
