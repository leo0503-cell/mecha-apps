/**
 * Paletizado, nivel 1: cajas → tarima. El resultado (tarima armada) se vuelve
 * un bulto con medidas y peso reales para el nivel 2 (tarimas → equipo).
 */
import { llenarHomogeneo, type CajaA } from "./modoA";
import type {
  CodigoOrientacion,
  FactorLimitante,
  Material,
  Tarima,
} from "./tipos";

export interface OpcionesTarima {
  /** Altura máxima de la tarima armada (incluye tarima), mm. */
  alturaMaxArmada: number;
  soporteMin: number;
  amarre: boolean;
  holgura?: number;
}

export interface TarimaArmadaTipo {
  tarima: Tarima;
  /** Cajas en coordenadas locales: x,y desde la esquina de la huella; z desde la cubierta. */
  cajas: CajaA[];
  cajasPorTarima: number;
  cajasPorCapa: number;
  capas: number;
  /** Huella de la tarima armada (incluye voladizo). */
  largo: number;
  ancho: number;
  /** Alto total (tarima + carga). */
  alto: number;
  peso: number;
  limitante: FactorLimitante | "altura";
  /** Desplazamiento de la tarima dentro de la huella (por voladizo). */
  offset: number;
}

export function armarTarima(
  m: Material,
  orientaciones: CodigoOrientacion[],
  t: Tarima,
  op: OpcionesTarima,
): TarimaArmadaTipo {
  const v = Math.max(0, t.voladizoMax);
  const L = t.largo + 2 * v;
  const W = t.ancho + 2 * v;
  const H = op.alturaMaxArmada - t.alto;
  const r =
    H > 0
      ? llenarHomogeneo({ L, W, H }, m, orientaciones, {
          pesoMax: t.cargaMax,
          maxUnidades: null,
          soporteMin: op.soporteMin,
          amarre: op.amarre,
          holgura: op.holgura,
        })
      : null;
  if (!r || r.cuenta === 0) {
    return {
      tarima: t,
      cajas: [],
      cajasPorTarima: 0,
      cajasPorCapa: 0,
      capas: 0,
      largo: L,
      ancho: W,
      alto: t.alto,
      peso: t.tara,
      limitante: "altura",
      offset: v,
    };
  }
  // El límite geométrico en tarima es la altura máxima armada.
  const limitante = r.limitante === "volumen" ? "altura" : r.limitante;
  return {
    tarima: t,
    cajas: r.cajas,
    cajasPorTarima: r.cuenta,
    cajasPorCapa: r.unidadesPorCapa,
    capas: r.capas,
    largo: L,
    ancho: W,
    alto: t.alto + r.alturaUsada,
    peso: t.tara + r.cuenta * m.peso,
    limitante,
    offset: v,
  };
}

/** Peso que puede recibir encima una tarima armada (para doble estiba). */
export function maxPesoEncimaArmada(
  m: Material,
  armada: TarimaArmadaTipo,
): number {
  if (!m.apilable) return 0;
  if (m.maxPesoEncima == null) return Infinity;
  const yaEncima = (armada.capas - 1) * m.peso;
  return Math.max(0, (m.maxPesoEncima - yaEncima) * armada.cajasPorCapa);
}
