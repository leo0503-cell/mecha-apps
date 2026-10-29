/** Criterios de aceptación de la sección 15 (1 a 6) como pruebas. */
import { describe, expect, it } from "vitest";
import {
  calcularHomogeneo,
  compararEscenarios,
  equipoPorCodigo,
  orientacionesDePreset,
  pesoCobrableAereo,
  revenueTon,
  textoLimitante,
  validarPlan,
  type Material,
} from "..";

function caja(
  l: number,
  a: number,
  h: number,
  peso: number,
  preset: "libre" | "este_lado_arriba" = "libre",
  extra: Partial<Material> = {},
): Material {
  return {
    id: "m",
    nombre: "Prueba",
    largo: l,
    ancho: a,
    alto: h,
    peso,
    orientaciones: orientacionesDePreset(preset, l, a, h),
    apilable: true,
    ...extra,
  };
}

const t0 = () => performance.now();

describe("Criterio 1: caja 600×400×400, 15 kg, libre, 40' HC", () => {
  const ini = t0();
  const plan = calcularHomogeneo({
    material: caja(600, 400, 400, 15),
    equipo: equipoPorCodigo("40HC"),
    cantidad: null,
    modoCarga: "suelta",
  });
  const ms = t0() - ini;

  it("carga ≥ 660 cajas con ≥ 82% de volumen", () => {
    expect(plan.kpis.unidadesCargadas).toBeGreaterThanOrEqual(660);
    expect(plan.kpis.pctVolumen).toBeGreaterThanOrEqual(0.82);
  });
  it("usa orientaciones mixtas", () => {
    expect(
      new Set(plan.colocaciones.map((c) => c.orientacion)).size,
    ).toBeGreaterThan(1);
  });
  it("indica limitado por volumen", () => {
    expect(plan.kpis.factorLimitante).toBe("volumen");
    expect(textoLimitante(plan.kpis)).toMatch(/^Limitado por volumen/);
  });
  it("el plan pasa el validador sin violaciones", () => {
    expect(validarPlan(plan)).toEqual([]);
  });
  it("Modo A en < 500 ms", () => {
    expect(ms).toBeLessThan(500);
  });
});

describe("Criterio 2: misma caja de 45 kg", () => {
  const plan = calcularHomogeneo({
    material: caja(600, 400, 400, 45),
    equipo: equipoPorCodigo("40HC"),
    cantidad: null,
    modoCarga: "suelta",
  });
  it("carga exactamente 588 cajas (26,500 / 45)", () => {
    expect(plan.kpis.unidadesCargadas).toBe(588);
  });
  it("muestra limitado por peso", () => {
    expect(plan.kpis.factorLimitante).toBe("peso");
    expect(textoLimitante(plan.kpis)).toMatch(/^Limitado por peso: 100% peso/);
  });
  it("no supera la carga útil y es válido", () => {
    expect(plan.kpis.pesoRealKg).toBeLessThanOrEqual(26500);
    expect(validarPlan(plan)).toEqual([]);
  });
});

describe("Criterio 2b: misma caja de 45 kg en 45' HC", () => {
  it("570 cajas (25,680 / 45), limitado por peso", () => {
    const plan = calcularHomogeneo({
      material: caja(600, 400, 400, 45),
      equipo: equipoPorCodigo("45HC"),
      cantidad: null,
      modoCarga: "suelta",
    });
    expect(plan.kpis.unidadesCargadas).toBe(570);
    expect(plan.kpis.factorLimitante).toBe("peso");
  });
});

describe("Criterio 3: tarima EUR 1,200×800 en 20' DV, una cama", () => {
  it("caben 11 tarimas", () => {
    const eur = caja(1200, 800, 144, 25, "este_lado_arriba", {
      apilable: false,
    });
    const plan = calcularHomogeneo({
      material: eur,
      equipo: equipoPorCodigo("20DV"),
      cantidad: null,
      modoCarga: "suelta",
    });
    expect(plan.kpis.unidadesCargadas).toBe(11);
    expect(validarPlan(plan)).toEqual([]);
  });
});

describe("Criterio 4: tarima GMA 1,219×1,016 en caja seca 53'", () => {
  const gma = caja(1219, 1016, 150, 20, "este_lado_arriba", {
    apilable: false,
  });
  const equipo = equipoPorCodigo("CS53");
  it("sin girar salen 26", () => {
    const plan = calcularHomogeneo({
      material: { ...gma, orientaciones: ["LAH"] },
      equipo,
      cantidad: null,
      modoCarga: "suelta",
    });
    expect(plan.kpis.unidadesCargadas).toBe(26);
  });
  it("con rotación salen 30", () => {
    const plan = calcularHomogeneo({
      material: gma,
      equipo,
      cantidad: null,
      modoCarga: "suelta",
    });
    expect(plan.kpis.unidadesCargadas).toBe(30);
  });
  it("la comparación muestra ambas y recomienda 30", () => {
    const { resultados, recomendado } = compararEscenarios([
      {
        nombre: "Sin girar",
        entrada: {
          material: { ...gma, orientaciones: ["LAH"] },
          equipo,
          cantidad: null,
          modoCarga: "suelta",
        },
      },
      {
        nombre: "Con rotación",
        entrada: { material: gma, equipo, cantidad: null, modoCarga: "suelta" },
      },
    ]);
    expect(resultados.map((r) => r.unidades)).toEqual([26, 30]);
    expect(recomendado).toBe("Con rotación");
  });
});

describe("Criterio 5: peso cobrable aéreo y LCL", () => {
  it("aéreo: 3 cajas 50×40×30 cm, 8 kg → real 24, volumétrico 30.0, cobrable 30.0", () => {
    const r = pesoCobrableAereo([
      { l: 500, a: 400, h: 300, peso: 8, cantidad: 3 },
    ]);
    expect(r.pesoRealKg).toBe(24);
    expect(r.pesoVolumetricoKg).toBe(30);
    expect(r.pesoCobrableKg).toBe(30);
    expect(r.cobraPor).toBe("volumetrico");
  });
  it("LCL 4.2 m³ y 1,800 kg → 4.2 R/T", () => {
    expect(revenueTon(4.2, 1800).rt).toBe(4.2);
  });
  it("LCL 0.6 m³ y 300 kg → mínimo 1 R/T", () => {
    const r = revenueTon(0.6, 300);
    expect(r.rt).toBe(1);
    expect(r.cobraPor).toBe("minimo");
  });
});

describe("Criterio 6: pieza 1,000×800×2,600 en 40' HC (puerta 2,585)", () => {
  it("este lado arriba: no cargada, no pasa por la puerta", () => {
    const plan = calcularHomogeneo({
      material: caja(1000, 800, 2600, 300, "este_lado_arriba"),
      equipo: equipoPorCodigo("40HC"),
      cantidad: 1,
      modoCarga: "suelta",
    });
    expect(plan.kpis.unidadesCargadas).toBe(0);
    expect(plan.noCargados).toEqual([
      { materialId: "m", cantidad: 1, motivo: "puerta" },
    ]);
  });
  it("orientación libre: sí se carga acostada", () => {
    const plan = calcularHomogeneo({
      material: caja(1000, 800, 2600, 300),
      equipo: equipoPorCodigo("40HC"),
      cantidad: 1,
      modoCarga: "suelta",
    });
    expect(plan.kpis.unidadesCargadas).toBe(1);
    expect(plan.colocaciones[0].h).toBeLessThan(2600);
    expect(validarPlan(plan)).toEqual([]);
  });
});
