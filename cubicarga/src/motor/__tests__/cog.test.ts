import { expect, it } from "vitest";
import { cogGlobal, type KpisEquipo } from "..";
it("el resumen global no oculta una desviación lateral fuera de tolerancia", () => {
  const a: KpisEquipo = {
    equipoIdx: 0,
    unidades: 1,
    pesoKg: 10,
    volumenM3: 1,
    pctPeso: 0.1,
    pctVolumen: 0.1,
    cog: {
      x: 0,
      y: 0,
      z: 0,
      desvLongitudinal: 0.09,
      desvLateral: 0,
      fueraDeTolerancia: false,
    },
  };
  const b: KpisEquipo = {
    ...a,
    equipoIdx: 1,
    cog: {
      ...a.cog!,
      desvLongitudinal: 0,
      desvLateral: 0.06,
      fueraDeTolerancia: true,
    },
  };
  expect(cogGlobal([a, b])?.fueraDeTolerancia).toBe(true);
});
