import {
  desdeKg,
  desdeMm,
  type UnidadLongitud,
  type UnidadPeso,
} from "@/motor";

const nf = (dec: number) =>
  new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: dec,
    minimumFractionDigits: 0,
  });

export const num = (v: number, dec = 0) => nf(dec).format(v);
export const pct = (v: number, dec = 0) => `${nf(dec).format(v * 100)}%`;
export const largo = (mm: number, u: UnidadLongitud) =>
  `${nf(u === "mm" ? 0 : u === "m" || u === "ft" ? 3 : 1).format(desdeMm(mm, u))} ${u}`;
export const peso = (kg: number, u: UnidadPeso, dec = 1) =>
  `${nf(dec).format(desdeKg(kg, u))} ${u}`;
export const dims = (l: number, a: number, h: number, u: UnidadLongitud) =>
  `${[l, a, h].map((v) => nf(u === "mm" ? 0 : 2).format(desdeMm(v, u))).join(" × ")} ${u}`;
