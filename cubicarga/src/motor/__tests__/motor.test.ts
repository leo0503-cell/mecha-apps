/** Pruebas de reglas de negocio adicionales del motor. */
import { describe, expect, it } from "vitest";
import {
  aKg,
  aMm,
  bctLbf,
  calcularHomogeneo,
  capasPorBct,
  empacar2D,
  equipoPorCodigo,
  MATERIALES_DEMO,
  orientacionesDePreset,
  tarimaPorId,
  validarPlan,
  type Material,
  type PlanCarga,
} from "..";

const mat = (id: string) => MATERIALES_DEMO.find((m) => m.id === id)!;

describe("Unidades", () => {
  it("convierte pulgadas y libras", () => {
    expect(aMm(1, "in")).toBe(25);
    expect(aMm(108, "in")).toBe(2743);
    expect(aKg(1, "lb")).toBe(0.454);
    expect(aMm(1.2, "m")).toBe(1200);
  });
});

describe("Orientaciones", () => {
  it("plano deja la cara mayor abajo", () => {
    expect(orientacionesDePreset("plano", 2440, 1220, 15)).toEqual([
      "LAH",
      "ALH",
    ]);
  });
  it("este lado arriba solo gira sobre el eje vertical", () => {
    expect(orientacionesDePreset("este_lado_arriba", 1, 2, 3)).toEqual([
      "LAH",
      "ALH",
    ]);
  });
});

describe("Empaque 2D", () => {
  it("encuentra 11 EUR en el piso de un 20'", () => {
    expect(
      empacar2D(5898, 2352, [
        { l: 1200, a: 800 },
        { l: 800, a: 1200 },
      ]).cuenta,
    ).toBe(11);
  });
  it("no hay traslapes en el patrón", () => {
    const p = empacar2D(12032, 2352, [
      { l: 600, a: 400 },
      { l: 400, a: 600 },
    ]);
    for (let i = 0; i < p.rects.length; i++)
      for (let j = i + 1; j < p.rects.length; j++) {
        const a = p.rects[i];
        const b = p.rects[j];
        const ox = Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.a, b.y + b.a) - Math.max(a.y, b.y);
        expect(ox > 0 && oy > 0).toBe(false);
      }
  });
});

describe("Apilado", () => {
  it("no apilable: una sola capa", () => {
    const plan = calcularHomogeneo({
      material: mat("m-ibc"),
      equipo: equipoPorCodigo("40HC"),
      cantidad: null,
      modoCarga: "suelta",
    });
    expect(plan.colocaciones.every((c) => c.z === 0)).toBe(true);
    expect(validarPlan(plan)).toEqual([]);
  });
  it("respeta max_capas", () => {
    const m: Material = { ...mat("m-caja-mediana"), maxCapas: 3 };
    const plan = calcularHomogeneo({
      material: m,
      equipo: equipoPorCodigo("40HC"),
      cantidad: null,
      modoCarga: "suelta",
    });
    expect(plan.kpis.capas).toBeLessThanOrEqual(3);
    expect(plan.kpis.factorLimitante).toBe("apilado");
    expect(validarPlan(plan)).toEqual([]);
  });
  it("respeta max_peso_encima", () => {
    const m: Material = { ...mat("m-caja-mediana"), maxPesoEncima: 40 };
    const plan = calcularHomogeneo({
      material: m,
      equipo: equipoPorCodigo("40HC"),
      cantidad: null,
      modoCarga: "suelta",
    });
    expect(plan.kpis.capas).toBeLessThanOrEqual(3);
    expect(validarPlan(plan)).toEqual([]);
  });
  it("BCT de McKee", () => {
    // Caja 400×300 mm (perímetro 55.1 in), ECT 32, calibre 0.16 in
    expect(bctLbf(32, 0.16, 400, 300)).toBeCloseTo(
      5.87 * 32 * Math.sqrt(0.16 * (1400 / 25.4)),
      6,
    );
    const m: Material = {
      ...mat("m-caja-chica"),
      ectLbIn: 32,
      calibreIn: 0.16,
    };
    const capas = capasPorBct(m, 400, 300);
    expect(capas).toBe(
      Math.floor(bctLbf(32, 0.16, 400, 300) / (4 * (8 / 0.45359237))) + 1,
    );
  });
});

describe("Atados de MDF en caja seca 53' (proyecto demo 1)", () => {
  it("sale limitado por peso", () => {
    const plan = calcularHomogeneo({
      material: mat("m-atado-mdf"),
      equipo: equipoPorCodigo("CS53"),
      cantidad: null,
      modoCarga: "suelta",
    });
    expect(plan.kpis.factorLimitante).toBe("peso");
    expect(plan.kpis.unidadesCargadas).toBe(Math.floor(20000 / 1630));
    expect(validarPlan(plan)).toEqual([]);
  });
});

describe("Paletizado", () => {
  const gma = tarimaPorId("ta-gma");
  it("arma tarimas dentro de la altura máxima y la carga máxima", () => {
    const plan = calcularHomogeneo({
      material: mat("m-caja-mediana"),
      equipo: equipoPorCodigo("40HC"),
      cantidad: null,
      modoCarga: "paletizada",
      tarima: gma,
    });
    expect(plan.kpis.cajasPorTarima).toBeGreaterThan(0);
    for (const t of plan.tarimasArmadas) {
      expect(t.h).toBeLessThanOrEqual(1800);
      expect(t.peso - gma.tara).toBeLessThanOrEqual(1000);
    }
    expect(validarPlan(plan)).toEqual([]);
  });
  it("cantidad: reparte en tarimas y equipos, última tarima parcial", () => {
    const plan = calcularHomogeneo({
      material: mat("m-caja-chica"),
      equipo: equipoPorCodigo("20DV"),
      cantidad: 1000,
      modoCarga: "paletizada",
      tarima: gma,
    });
    expect(plan.kpis.unidadesCargadas).toBe(1000);
    const cpt = plan.kpis.cajasPorTarima!;
    expect(plan.tarimasArmadas.length).toBe(Math.ceil(1000 / cpt));
    expect(validarPlan(plan)).toEqual([]);
  });
  it("doble estiba solo si cabe dos veces en la altura útil", () => {
    const plan = calcularHomogeneo({
      material: mat("m-caja-chica"),
      equipo: equipoPorCodigo("40HC"),
      cantidad: null,
      modoCarga: "paletizada",
      tarima: gma,
      alturaMaxArmada: 1200,
      parametros: { permitirDobleEstiba: true },
    });
    expect(plan.tarimasArmadas.some((t) => t.z > 0)).toBe(true);
    expect(validarPlan(plan)).toEqual([]);
  });
});

describe("Varios equipos y no cargados", () => {
  it("reparte en 2 equipos cuando no cabe en uno", () => {
    const plan = calcularHomogeneo({
      material: mat("m-caja-grande"),
      equipo: equipoPorCodigo("20DV"),
      cantidad: 150,
      modoCarga: "suelta",
    });
    expect(plan.kpis.equiposUsados).toBe(2);
    expect(plan.kpis.unidadesCargadas).toBe(150);
    expect(plan.noCargados).toEqual([]);
  });
  it("respeta el máximo de 10 equipos", () => {
    const plan = calcularHomogeneo({
      material: mat("m-ibc"),
      equipo: equipoPorCodigo("20DV"),
      cantidad: 500,
      modoCarga: "suelta",
    });
    expect(plan.kpis.equiposUsados).toBe(10);
    expect(plan.noCargados[0].motivo).toBe("limite_equipos");
  });
});

describe("Validador detecta violaciones", () => {
  const base = () =>
    calcularHomogeneo({
      material: mat("m-ibc"),
      equipo: equipoPorCodigo("20DV"),
      cantidad: 2,
      modoCarga: "suelta",
    });
  it("caja encima de material no apilable", () => {
    const plan: PlanCarga = base();
    const [a, b] = plan.colocaciones;
    b.x = a.x;
    b.y = a.y;
    b.z = a.h;
    const tipos = validarPlan(plan).map((v) => v.tipo);
    expect(tipos).toContain("no_apilable");
  });
  it("colisión y soporte", () => {
    const plan: PlanCarga = base();
    plan.colocaciones[1].x = plan.colocaciones[0].x + 100;
    plan.colocaciones[1].y = plan.colocaciones[0].y;
    expect(validarPlan(plan).map((v) => v.tipo)).toContain("colision");
  });
});

describe("Secuencia de carga", () => {
  it("nunca pone un bulto antes de su soporte y avanza del fondo a la puerta", () => {
    const plan = calcularHomogeneo({
      material: mat("m-caja-mediana"),
      equipo: equipoPorCodigo("40HC"),
      cantidad: null,
      modoCarga: "suelta",
    });
    const pasoDe = new Map<string, number>();
    for (const c of plan.colocaciones)
      pasoDe.set(`${c.x},${c.y},${c.z}`, c.paso);
    for (const c of plan.colocaciones) {
      if (c.z === 0) continue;
      for (const d of plan.colocaciones)
        if (
          d.z + d.h === c.z &&
          d.x < c.x + c.l &&
          c.x < d.x + d.l &&
          d.y < c.y + c.a &&
          c.y < d.y + d.a
        )
          expect(d.paso).toBeLessThanOrEqual(c.paso);
    }
    expect(plan.colocaciones[0].x).toBe(0);
  });
});
