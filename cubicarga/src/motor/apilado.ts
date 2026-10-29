import type { Material } from "./tipos";

const LB_POR_KG = 1 / 0.45359237;
const MM_POR_IN = 25.4;

/** BCT (lbf) por McKee: 5.87 × ECT × √(calibre × perímetro), todo en pulgadas. */
export function bctLbf(
  ectLbIn: number,
  calibreIn: number,
  baseL: number,
  baseA: number,
): number {
  const perimetroIn = (2 * (baseL + baseA)) / MM_POR_IN;
  return 5.87 * ectLbIn * Math.sqrt(calibreIn * perimetroIn);
}

/** Capas máximas por BCT: floor(BCT / (fs × peso_lb)) + 1. */
export function capasPorBct(m: Material, baseL: number, baseA: number): number {
  if (!m.ectLbIn || !m.calibreIn) return Infinity;
  const fs = Math.min(5, Math.max(3, m.factorSeguridad ?? 4));
  const pesoLb = m.peso * LB_POR_KG;
  return (
    Math.floor(bctLbf(m.ectLbIn, m.calibreIn, baseL, baseA) / (fs * pesoLb)) + 1
  );
}

/** Máximo de capas (incluida la de abajo) por apilable, max_capas y peso encima. */
export function capasMaxMaterial(m: Material): number {
  if (!m.apilable) return 1;
  let c = Infinity;
  if (m.maxCapas != null && m.maxCapas > 0) c = Math.min(c, m.maxCapas);
  if (m.maxPesoEncima != null && m.maxPesoEncima >= 0)
    c = Math.min(c, Math.floor(m.maxPesoEncima / m.peso + 1e-9) + 1);
  return c;
}
