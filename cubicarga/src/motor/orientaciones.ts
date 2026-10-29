import type { CodigoOrientacion, Dims, PresetOrientacion } from "./tipos";
import { TODAS_ORIENTACIONES } from "./tipos";

/** Medidas (x, y, z) del bulto en una orientación. */
export function dimsEn(
  o: CodigoOrientacion,
  l: number,
  a: number,
  h: number,
): Dims {
  const v: Record<string, number> = { L: l, A: a, H: h };
  return { l: v[o[0]], a: v[o[1]], h: v[o[2]] };
}

/** Orientaciones de un preset. "plano" deja la cara mayor abajo (Z = la medida menor). */
export function orientacionesDePreset(
  preset: PresetOrientacion,
  l: number,
  a: number,
  h: number,
): CodigoOrientacion[] {
  if (preset === "libre") return [...TODAS_ORIENTACIONES];
  if (preset === "este_lado_arriba") return ["LAH", "ALH"];
  const min = Math.min(l, a, h);
  return TODAS_ORIENTACIONES.filter((o) => dimsEn(o, l, a, h).h === min).slice(
    0,
    2,
  );
}

/** Quita orientaciones que dan las mismas medidas (cajas con lados iguales). */
export function orientacionesUnicas(
  ors: CodigoOrientacion[],
  l: number,
  a: number,
  h: number,
): { o: CodigoOrientacion; d: Dims }[] {
  const vistos = new Set<string>();
  const res: { o: CodigoOrientacion; d: Dims }[] = [];
  for (const o of ors) {
    const d = dimsEn(o, l, a, h);
    const k = `${d.l}x${d.a}x${d.h}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    res.push({ o, d });
  }
  return res;
}

export const NOMBRE_ORIENTACION: Record<CodigoOrientacion, string> = {
  LAH: "Normal",
  ALH: "Girada 90° sobre el piso",
  LHA: "De costado (largo al fondo)",
  HLA: "De costado (alto al fondo)",
  AHL: "De pie sobre el lado corto",
  HAL: "De pie (largo vertical)",
};
