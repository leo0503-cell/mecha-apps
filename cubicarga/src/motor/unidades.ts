/** Conversión de unidades. Internas: mm enteros y kg con 3 decimales. */

export type UnidadLongitud = "mm" | "cm" | "m" | "in" | "ft";
export type UnidadPeso = "kg" | "lb";

export const MM_POR: Record<UnidadLongitud, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

export const KG_POR_LB = 0.45359237;

export function aMm(valor: number, unidad: UnidadLongitud): number {
  return Math.round(valor * MM_POR[unidad]);
}

export function desdeMm(mm: number, unidad: UnidadLongitud): number {
  return mm / MM_POR[unidad];
}

export function aKg(valor: number, unidad: UnidadPeso): number {
  const kg = unidad === "kg" ? valor : valor * KG_POR_LB;
  return redondearKg(kg);
}

export function desdeKg(kg: number, unidad: UnidadPeso): number {
  return unidad === "kg" ? kg : kg / KG_POR_LB;
}

export function redondearKg(kg: number): number {
  return Math.round(kg * 1000) / 1000;
}

/** Volumen en m³ a partir de mm. */
export function m3(l: number, a: number, h: number): number {
  return (l * a * h) / 1e9;
}

export const RANGO_MEDIDA_MM = { min: 1, max: 20000 } as const;
export const RANGO_PESO_KG = { min: 0.01, max: 40000 } as const;
