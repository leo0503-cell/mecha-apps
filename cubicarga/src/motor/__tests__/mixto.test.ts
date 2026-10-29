import { describe, expect, it } from "vitest";
import {
  calcularMixto,
  calcularHomogeneo,
  equipoPorCodigo,
  validarPlan,
  actualizarKpis,
  type Material,
} from "..";
import { fraccionSoporte } from "../geometria";
const equipo = {
  ...equipoPorCodigo("20DV"),
  largo: 1200,
  ancho: 800,
  alto: 800,
  alturaUtil: 800,
  puertaAncho: 800,
  puertaAlto: 800,
  cargaUtil: 200,
};
const material = (id: string, extra: Partial<Material> = {}): Material => ({
  id,
  nombre: id,
  largo: 600,
  ancho: 400,
  alto: 400,
  peso: 10,
  orientaciones: ["LAH", "ALH"],
  apilable: true,
  ...extra,
});
describe("Unión de soporte", () => {
  it("no cuenta áreas duplicadas para alcanzar el 80%", () => {
    expect(
      fraccionSoporte({ x: 0, y: 0, l: 100, a: 100 }, [
        { x: 0, y: 0, l: 40, a: 100 },
        { x: 0, y: 0, l: 40, a: 100 },
      ]),
    ).toBe(0.4);
  });
});
describe("Mixto determinista y validado", () => {
  it("acomoda SKUs diferentes, con soporte y sin colisión", () => {
    const p = calcularMixto({
      items: [
        { material: material("a"), cantidad: 4 },
        { material: material("b"), cantidad: 4 },
      ],
      equipos: [equipo],
    });
    expect(p.kpis.unidadesCargadas).toBe(8);
    expect(validarPlan(p)).toEqual([]);
    expect(p.noCargados).toEqual([]);
  });
  it("mismas entradas y semilla generan el mismo resultado", () => {
    const e = {
      items: [
        { material: material("a"), cantidad: 4 },
        { material: material("b"), cantidad: 4 },
      ],
      equipos: [equipo],
      parametros: { semilla: 37 },
    };
    expect(calcularMixto(e)).toEqual(calcularMixto(e));
  });
  it("respeta carga útil y reporta el motivo real", () => {
    const p = calcularMixto({
      items: [{ material: material("a", { peso: 45 }), cantidad: 8 }],
      equipos: [equipo],
    });
    expect(p.kpis.unidadesCargadas).toBe(4);
    expect(p.noCargados[0].motivo).toBe("peso");
    expect(p.kpis.factorLimitante).toBe("peso");
    expect(validarPlan(p)).toEqual([]);
  });
  it("conserva bultos bloqueados al reoptimizar", () => {
    const first = calcularMixto({
      items: [{ material: material("a"), cantidad: 2 }],
      equipos: [equipo],
    });
    const c = first.colocaciones[0];
    const p = calcularMixto({
      items: [{ material: material("a"), cantidad: 4 }],
      equipos: [equipo],
      bloqueadas: [c],
    });
    expect(
      p.colocaciones.some(
        (b) =>
          b.x === c.x &&
          b.y === c.y &&
          b.z === c.z &&
          b.materialId === c.materialId,
      ),
    ).toBe(true);
    expect(p.kpis.unidadesCargadas).toBe(4);
  });
  it("no permite no apilable ni sobrecarga de resistencia", () => {
    for (const extra of [
      { apilable: false },
      { maxPesoEncima: 0 },
      { maxCapas: 1 },
    ]) {
      const p = calcularMixto({
        items: [{ material: material("a", extra), cantidad: 8 }],
        equipos: [equipo],
      });
      expect(p.colocaciones.every((c) => c.z === 0)).toBe(true);
      expect(validarPlan(p)).toEqual([]);
    }
  });
  it("permite flota de diferentes equipos sin violar carga útil", () => {
    const p = calcularMixto({
      items: [{ material: material("a", { apilable: false }), cantidad: 8 }],
      equipos: [equipo, { ...equipo, id: "equipo2", codigo: "OTRO" }],
    });
    expect(p.kpis.equiposUsados).toBe(2);
    expect(p.kpis.unidadesCargadas).toBe(8);
    expect(validarPlan(p)).toEqual([]);
  });
  it("recalcula KPIs adulterados desde geometría y masa", () => {
    const p = calcularMixto({
      items: [{ material: material("a"), cantidad: 2 }],
      equipos: [equipo],
    });
    p.kpis.pesoRealKg = 0;
    expect(actualizarKpis(p).kpis.pesoRealKg).toBe(20);
  });
  it("reporta búsqueda agotada sin decir que el volumen es el limitante", () => {
    const p = calcularMixto({
      items: [
        {
          material: material("a", { largo: 10, ancho: 10, alto: 10 }),
          cantidad: 1000000,
        },
      ],
      equipos: [{ ...equipo, cargaUtil: null }],
      parametros: { tiempoMaxS: 0.01 },
    });
    expect(p.kpis.factorLimitante).toBe("busqueda");
    expect(p.noCargados[0].motivo).toBe("limite_busqueda");
  });
});
describe("LIFO independiente", () => {
  it("detecta bloqueo horizontal aunque alguien falsee los KPIs", () => {
    const p = calcularHomogeneo({
      material: material("a"),
      equipo,
      cantidad: 2,
      modoCarga: "suelta",
    });
    p.materiales.push(material("b", { paradaDescarga: 2 }));
    const [a, b] = p.colocaciones;
    a.x = 0;
    a.y = 0;
    a.z = 0;
    b.x = 600;
    b.y = 0;
    b.z = 0;
    b.materialId = "b";
    expect(validarPlan(p).map((v) => v.tipo)).toContain("lifo");
    [a.materialId, b.materialId] = [b.materialId, a.materialId];
    expect(validarPlan(p)).toEqual([]);
  });
  it("detecta bloqueo vertical por una parada posterior", () => {
    const p = calcularHomogeneo({
      material: material("a"),
      equipo,
      cantidad: 2,
      modoCarga: "suelta",
    });
    p.materiales.push(material("b", { paradaDescarga: 2 }));
    const [a, b] = p.colocaciones;
    a.x = b.x = 0;
    a.y = b.y = 0;
    a.z = 0;
    b.z = 400;
    b.materialId = "b";
    expect(validarPlan(p).map((v) => v.tipo)).toContain("lifo");
  });
});
