/**
 * Empaque 2D de rectángulos idénticos (con sus rotaciones permitidas) en un
 * rectángulo L×W. Partición guillotina recursiva exacta sobre puntos de
 * trama (raster points) + patrón de 5 bloques tipo "pinwheel" (no guillotina).
 */

export interface Huella {
  l: number;
  a: number;
}

export interface Rect2D {
  x: number;
  y: number;
  l: number;
  a: number;
  /** Índice de la huella usada. */
  k: number;
}

export interface Patron2D {
  cuenta: number;
  rects: Rect2D[];
  tipo: "rejilla" | "guillotina" | "pinwheel" | "vacio";
}

const PRESUPUESTO_DP = 3e7;
const PRESUPUESTO_PINWHEEL = 4e6;

/** Puntos alcanzables como combinación entera de las medidas, ≤ cap. */
function puntosTrama(medidas: number[], cap: number): number[] {
  const alc = new Uint8Array(cap + 1);
  alc[0] = 1;
  const uniq = [...new Set(medidas)].filter((m) => m > 0 && m <= cap);
  for (let v = 0; v <= cap; v++) {
    if (!alc[v]) continue;
    for (const m of uniq) if (v + m <= cap) alc[v + m] = 1;
  }
  const res: number[] = [];
  for (let v = 0; v <= cap; v++) if (alc[v]) res.push(v);
  return res;
}

/** Índice del mayor punto de trama ≤ v, para cada v en 0..cap. */
function indicePiso(puntos: number[], cap: number): Int32Array {
  const idx = new Int32Array(cap + 1);
  let j = 0;
  for (let v = 0; v <= cap; v++) {
    while (j + 1 < puntos.length && puntos[j + 1] <= v) j++;
    idx[v] = j;
  }
  return idx;
}

function rejilla(x: number, y: number, h: Huella): number {
  return Math.floor(x / h.l) * Math.floor(y / h.a);
}

function llenarRejilla(
  ox: number,
  oy: number,
  x: number,
  y: number,
  h: Huella,
  k: number,
  out: Rect2D[],
) {
  const nx = Math.floor(x / h.l);
  const ny = Math.floor(y / h.a);
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < ny; j++)
      out.push({ x: ox + i * h.l, y: oy + j * h.a, l: h.l, a: h.a, k });
}

export function empacar2D(L: number, W: number, huellas: Huella[]): Patron2D {
  const hs = huellas.filter((h) => h.l <= L && h.a <= W);
  if (hs.length === 0) return { cuenta: 0, rects: [], tipo: "vacio" };

  // Una sola huella (o cuadrada): rejilla directa.
  let mejorRejilla = 0;
  let kRejilla = 0;
  hs.forEach((h, k) => {
    const c = rejilla(L, W, h);
    if (c > mejorRejilla) {
      mejorRejilla = c;
      kRejilla = k;
    }
  });
  const indicesHuella = huellas.map((h) => hs.indexOf(h));
  const kOriginal = (k: number) => indicesHuella.indexOf(k);
  if (hs.length === 1) {
    const rects: Rect2D[] = [];
    llenarRejilla(0, 0, L, W, hs[0], kOriginal(0), rects);
    return { cuenta: rects.length, rects, tipo: "rejilla" };
  }

  const PX = puntosTrama(
    hs.map((h) => h.l),
    L,
  );
  const PY = puntosTrama(
    hs.map((h) => h.a),
    W,
  );
  const nX = PX.length;
  const nY = PY.length;
  const pisoX = indicePiso(PX, L);
  const pisoY = indicePiso(PY, W);

  const costo = (nX * nY * (nX + nY)) / 2;
  if (costo > PRESUPUESTO_DP)
    return dosBloques(L, W, hs, kOriginal, mejorRejilla, kRejilla);

  const N = nX * nY;
  const mejor = new Int32Array(N);
  // tipo: 0..k-1 rejilla con huella k; -1 corte vertical (en X); -2 corte horizontal (en Y)
  const tipo = new Int16Array(N);
  const corte = new Int32Array(N);

  for (let ix = 0; ix < nX; ix++) {
    const x = PX[ix];
    for (let iy = 0; iy < nY; iy++) {
      const y = PY[iy];
      const id = ix * nY + iy;
      let b = 0;
      let t = 0;
      let c = 0;
      for (let k = 0; k < hs.length; k++) {
        const v = rejilla(x, y, hs[k]);
        if (v > b) {
          b = v;
          t = k;
        }
      }
      // Cortes verticales: x' en trama, x' ≤ x/2
      for (let jx = 1; jx < ix && PX[jx] * 2 <= x; jx++) {
        const v = mejor[jx * nY + iy] + mejor[pisoX[x - PX[jx]] * nY + iy];
        if (v > b) {
          b = v;
          t = -1;
          c = jx;
        }
      }
      for (let jy = 1; jy < iy && PY[jy] * 2 <= y; jy++) {
        const v = mejor[ix * nY + jy] + mejor[ix * nY + pisoY[y - PY[jy]]];
        if (v > b) {
          b = v;
          t = -2;
          c = jy;
        }
      }
      mejor[id] = b;
      tipo[id] = t;
      corte[id] = c;
    }
  }

  const construir = (
    ix: number,
    iy: number,
    ox: number,
    oy: number,
    out: Rect2D[],
  ) => {
    const id = ix * nY + iy;
    if (mejor[id] === 0) return;
    const t = tipo[id];
    const x = PX[ix];
    const y = PY[iy];
    if (t >= 0) {
      llenarRejilla(ox, oy, x, y, hs[t], kOriginal(t), out);
    } else if (t === -1) {
      const x1 = PX[corte[id]];
      construir(corte[id], iy, ox, oy, out);
      construir(pisoX[x - x1], iy, ox + x1, oy, out);
    } else {
      const y1 = PY[corte[id]];
      construir(ix, corte[id], ox, oy, out);
      construir(ix, pisoY[y - y1], ox, oy + y1, out);
    }
  };

  const ixL = nX - 1;
  const iyW = nY - 1;
  const guillotina = mejor[ixL * nY + iyW];

  // Pinwheel de 5 bloques (x1 < x2, y1 < y2):
  // B1 [0,x2]×[0,y1], B2 [x2,L]×[0,y2], B3 [x1,L]×[y2,W], B4 [0,x1]×[y1,W], centro [x1,x2]×[y1,y2].
  let pw = { v: -1, x1: 0, x2: 0, y1: 0, y2: 0 };
  if ((nX * nX * nY * nY) / 4 <= PRESUPUESTO_PINWHEEL) {
    const m = (x: number, y: number) => mejor[pisoX[x] * nY + pisoY[y]];
    for (let a = 1; a < nX; a++) {
      const x1 = PX[a];
      for (let b2 = a + 1; b2 < nX; b2++) {
        const x2 = PX[b2];
        for (let c = 1; c < nY; c++) {
          const y1 = PY[c];
          for (let d = c + 1; d < nY; d++) {
            const y2 = PY[d];
            const v =
              m(x2, y1) +
              m(L - x2, y2) +
              m(L - x1, W - y2) +
              m(x1, W - y1) +
              m(x2 - x1, y2 - y1);
            if (v > pw.v) pw = { v, x1, x2, y1, y2 };
          }
        }
      }
    }
  }

  const rects: Rect2D[] = [];
  if (pw.v > guillotina) {
    const { x1, x2, y1, y2 } = pw;
    const blq = (ox: number, oy: number, x: number, y: number) =>
      construir(pisoX[x], pisoY[y], ox, oy, rects);
    blq(0, 0, x2, y1);
    blq(x2, 0, L - x2, y2);
    blq(x1, y2, L - x1, W - y2);
    blq(0, y1, x1, W - y1);
    blq(x1, y1, x2 - x1, y2 - y1);
    return { cuenta: rects.length, rects, tipo: "pinwheel" };
  }
  construir(ixL, iyW, 0, 0, rects);
  return {
    cuenta: rects.length,
    rects,
    tipo: tipo[ixL * nY + iyW] >= 0 ? "rejilla" : "guillotina",
  };
}

/** Respaldo para bultos diminutos: mejor de rejilla simple o dos bloques. */
function dosBloques(
  L: number,
  W: number,
  hs: Huella[],
  kOriginal: (k: number) => number,
  mejorRejilla: number,
  kRejilla: number,
): Patron2D {
  let best = {
    v: mejorRejilla,
    eje: "n" as "n" | "x" | "y",
    corte: 0,
    k1: kRejilla,
    k2: kRejilla,
  };
  for (let k1 = 0; k1 < hs.length; k1++)
    for (let k2 = 0; k2 < hs.length; k2++) {
      if (k1 === k2) continue;
      const h1 = hs[k1];
      for (let n = 1; n * h1.l <= L; n++) {
        const x = n * h1.l;
        const v = rejilla(x, W, h1) + rejilla(L - x, W, hs[k2]);
        if (v > best.v) best = { v, eje: "x", corte: x, k1, k2 };
      }
      for (let n = 1; n * h1.a <= W; n++) {
        const y = n * h1.a;
        const v = rejilla(L, y, h1) + rejilla(L, W - y, hs[k2]);
        if (v > best.v) best = { v, eje: "y", corte: y, k1, k2 };
      }
    }
  const rects: Rect2D[] = [];
  if (best.eje === "n")
    llenarRejilla(0, 0, L, W, hs[best.k1], kOriginal(best.k1), rects);
  else if (best.eje === "x") {
    llenarRejilla(0, 0, best.corte, W, hs[best.k1], kOriginal(best.k1), rects);
    llenarRejilla(
      best.corte,
      0,
      L - best.corte,
      W,
      hs[best.k2],
      kOriginal(best.k2),
      rects,
    );
  } else {
    llenarRejilla(0, 0, L, best.corte, hs[best.k1], kOriginal(best.k1), rects);
    llenarRejilla(
      0,
      best.corte,
      L,
      W - best.corte,
      hs[best.k2],
      kOriginal(best.k2),
      rects,
    );
  }
  return {
    cuenta: rects.length,
    rects,
    tipo: best.eje === "n" ? "rejilla" : "guillotina",
  };
}

/** Solo la cuenta (sin generar rectángulos) cuando el patrón sería enorme. */
export function cuentaRejillaSimple(
  L: number,
  W: number,
  huellas: Huella[],
): number {
  return Math.max(0, ...huellas.map((h) => rejilla(L, W, h)));
}
