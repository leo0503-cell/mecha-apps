/**
 * Modo A, homogéneo: ¿cuántos caben de un solo material en un espacio?
 * 1) Para cada altura posible (según orientaciones) resuelve el piso en 2D.
 * 2) Combina capas de distintas alturas hasta la altura útil (rellena la franja
 *    superior con otra orientación), respetando capas máximas, BCT y peso.
 * 3) Verifica soporte real entre capas de patrón distinto y se queda con el mejor.
 */
import { capasMaxMaterial, capasPorBct } from "./apilado";
import { empacar2D, type Huella, type Rect2D } from "./empaque2d";
import { fraccionSoporte } from "./geometria";
import { orientacionesUnicas } from "./orientaciones";
import type { CodigoOrientacion, FactorLimitante, Material } from "./tipos";

export interface EspacioA {
  L: number;
  W: number;
  H: number;
}

export interface LimitesA {
  /** Peso máximo de carga (kg). null = sin límite. */
  pesoMax: number | null;
  /** Unidades máximas a colocar. null = llenar al máximo. */
  maxUnidades: number | null;
  soporteMin: number;
  holgura?: number;
  /** Capas alternas espejeadas (amarre en tarima). */
  amarre?: boolean;
}

export interface CajaA {
  x: number;
  y: number;
  z: number;
  l: number;
  a: number;
  h: number;
  o: CodigoOrientacion;
  capa: number;
}

export interface ResultadoA {
  cajas: CajaA[];
  cuenta: number;
  /** Cuenta geométrica sin límite de peso ni cantidad. */
  cuentaGeometrica: number;
  unidadesPorCapa: number;
  capas: number;
  alturaUsada: number;
  limitante: FactorLimitante;
  /** true si el patrón era tan grande que no se generaron colocaciones. */
  sinColocaciones: boolean;
}

interface Grupo {
  h: number;
  huellas: (Huella & { o: CodigoOrientacion })[];
  rects: Rect2D[];
  cuenta: number;
  area: number;
  capasBct: number;
}

const MAX_RECTS_CAPA = 150_000;
const MAX_COMBOS = 200_000;

const VACIO: ResultadoA = {
  cajas: [],
  cuenta: 0,
  cuentaGeometrica: 0,
  unidadesPorCapa: 0,
  capas: 0,
  alturaUsada: 0,
  limitante: "volumen",
  sinColocaciones: false,
};

export function llenarHomogeneo(
  esp: EspacioA,
  m: Material,
  orientaciones: CodigoOrientacion[],
  lim: LimitesA,
): ResultadoA {
  const g = lim.holgura ?? 0;
  const ors = orientacionesUnicas(
    orientaciones,
    m.largo,
    m.ancho,
    m.alto,
  ).filter(({ d }) => d.l <= esp.L && d.a <= esp.W && d.h <= esp.H);
  if (ors.length === 0) return { ...VACIO };

  const capPeso =
    lim.pesoMax != null ? Math.floor(lim.pesoMax / m.peso + 1e-9) : Infinity;
  const capCant = lim.maxUnidades ?? Infinity;
  const cap = Math.min(capPeso, capCant);
  const capasMat = capasMaxMaterial(m);

  // Agrupar por altura.
  const porAltura = new Map<number, Grupo>();
  for (const { o, d } of ors) {
    let gr = porAltura.get(d.h);
    if (!gr) {
      gr = {
        h: d.h,
        huellas: [],
        rects: [],
        cuenta: 0,
        area: 0,
        capasBct: Infinity,
      };
      porAltura.set(d.h, gr);
    }
    if (!gr.huellas.some((x) => x.l === d.l && x.a === d.a))
      gr.huellas.push({ l: d.l, a: d.a, o });
    gr.capasBct = Math.min(gr.capasBct, capasPorBct(m, d.l, d.a));
  }

  let sinColocaciones = false;
  const grupos: Grupo[] = [];
  for (const gr of porAltura.values()) {
    const estim = Math.max(
      ...gr.huellas.map((h) => (esp.L * esp.W) / (h.l * h.a)),
    );
    if (estim > MAX_RECTS_CAPA) {
      // Bultos diminutos: solo cuenta por rejilla, sin dibujar.
      gr.cuenta = Math.max(
        ...gr.huellas.map(
          (h) => Math.floor(esp.L / (h.l + g)) * Math.floor(esp.W / (h.a + g)),
        ),
      );
      sinColocaciones = true;
    } else {
      const p = empacar2D(
        esp.L + g,
        esp.W + g,
        gr.huellas.map((h) => ({ l: h.l + g, a: h.a + g })),
      );
      // Centrar el patrón a lo ancho: el COG lateral queda al centro del piso.
      const usadoY = p.rects.reduce((m, r) => Math.max(m, r.y + r.a - g), 0);
      const dy = Math.floor((esp.W - usadoY) / 2);
      gr.rects = p.rects.map((r) => ({
        ...r,
        y: r.y + dy,
        l: r.l - g,
        a: r.a - g,
      }));
      gr.cuenta = p.cuenta;
    }
    gr.area = gr.huellas.length
      ? gr.cuenta * gr.huellas[0].l * gr.huellas[0].a
      : 0;
    if (gr.cuenta > 0) grupos.push(gr);
  }
  if (grupos.length === 0) return { ...VACIO };
  // Mayor cobertura abajo: así las capas de arriba quedan apoyadas.
  grupos.sort((a, b) => b.area - a.area || b.h - a.h);

  // Enumerar combinaciones de capas por altura.
  type Combo = { n: number[]; cota: number; capas: number; altura: number };
  const combos: Combo[] = [];
  const n = new Array(grupos.length).fill(0);
  const enumerar = (
    i: number,
    altura: number,
    capas: number,
    cota: number,
    capasLim: number,
  ) => {
    if (combos.length >= MAX_COMBOS) return;
    if (i === grupos.length) {
      if (capas > 0) combos.push({ n: [...n], cota, capas, altura });
      return;
    }
    const gr = grupos[i];
    const maxN = Math.floor((esp.H - altura) / gr.h);
    for (let k = maxN; k >= 0; k--) {
      const lim2 = k > 0 ? Math.min(capasLim, gr.capasBct) : capasLim;
      if (capas + k > lim2) continue;
      n[i] = k;
      enumerar(i + 1, altura + k * gr.h, capas + k, cota + k * gr.cuenta, lim2);
    }
    n[i] = 0;
  };
  enumerar(0, 0, 0, 0, capasMat);
  combos.sort(
    (a, b) =>
      Math.min(b.cota, cap) - Math.min(a.cota, cap) ||
      a.capas - b.capas ||
      a.altura - b.altura,
  );

  let mejor: {
    capasRects: { rects: Rect2D[]; h: number }[];
    cuenta: number;
    combo: Combo;
  } | null = null;
  for (const c of combos) {
    const cotaEf = Math.min(c.cota, cap);
    if (mejor && cotaEf <= Math.min(mejor.cuenta, cap)) break;
    const r = evaluar(c.n);
    if (!mejor || Math.min(r.cuenta, cap) > Math.min(mejor.cuenta, cap))
      mejor = { ...r, combo: c };
  }

  function evaluar(nCombo: number[]) {
    const capasRects: { rects: Rect2D[]; h: number }[] = [];
    let base: Rect2D[] | null = null;
    let cuenta = 0;
    for (let i = 0; i < grupos.length; i++) {
      for (let k = 0; k < nCombo[i]; k++) {
        let rects = grupos[i].rects;
        if (lim.amarre && capasRects.length % 2 === 1) rects = espejar(rects);
        if (base) {
          const b = base;
          rects = rects.filter(
            (r) => fraccionSoporte(r, b) >= lim.soporteMin - 1e-9,
          );
        }
        if (sinColocaciones && rects.length === 0) {
          cuenta += grupos[i].cuenta;
          capasRects.push({ rects: [], h: grupos[i].h });
          continue;
        }
        if (rects.length === 0) break;
        capasRects.push({ rects, h: grupos[i].h });
        cuenta += rects.length;
        base = rects;
      }
    }
    return { capasRects, cuenta };
  }

  if (!mejor) return { ...VACIO };
  const cuentaGeo = mejor.cuenta;
  const total = Math.min(cuentaGeo, cap);

  // Generar cajas de abajo hacia arriba; la capa parcial se llena del fondo a la puerta.
  const cajas: CajaA[] = [];
  let z = 0;
  let alturaUsada = 0;
  let restantes = total;
  mejor.capasRects.forEach((capa, ci) => {
    if (restantes <= 0) return;
    // Del centro hacia los extremos: si la capa queda parcial, el COG no se va al fondo.
    const cx = esp.L / 2;
    const cy = esp.W / 2;
    const dist = (r: Rect2D) =>
      Math.abs(r.x + r.l / 2 - cx) + Math.abs(r.y + r.a / 2 - cy) * 0.01;
    const orden = [...capa.rects].sort(
      (p, q) => dist(p) - dist(q) || p.x - q.x || p.y - q.y,
    );
    const tomar = orden.slice(0, Math.min(restantes, orden.length));
    for (const r of tomar) {
      const gr = grupos.find((x) => x.h === capa.h)!;
      const hu =
        gr.huellas.find((x) => x.l === r.l && x.a === r.a) ?? gr.huellas[0];
      cajas.push({
        x: r.x,
        y: r.y,
        z,
        l: r.l,
        a: r.a,
        h: capa.h,
        o: hu.o,
        capa: ci + 1,
      });
    }
    restantes -= sinColocaciones
      ? Math.min(restantes, grupos.find((x) => x.h === capa.h)!.cuenta)
      : tomar.length;
    z += capa.h;
    alturaUsada = z;
  });

  // Si se llegó al tope de peso o de cantidad, ése es el límite (aunque el combo elegido
  // tenga justo esa cuenta geométrica: con menos capas se eligió a propósito).
  let limitante: FactorLimitante = "volumen";
  if (total === capPeso && capPeso <= capCant) limitante = "peso";
  else if (total === capCant) limitante = "ninguno";
  else {
    const hMin = Math.min(...grupos.map((x) => x.h));
    const limCapas = Math.min(capasMat, ...grupos.map((x) => x.capasBct));
    if (mejor.combo.capas >= limCapas && esp.H - mejor.combo.altura >= hMin)
      limitante = "apilado";
  }

  return {
    cajas: sinColocaciones ? [] : cajas,
    cuenta: total,
    cuentaGeometrica: cuentaGeo,
    unidadesPorCapa: mejor.capasRects[0]?.rects.length || grupos[0].cuenta,
    capas: mejor.capasRects.length,
    alturaUsada,
    limitante,
    sinColocaciones,
  };
}

function espejar(rects: Rect2D[]): Rect2D[] {
  const maxX = Math.max(...rects.map((r) => r.x + r.l));
  return rects.map((r) => ({ ...r, x: maxX - r.x - r.l }));
}
