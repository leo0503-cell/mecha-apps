/** Peso cobrable (regla 14 y sección 5.7). */
import { FACTORES_COBRO } from "./catalogo";

export interface BultoCobro {
  l: number; // mm
  a: number;
  h: number;
  peso: number; // kg por pieza
  cantidad: number;
}

/** Redondea hacia arriba al múltiplo `paso`, tolerando ruido de punto flotante. */
export function redondearArriba(v: number, paso: number): number {
  return Math.ceil(v / paso - 1e-9) * paso;
}

function fijo(v: number, dec: number) {
  return Number(v.toFixed(dec));
}

export interface ResultadoAereo {
  pesoRealKg: number;
  pesoVolumetricoKg: number;
  pesoCobrableKg: number;
  cobraPor: "real" | "volumetrico";
  divisor: number;
}

/** Aéreo/express: max(real, Σ(L×A×H cm)/divisor), redondeado al siguiente 0.5 kg. */
export function pesoCobrableAereo(
  bultos: BultoCobro[],
  divisor: number = FACTORES_COBRO.aereoDivisor,
): ResultadoAereo {
  let real = 0;
  let cm3 = 0;
  for (const b of bultos) {
    real += b.peso * b.cantidad;
    cm3 += (b.l / 10) * (b.a / 10) * (b.h / 10) * b.cantidad;
  }
  const vol = cm3 / divisor;
  const realR = fijo(redondearArriba(real, 0.5), 1);
  const volR = fijo(redondearArriba(vol, 0.5), 1);
  return {
    pesoRealKg: fijo(real, 3),
    pesoVolumetricoKg: volR,
    pesoCobrableKg: Math.max(realR, volR),
    cobraPor: volR > realR ? "volumetrico" : "real",
    divisor,
  };
}

export interface ResultadoLcl {
  m3: number;
  toneladas: number;
  rt: number;
  cobraPor: "volumen" | "peso" | "minimo";
}

/** Marítimo LCL W/M: R/T = max(m³, t), mínimo 1, redondeo a 0.1 hacia arriba. */
export function revenueTon(
  m3: number,
  kg: number,
  minimo = 1,
  kgPorM3: number = FACTORES_COBRO.lclKgPorM3,
): ResultadoLcl {
  const t = kg / kgPorM3;
  const base = Math.max(m3, t);
  const rt = fijo(Math.max(minimo, redondearArriba(base, 0.1)), 1);
  const cobraPor = base < minimo ? "minimo" : m3 >= t ? "volumen" : "peso";
  return { m3: fijo(m3, 4), toneladas: fijo(t, 4), rt, cobraPor };
}

export function cbm(bultos: BultoCobro[]): number {
  return bultos.reduce((s, b) => s + (b.l * b.a * b.h * b.cantidad) / 1e9, 0);
}
