/**
 * Secuencia de carga: del fondo a la puerta (X), de abajo hacia arriba (Z) y
 * luego por ancho (Y), sin poner nunca un bulto antes de los que lo sostienen.
 * Agrupa en pasos de 1 tarima o 1 fila de cajas.
 */
import { areaTraslape, IndiceXY } from "./geometria";
import type { Colocacion, TarimaArmada } from "./tipos";

interface Unidad {
  i: number;
  equipoIdx: number;
  x: number;
  y: number;
  z: number;
  l: number;
  a: number;
  h: number;
}

class Heap<T> {
  private d: T[] = [];
  constructor(private menor: (a: T, b: T) => boolean) {}
  get size() {
    return this.d.length;
  }
  push(v: T) {
    const d = this.d;
    d.push(v);
    let i = d.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.menor(d[i], d[p])) break;
      [d[i], d[p]] = [d[p], d[i]];
      i = p;
    }
  }
  pop(): T {
    const d = this.d;
    const top = d[0];
    const last = d.pop()!;
    if (d.length) {
      d[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < d.length && this.menor(d[l], d[m])) m = l;
        if (r < d.length && this.menor(d[r], d[m])) m = r;
        if (m === i) break;
        [d[i], d[m]] = [d[m], d[i]];
        i = m;
      }
    }
    return top;
  }
}

/** Devuelve el orden topológico (índices) de las unidades. */
export function ordenarCarga(us: Unidad[]): number[] {
  const indices = new Map<number, IndiceXY<Unidad>>();
  for (const u of us) {
    let ix = indices.get(u.equipoIdx);
    if (!ix) indices.set(u.equipoIdx, (ix = new IndiceXY<Unidad>()));
    ix.agregar(u);
  }
  const pendientes = new Array(us.length).fill(0);
  const sostiene: number[][] = us.map(() => []);
  for (const u of us) {
    if (u.z === 0) continue;
    for (const v of indices.get(u.equipoIdx)!.vecinos(u)) {
      if (v.z + v.h === u.z && areaTraslape(u, v) > 0) {
        pendientes[u.i]++;
        sostiene[v.i].push(u.i);
      }
    }
  }
  const menor = (p: Unidad, q: Unidad) =>
    p.equipoIdx !== q.equipoIdx
      ? p.equipoIdx < q.equipoIdx
      : p.x !== q.x
        ? p.x < q.x
        : p.z !== q.z
          ? p.z < q.z
          : p.y < q.y;
  const heap = new Heap<Unidad>(menor);
  for (const u of us) if (pendientes[u.i] === 0) heap.push(u);
  const orden: number[] = [];
  while (heap.size) {
    const u = heap.pop();
    orden.push(u.i);
    for (const j of sostiene[u.i]) if (--pendientes[j] === 0) heap.push(us[j]);
  }
  return orden;
}

/** Asigna `paso` a colocaciones y tarimas, y reordena las colocaciones por paso. */
export function asignarPasos(
  colocaciones: Colocacion[],
  tarimas: TarimaArmada[],
): Colocacion[] {
  // Tarimas: un paso por tarima.
  if (tarimas.length) {
    const orden = ordenarCarga(tarimas.map((t, i) => ({ ...t, i })));
    orden.forEach((ti, k) => (tarimas[ti].paso = k + 1));
  }
  const sueltas = colocaciones.filter((c) => c.tarimaIdx == null);
  const enTarima = colocaciones.filter((c) => c.tarimaIdx != null);
  for (const c of enTarima) c.paso = tarimas[c.tarimaIdx!].paso;

  let paso = tarimas.length;
  if (sueltas.length) {
    const orden = ordenarCarga(sueltas.map((c, i) => ({ ...c, i })));
    let prev: Colocacion | null = null;
    for (const k of orden) {
      const c = sueltas[k];
      if (
        !prev ||
        prev.equipoIdx !== c.equipoIdx ||
        prev.x !== c.x ||
        prev.z !== c.z
      )
        paso++;
      c.paso = paso;
      prev = c;
    }
  }
  return [...colocaciones].sort(
    (p, q) => p.paso - q.paso || p.z - q.z || p.y - q.y || p.x - q.x,
  );
}
