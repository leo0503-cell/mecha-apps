import { expect, it } from "vitest";
import {
  calcularHomogeneo,
  calcularMixto,
  equipoPorCodigo,
  validarPlan,
} from "..";
import { bloquearConApoyos } from "../bloqueos";
const material = {
  id: "m",
  nombre: "Caja",
  largo: 600,
  ancho: 400,
  alto: 400,
  peso: 15,
  apilable: true,
  orientaciones: ["LAH" as const],
};
const equipo = {
  ...equipoPorCodigo("40HC"),
  largo: 600,
  ancho: 400,
  alto: 1200,
  alturaUtil: 1200,
  puertaAncho: 400,
  puertaAlto: 1200,
};
const plan = () =>
  calcularHomogeneo({ material, equipo, cantidad: 3, modoCarga: "suelta" });
it("bloquear el bulto superior conserva apoyos y permite reoptimizar", () => {
  const p = plan(),
    top = p.colocaciones.findIndex((c) => c.z === 800);
  expect(() =>
    calcularMixto({
      items: [{ material, cantidad: 3 }],
      equipos: [equipo],
      bloqueadas: [p.colocaciones[top]],
    }),
  ).toThrow();
  const ids = bloquearConApoyos(p, [top]);
  const r = calcularMixto({
    items: [{ material, cantidad: 3 }],
    equipos: [equipo],
    bloqueadas: ids.map((i) => p.colocaciones[i]),
  });
  expect(validarPlan(r)).toEqual([]);
  expect(r.colocaciones).toHaveLength(3);
  for (const c of p.colocaciones) expect(r.colocaciones).toContainEqual(c);
});
it("bloquear una caja en piso no inmoviliza cajas superiores", () => {
  const p = plan(),
    base = p.colocaciones.findIndex((c) => c.z === 0);
  expect(bloquearConApoyos(p, [base])).toEqual([base]);
});
