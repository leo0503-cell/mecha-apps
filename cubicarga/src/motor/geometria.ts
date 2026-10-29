/** Utilidades geométricas: traslapes y un índice espacial simple en el piso. */

export interface Caja3D {
  x: number;
  y: number;
  z: number;
  l: number;
  a: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  l: number;
  a: number;
}

export function traslape1D(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

export function areaTraslape(p: Rect, q: Rect): number {
  return (
    traslape1D(p.x, p.x + p.l, q.x, q.x + q.l) *
    traslape1D(p.y, p.y + p.a, q.y, q.y + q.a)
  );
}

export function volumenTraslape(p: Caja3D, q: Caja3D): number {
  return areaTraslape(p, q) * traslape1D(p.z, p.z + p.h, q.z, q.z + q.h);
}

/** Área de unión, recortada a la huella: no cuenta apoyos superpuestos dos veces. */
export function areaUnionSoporte(r: Rect, base: Rect[]): number {
  const rs = base
    .map((b) => ({
      x: Math.max(r.x, b.x),
      y: Math.max(r.y, b.y),
      x1: Math.min(r.x + r.l, b.x + b.l),
      y1: Math.min(r.y + r.a, b.y + b.a),
    }))
    .filter((b) => b.x1 > b.x && b.y1 > b.y);
  const xs = [...new Set(rs.flatMap((b) => [b.x, b.x1]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const ys = rs
      .filter((b) => b.x < xs[i] && b.x1 > xs[i - 1])
      .map((b) => [b.y, b.y1])
      .sort((a, b) => a[0] - b[0]);
    let cubierto = 0,
      fin = -Infinity;
    for (const [y, y1] of ys) {
      cubierto += Math.max(0, y1 - Math.max(y, fin));
      fin = Math.max(fin, y1);
    }
    area += (xs[i] - xs[i - 1]) * cubierto;
  }
  return area;
}
export function fraccionSoporte(r: Rect, base: Rect[]): number {
  return areaUnionSoporte(r, base) / (r.l * r.a);
}

/** Índice de cuadrícula en XY para buscar vecinos sin O(n²). */
export class IndiceXY<T extends Rect> {
  private celdas = new Map<number, T[]>();
  constructor(private tam = 500) {}

  private claves(r: Rect): number[] {
    const res: number[] = [];
    const x0 = Math.floor(r.x / this.tam);
    const x1 = Math.floor((r.x + r.l - 1) / this.tam);
    const y0 = Math.floor(r.y / this.tam);
    const y1 = Math.floor((r.y + r.a - 1) / this.tam);
    for (let i = x0; i <= x1; i++)
      for (let j = y0; j <= y1; j++) res.push(i * 100003 + j);
    return res;
  }

  agregar(r: T) {
    for (const k of this.claves(r)) {
      const l = this.celdas.get(k);
      if (l) l.push(r);
      else this.celdas.set(k, [r]);
    }
  }

  /** Candidatos cuya huella puede traslapar con `r` (sin duplicados). */
  vecinos(r: Rect): T[] {
    const vistos = new Set<T>();
    for (const k of this.claves(r))
      for (const o of this.celdas.get(k) ?? []) vistos.add(o);
    return [...vistos];
  }
}
