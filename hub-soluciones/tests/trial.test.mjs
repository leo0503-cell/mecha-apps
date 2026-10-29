import test from "node:test";
import assert from "node:assert/strict";
import { secondsRemaining, getDeadline } from "../src/trial.ts";
const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, v),
};
test("vence exactamente a los 30 segundos, incluso tras un salto de reloj", () => {
  assert.equal(secondsRemaining(31_000, 1_000), 30);
  assert.equal(secondsRemaining(31_000, 30_999), 1);
  assert.equal(secondsRemaining(31_000, 31_000), 0);
  assert.equal(secondsRemaining(31_000, 90_000), 0);
});
test("reabrir una demo conserva el plazo y cada demo tiene su propio plazo", () => {
  store.clear();
  assert.equal(getDeadline("inventory", 1_000), 31_000);
  assert.equal(getDeadline("inventory", 20_000), 31_000);
  assert.equal(getDeadline("inventory", 40_000), 31_000);
  assert.equal(getDeadline("academy", 40_000), 70_000);
});
test("tolera almacenamiento malformado sin producir NaN", () => {
  store.clear();
  store.set("mecha.hub.trial.bad", "not-a-number");
  assert.equal(getDeadline("bad", 1_000), 31_000);
});
