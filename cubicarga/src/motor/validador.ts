/**
 * Validador independiente: revisa un plan contra las reglas de la sección 7.
 * Se usa en tests, al editar a mano y antes de exportar.
 */
import { esquemaPlanEstructura } from "./esquemas";
import { dimsEn } from "./orientaciones";
import { capasMaxMaterial, capasPorBct } from "./apilado";
import {
  areaTraslape,
  areaUnionSoporte,
  IndiceXY,
  volumenTraslape,
} from "./geometria";
import type { Material, PlanCarga } from "./tipos";

export type TipoViolacion =
  | "lifo"
  | "datos_invalidos"
  | "orientacion"
  | "referencia"
  | "fuera_de_equipo"
  | "altura_util"
  | "colision"
  | "soporte"
  | "no_apilable"
  | "peso_encima"
  | "capas"
  | "fragil"
  | "carga_util"
  | "puerta"
  | "tarima_altura"
  | "tarima_peso"
  | "tarima_voladizo";

export interface Violacion {
  tipo: TipoViolacion;
  /** Índice de la colocación (o -1 si es del equipo/tarima). */
  colocacion: number;
  tarima?: number;
  equipoIdx: number;
  mensaje: string;
}

interface Solido {
  i: number;
  equipoIdx: number;
  x: number;
  y: number;
  z: number;
  l: number;
  a: number;
  h: number;
  peso: number;
  mat: Material | null; // null = cubierta de tarima
  col: number; // índice colocación o -1
  tar: number; // índice tarima o -1
}

const EPS = 1e-6;

export function validarPlan(plan: PlanCarga): Violacion[] {
  const v: Violacion[] = [];
  const estructura = esquemaPlanEstructura.safeParse(plan);
  if (!estructura.success)
    return estructura.error.issues.map((i) => ({
      tipo: "datos_invalidos",
      colocacion: -1,
      equipoIdx: -1,
      mensaje: `Datos de plan inválidos: ${i.path.join(".")}`,
    }));
  const mats = new Map(plan.materiales.map((m) => [m.id, m]));
  const tars = new Map(plan.tarimas.map((t) => [t.id, t]));
  const soporteMin = plan.parametros.soporteMin;
  if (mats.size !== plan.materiales.length || tars.size !== plan.tarimas.length)
    return [
      {
        tipo: "referencia",
        colocacion: -1,
        equipoIdx: -1,
        mensaje: "Hay identificadores de catálogo duplicados",
      },
    ];
  for (const [i, c] of plan.colocaciones.entries()) {
    const m = mats.get(c.materialId);
    const t = c.tarimaIdx == null ? null : plan.tarimasArmadas[c.tarimaIdx];
    if (
      !m ||
      !plan.equipos[c.equipoIdx] ||
      (c.tarimaIdx != null && (!t || t.equipoIdx !== c.equipoIdx))
    ) {
      v.push({
        tipo: "referencia",
        colocacion: i,
        equipoIdx: c.equipoIdx,
        mensaje: "El bulto tiene una referencia inexistente o de otro equipo",
      });
      continue;
    }
    const d = dimsEn(c.orientacion, m.largo, m.ancho, m.alto);
    if (
      !m.orientaciones.includes(c.orientacion) ||
      d.l !== c.l ||
      d.a !== c.a ||
      d.h !== c.h
    )
      v.push({
        tipo: "orientacion",
        colocacion: i,
        equipoIdx: c.equipoIdx,
        mensaje: "La orientación o las medidas no corresponden al material",
      });
    if (
      t &&
      (c.x < t.x ||
        c.y < t.y ||
        c.z < t.z + t.hTarima ||
        c.x + c.l > t.x + t.l ||
        c.y + c.a > t.y + t.a ||
        c.z + c.h > t.z + t.h)
    )
      v.push({
        tipo: "referencia",
        colocacion: i,
        equipoIdx: c.equipoIdx,
        mensaje: "La caja queda fuera de su tarima armada",
      });
  }
  for (const [i, t] of plan.tarimasArmadas.entries()) {
    const tipo = tars.get(t.tarimaId);
    if (!tipo || !plan.equipos[t.equipoIdx]) {
      v.push({
        tipo: "referencia",
        colocacion: -1,
        tarima: i,
        equipoIdx: t.equipoIdx,
        mensaje: "La tarima tiene una referencia inexistente",
      });
      continue;
    }
    const cs = plan.colocaciones.filter((c) => c.tarimaIdx === i);
    const peso =
      tipo.tara +
      cs.reduce((s, c) => s + (mats.get(c.materialId)?.peso ?? 0), 0);
    const h = Math.max(t.hTarima, ...cs.map((c) => c.z + c.h - t.z));
    const base =
      (t.l - 2 * t.offset === tipo.largo &&
        t.a - 2 * t.offset === tipo.ancho) ||
      (t.l - 2 * t.offset === tipo.ancho && t.a - 2 * t.offset === tipo.largo);
    if (
      !base ||
      t.hTarima !== tipo.alto ||
      Math.abs(peso - t.peso) > 1e-3 ||
      t.cajas !== cs.length ||
      t.h !== h
    )
      v.push({
        tipo: "datos_invalidos",
        colocacion: -1,
        tarima: i,
        equipoIdx: t.equipoIdx,
        mensaje:
          "Las medidas, el conteo o el peso de la tarima no coinciden con su carga real",
      });
  }
  if (v.length) return v;

  const solidos: Solido[] = [];
  plan.colocaciones.forEach((c, k) => {
    const m = mats.get(c.materialId) ?? null;
    solidos.push({
      ...c,
      i: solidos.length,
      peso: m?.peso ?? 0,
      mat: m,
      col: k,
      tar: -1,
    });
  });
  plan.tarimasArmadas.forEach((t, k) => {
    const tipo = tars.get(t.tarimaId);
    solidos.push({
      i: solidos.length,
      equipoIdx: t.equipoIdx,
      x: t.x + t.offset,
      y: t.y + t.offset,
      z: t.z,
      l: t.l - 2 * t.offset,
      a: t.a - 2 * t.offset,
      h: t.hTarima,
      peso: tipo?.tara ?? 0,
      mat: null,
      col: -1,
      tar: k,
    });
  });

  const nombre = (s: Solido) =>
    s.mat
      ? `${s.mat.sku ?? s.mat.nombre} #${s.col + 1}`
      : `Tarima #${s.tar + 1}`;

  // Límites del equipo y altura útil.
  for (const s of solidos) {
    const e = plan.equipos[s.equipoIdx];
    if (!e) continue;
    if (
      s.x < 0 ||
      s.y < 0 ||
      s.z < 0 ||
      s.x + s.l > e.largo ||
      s.y + s.a > e.ancho ||
      s.z + s.h > e.alto
    )
      v.push({
        tipo: "fuera_de_equipo",
        colocacion: s.col,
        tarima: s.tar,
        equipoIdx: s.equipoIdx,
        mensaje: `${nombre(s)} se sale del equipo`,
      });
    else if (s.z + s.h > e.alturaUtil)
      v.push({
        tipo: "altura_util",
        colocacion: s.col,
        tarima: s.tar,
        equipoIdx: s.equipoIdx,
        mensaje: `${nombre(s)} rebasa la altura útil (${e.alturaUtil} mm)`,
      });
  }

  // Índice por equipo.
  const indices = new Map<number, IndiceXY<Solido>>();
  for (const s of solidos) {
    let ix = indices.get(s.equipoIdx);
    if (!ix) indices.set(s.equipoIdx, (ix = new IndiceXY<Solido>()));
    ix.agregar(s);
  }

  // Colisiones y relaciones de apoyo.
  const apoyos: { j: number; area: number }[][] = solidos.map(() => []);
  const encima: number[][] = solidos.map(() => []);
  for (const s of solidos) {
    for (const o of indices.get(s.equipoIdx)!.vecinos(s)) {
      if (o.i <= s.i) continue;
      if (volumenTraslape(s, o) > 0)
        v.push({
          tipo: "colision",
          colocacion: s.col >= 0 ? s.col : o.col,
          tarima: s.tar,
          equipoIdx: s.equipoIdx,
          mensaje: `${nombre(s)} choca con ${nombre(o)}`,
        });
    }
    if (s.z === 0) continue;
    for (const o of indices.get(s.equipoIdx)!.vecinos(s)) {
      if (o.i === s.i || o.z + o.h !== s.z) continue;
      const area = areaTraslape(s, o);
      if (area > 0) {
        apoyos[s.i].push({ j: o.i, area });
        encima[o.i].push(s.i);
      }
    }
  }

  // Soporte, no apilable y frágil.
  for (const s of solidos) {
    if (s.z === 0) continue;
    const area = areaUnionSoporte(
      s,
      apoyos[s.i].map((x) => solidos[x.j]),
    );
    const frac = area / (s.l * s.a);
    if (frac < soporteMin - EPS)
      v.push({
        tipo: "soporte",
        colocacion: s.col,
        tarima: s.tar,
        equipoIdx: s.equipoIdx,
        mensaje: `${nombre(s)} solo tiene ${(frac * 100).toFixed(0)}% de soporte (mínimo ${(soporteMin * 100).toFixed(0)}%)`,
      });
    for (const { j } of apoyos[s.i]) {
      const abajo = solidos[j];
      if (!abajo.mat) continue;
      if (!abajo.mat.apilable)
        v.push({
          tipo: "no_apilable",
          colocacion: s.col,
          tarima: s.tar,
          equipoIdx: s.equipoIdx,
          mensaje: `${nombre(s)} está encima de ${nombre(abajo)}, que no es apilable`,
        });
      if (abajo.mat.fragil && !(s.mat?.fragil ?? false))
        v.push({
          tipo: "fragil",
          colocacion: s.col,
          tarima: s.tar,
          equipoIdx: s.equipoIdx,
          mensaje: `${nombre(s)} no es frágil y está sobre ${nombre(abajo)}, que sí lo es`,
        });
    }
  }

  // Peso encima (reparto proporcional al área de apoyo) y capas.
  const orden = [...solidos].sort((p, q) => q.z - p.z);
  const cargado = new Float64Array(solidos.length);
  const capasArriba = new Int32Array(solidos.length);
  for (const s of orden) {
    const total = s.peso + cargado[s.i];
    const areaTot = apoyos[s.i].reduce((t, x) => t + x.area, 0);
    for (const { j, area } of apoyos[s.i])
      cargado[j] += (total * area) / areaTot;
    let arriba = 0;
    for (const k of encima[s.i])
      arriba = Math.max(arriba, (solidos[k].mat ? 1 : 0) + capasArriba[k]);
    capasArriba[s.i] = arriba;
  }
  for (const s of solidos) {
    if (!s.mat) continue;
    const m = s.mat;
    if (m.maxPesoEncima != null && cargado[s.i] > m.maxPesoEncima + 1e-3)
      v.push({
        tipo: "peso_encima",
        colocacion: s.col,
        equipoIdx: s.equipoIdx,
        mensaje: `${nombre(s)} soporta ${cargado[s.i].toFixed(1)} kg encima (máximo ${m.maxPesoEncima} kg)`,
      });
    const maxCapas = Math.min(capasMaxMaterial(m), capasPorBct(m, s.l, s.a));
    if (m.apilable && capasArriba[s.i] + 1 > maxCapas)
      v.push({
        tipo: "capas",
        colocacion: s.col,
        equipoIdx: s.equipoIdx,
        mensaje: `${nombre(s)} tiene ${capasArriba[s.i]} capas encima (máximo ${maxCapas - 1})`,
      });
  }

  // Carga útil por equipo.
  plan.equipos.forEach((e, ei) => {
    const peso = solidos
      .filter((s) => s.equipoIdx === ei)
      .reduce((t, s) => t + s.peso, 0);
    if (e.cargaUtil != null && peso > e.cargaUtil + 1e-3)
      v.push({
        tipo: "carga_util",
        colocacion: -1,
        equipoIdx: ei,
        mensaje: `${e.nombre}: ${peso.toFixed(0)} kg supera la carga útil de ${e.cargaUtil} kg`,
      });
  });

  // Puerta: bultos sueltos y tarimas armadas.
  for (const s of solidos) {
    if (s.col >= 0 && plan.colocaciones[s.col].tarimaIdx != null) continue;
    const e = plan.equipos[s.equipoIdx];
    const t = s.tar >= 0 ? plan.tarimasArmadas[s.tar] : null;
    const h = t ? t.h : s.h;
    const l = t ? t.l : s.l;
    const a = t ? t.a : s.a;
    if (h > e.puertaAlto || Math.min(l, a) > e.puertaAncho)
      v.push({
        tipo: "puerta",
        colocacion: s.col,
        tarima: s.tar,
        equipoIdx: s.equipoIdx,
        mensaje: `${nombre(s)} no pasa por la puerta`,
      });
  }

  // Descarga hacia +X: ni un bulto más próximo a la puerta ni uno encima
  // puede pertenecer a una parada posterior y bloquear la parada actual.
  for (let i = 0; i < plan.colocaciones.length; i++) {
    const c = plan.colocaciones[i],
      parada = mats.get(c.materialId)?.paradaDescarga ?? 1;
    for (const d of plan.colocaciones) {
      if (
        d.equipoIdx !== c.equipoIdx ||
        (mats.get(d.materialId)?.paradaDescarga ?? 1) <= parada
      )
        continue;
      const ancho = c.y < d.y + d.a && d.y < c.y + c.a;
      const alto = c.z < d.z + d.h && d.z < c.z + c.h;
      const delante = d.x >= c.x + c.l && ancho && alto;
      const arriba = d.z >= c.z + c.h && areaTraslape(c, d) > 0;
      if (delante || arriba) {
        v.push({
          tipo: "lifo",
          colocacion: i,
          equipoIdx: c.equipoIdx,
          mensaje: `La parada ${parada} queda bloqueada por mercancía de una parada posterior`,
        });
        break;
      }
    }
  }

  // Reglas de tarima armada.
  plan.tarimasArmadas.forEach((t, k) => {
    const tipo = tars.get(t.tarimaId);
    if (!tipo) return;
    if (t.h > tipo.alturaMaxArmada)
      v.push({
        tipo: "tarima_altura",
        colocacion: -1,
        tarima: k,
        equipoIdx: t.equipoIdx,
        mensaje: `Tarima #${k + 1} mide ${t.h} mm (máximo ${tipo.alturaMaxArmada})`,
      });
    if (t.peso - tipo.tara > tipo.cargaMax + 1e-3)
      v.push({
        tipo: "tarima_peso",
        colocacion: -1,
        tarima: k,
        equipoIdx: t.equipoIdx,
        mensaje: `Tarima #${k + 1} lleva ${(t.peso - tipo.tara).toFixed(0)} kg (máximo ${tipo.cargaMax})`,
      });
    if (t.offset > tipo.voladizoMax)
      v.push({
        tipo: "tarima_voladizo",
        colocacion: -1,
        tarima: k,
        equipoIdx: t.equipoIdx,
        mensaje: `Tarima #${k + 1} sobresale más de ${tipo.voladizoMax} mm`,
      });
  });

  return v;
}

/** Violaciones que bloquean guardar y exportar. */
export function planValido(plan: PlanCarga): boolean {
  return validarPlan(plan).length === 0;
}
