import { expect, it } from "vitest";
import { calcularHomogeneo, equipoPorCodigo, sugerirRelleno } from "..";
it("busca posiciones reales en el hueco libre sin mover las existentes", () => {
  const material = {
    id: "a",
    nombre: "Caja",
    largo: 600,
    ancho: 400,
    alto: 400,
    peso: 10,
    apilable: false,
    orientaciones: ["LAH", "ALH"] as const,
  };
  const m = { ...material, orientaciones: [...material.orientaciones] };
  const equipo = {
    ...equipoPorCodigo("20DV"),
    largo: 1200,
    ancho: 800,
    alto: 400,
    alturaUtil: 400,
    cargaUtil: 200,
  };
  const p = calcularHomogeneo({
    material: m,
    equipo,
    cantidad: 1,
    modoCarga: "suelta",
  });
  const snapshot = structuredClone(p);
  expect(sugerirRelleno(p, m).cantidad).toBe(3);
  expect(p).toEqual(snapshot);
});
