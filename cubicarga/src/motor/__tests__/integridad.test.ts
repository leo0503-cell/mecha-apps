import { describe, expect, it } from "vitest";
import {
  calcularHomogeneo,
  equipoPorCodigo,
  validarPlan,
  type PlanCarga,
} from "..";
const base = (): PlanCarga =>
  calcularHomogeneo({
    material: {
      id: "m",
      nombre: "Caja",
      largo: 600,
      ancho: 400,
      alto: 400,
      peso: 15,
      apilable: false,
      orientaciones: ["LAH"],
    },
    equipo: equipoPorCodigo("40HC"),
    cantidad: 2,
    modoCarga: "suelta",
  });
describe("Validador rechaza planes manipulados sin lanzar excepción", () => {
  it.each([
    [
      "equipo inexistente",
      (p: PlanCarga) => {
        p.colocaciones[0].equipoIdx = 99;
      },
    ],
    [
      "material inexistente",
      (p: PlanCarga) => {
        p.colocaciones[0].materialId = "ajeno";
      },
    ],
    [
      "NaN",
      (p: PlanCarga) => {
        p.colocaciones[0].x = NaN;
      },
    ],
    [
      "dimensión cero",
      (p: PlanCarga) => {
        p.colocaciones[0].l = 0;
      },
    ],
    [
      "dimensiones falseadas",
      (p: PlanCarga) => {
        p.colocaciones[0].l = 300;
      },
    ],
    [
      "orientación prohibida",
      (p: PlanCarga) => {
        p.colocaciones[0].orientacion = "ALH";
      },
    ],
    [
      "referencia tarima inválida",
      (p: PlanCarga) => {
        p.colocaciones[0].tarimaIdx = 9;
      },
    ],
  ])("%s", (_, cambiar) => {
    const p = base();
    cambiar(p);
    expect(() => validarPlan(p)).not.toThrow();
    expect(validarPlan(p).length).toBeGreaterThan(0);
  });
  it("rechaza peso omitido y datos fraccionarios", () => {
    const p = base();
    p.materiales[0].peso = NaN;
    p.colocaciones[0].x = 1.5;
    expect(validarPlan(p).length).toBeGreaterThan(0);
  });
});
