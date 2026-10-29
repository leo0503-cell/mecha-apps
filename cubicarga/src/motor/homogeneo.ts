/**
 * Cálculo homogéneo completo (calculadora rápida y escenarios de un SKU):
 * suelto o paletizado, uno o varios equipos, con KPIs, avisos y secuencia.
 */
import { exigirEntrada } from "./esquemas";
import { generarAvisos } from "./avisos";
import { calcularPorEquipo, cogGlobal } from "./kpis";
import { llenarHomogeneo, type ResultadoA } from "./modoA";
import { orientacionesUnicas } from "./orientaciones";
import { armarTarima, maxPesoEncimaArmada } from "./paletizado";
import { asignarPasos } from "./secuencia";
import type {
  CodigoOrientacion,
  Colocacion,
  Equipo,
  FactorLimitante,
  Kpis,
  Material,
  NoCargado,
  ParametrosCalculo,
  PlanCarga,
  Tarima,
  TarimaArmada,
} from "./tipos";
import { PARAMETROS_DEFAULT, VERSION_MOTOR } from "./tipos";

export interface EntradaHomogeneo {
  material: Material;
  equipo: Equipo;
  /** null = llenar al máximo un equipo. */
  cantidad: number | null;
  maxEquipos?: number;
  modoCarga: "suelta" | "paletizada";
  tarima?: Tarima | null;
  /** Altura máxima armada; por defecto la de la tarima. */
  alturaMaxArmada?: number | null;
  /** Permitir girar la tarima (o el bulto) 90° sobre el piso. */
  rotarTarima?: boolean;
  parametros?: Partial<ParametrosCalculo>;
}

/** Orientaciones que caben por la puerta y bajo la altura útil (regla 4). */
export function orientacionesPorPuerta(
  m: Material,
  e: Equipo,
  ors: CodigoOrientacion[] = m.orientaciones,
) {
  return orientacionesUnicas(ors, m.largo, m.ancho, m.alto)
    .filter(
      ({ d }) =>
        d.h <= e.puertaAlto &&
        d.h <= e.alturaUtil &&
        Math.min(d.l, d.a) <= e.puertaAncho,
    )
    .map(({ o }) => o);
}

export function calcularHomogeneo(ent: EntradaHomogeneo): PlanCarga {
  exigirEntrada(ent);
  const p: ParametrosCalculo = { ...PARAMETROS_DEFAULT, ...ent.parametros };
  const { material: m, equipo: e } = ent;
  const maxEquipos = Math.min(10, ent.maxEquipos ?? 10);
  const esp = { L: e.largo, W: e.ancho, H: e.alturaUtil };
  const noCargados: NoCargado[] = [];
  const colocaciones: Colocacion[] = [];
  const tarimasArmadas: TarimaArmada[] = [];
  const materiales: Material[] = [m];
  const tarimas: Tarima[] = [];
  let factor: FactorLimitante = "volumen";
  let porEquipo = 0;
  let porCapa = 0;
  let capas = 0;
  let cajasPorTarima: number | undefined;
  let tarimasPorEquipo: number | undefined;
  let equiposUsados = 0;
  let sinColocaciones = false;

  const repartir = (capacidad: number, total: number | null) => {
    if (total == null) return capacidad > 0 ? [capacidad] : [];
    const res: number[] = [];
    let r = total;
    while (r > 0 && res.length < maxEquipos && capacidad > 0) {
      res.push(Math.min(r, capacidad));
      r -= capacidad;
    }
    return res;
  };

  if (ent.modoCarga === "suelta" || !ent.tarima) {
    const orsPuerta = orientacionesPorPuerta(m, e);
    if (orsPuerta.length === 0) {
      factor = "puerta";
      noCargados.push({
        materialId: m.id,
        cantidad: ent.cantidad ?? 1,
        motivo: "puerta",
      });
    } else {
      const r = llenarHomogeneo(esp, m, orsPuerta, {
        pesoMax: e.cargaUtil,
        maxUnidades: null,
        soporteMin: p.soporteMin,
        holgura: p.holguraEntreBultos,
      });
      sinColocaciones = r.sinColocaciones;
      factor = r.cuenta === 0 ? "volumen" : r.limitante;
      porEquipo = r.cuenta;
      porCapa = r.unidadesPorCapa;
      capas = r.capas;
      const reparto = repartir(r.cuenta, ent.cantidad);
      reparto.forEach((n, ei) => {
        for (const c of tomarCajas(r, n))
          colocaciones.push({
            equipoIdx: ei,
            materialId: m.id,
            tarimaIdx: null,
            x: c.x,
            y: c.y,
            z: c.z,
            l: c.l,
            a: c.a,
            h: c.h,
            orientacion: c.o,
            paso: 0,
            capa: c.capa,
          });
      });
      equiposUsados = reparto.length;
      const cargadas = reparto.reduce((s, n) => s + n, 0);
      if (r.cuenta === 0)
        noCargados.push({
          materialId: m.id,
          cantidad: ent.cantidad ?? 1,
          motivo: "volumen",
        });
      else if (ent.cantidad != null && cargadas < ent.cantidad)
        noCargados.push({
          materialId: m.id,
          cantidad: ent.cantidad - cargadas,
          motivo: "limite_equipos",
        });
      if (
        ent.cantidad != null &&
        reparto.length === 1 &&
        cargadas === ent.cantidad
      )
        factor = "ninguno";
    }
  } else {
    const t = ent.tarima;
    tarimas.push(t);
    const alturaMax = Math.min(
      ent.alturaMaxArmada ?? t.alturaMaxArmada,
      e.alturaUtil,
      e.puertaAlto,
    );
    const tipo = armarTarima(m, m.orientaciones, t, {
      alturaMaxArmada: alturaMax,
      soporteMin: p.soporteMin,
      amarre: p.amarre,
      holgura: p.holguraEntreBultos,
    });
    cajasPorTarima = tipo.cajasPorTarima;
    if (tipo.cajasPorTarima === 0) {
      factor = "altura";
      noCargados.push({
        materialId: m.id,
        cantidad: ent.cantidad ?? 1,
        motivo: "altura_tarima",
      });
    } else {
      const dobleEstiba =
        p.permitirDobleEstiba && m.apilable && 2 * tipo.alto <= e.alturaUtil;
      const bultoTarima: Material = {
        id: `armada:${m.id}`,
        nombre: `Tarima ${t.nombre} con ${m.nombre}`,
        largo: tipo.largo,
        ancho: tipo.ancho,
        alto: tipo.alto,
        peso: tipo.peso,
        orientaciones: ent.rotarTarima === false ? ["LAH"] : ["LAH", "ALH"],
        apilable: dobleEstiba,
        maxCapas: 2,
        maxPesoEncima: dobleEstiba ? maxPesoEncimaArmada(m, tipo) : 0,
      };
      const orsPuerta = orientacionesPorPuerta(bultoTarima, e);
      const totalTarimas =
        ent.cantidad == null
          ? null
          : Math.ceil(ent.cantidad / tipo.cajasPorTarima);
      if (orsPuerta.length === 0) {
        factor = "puerta";
        noCargados.push({
          materialId: m.id,
          cantidad: ent.cantidad ?? tipo.cajasPorTarima,
          motivo: "puerta",
        });
      } else {
        const r = llenarHomogeneo(esp, bultoTarima, orsPuerta, {
          pesoMax: e.cargaUtil,
          maxUnidades: null,
          soporteMin: p.soporteMin,
        });
        factor = r.cuenta === 0 ? "volumen" : r.limitante;
        tarimasPorEquipo = r.cuenta;
        porEquipo = r.cuenta * tipo.cajasPorTarima;
        porCapa = r.unidadesPorCapa;
        capas = r.capas;
        const reparto = repartir(r.cuenta, totalTarimas);
        let cajasRestantes = ent.cantidad ?? Infinity;
        reparto.forEach((n, ei) => {
          for (const pt of tomarCajas(r, n)) {
            const nCajas = Math.min(tipo.cajasPorTarima, cajasRestantes);
            cajasRestantes -= nCajas;
            const girada = pt.o === "ALH";
            const cajas = tomarCajas(
              { cajas: tipo.cajas, cuenta: tipo.cajasPorTarima } as ResultadoA,
              nCajas,
            );
            const ti = tarimasArmadas.length;
            const altoCarga = cajas.reduce((h, c) => Math.max(h, c.z + c.h), 0);
            tarimasArmadas.push({
              equipoIdx: ei,
              tarimaId: t.id,
              x: pt.x,
              y: pt.y,
              z: pt.z,
              l: pt.l,
              a: pt.a,
              h: t.alto + altoCarga,
              hTarima: t.alto,
              peso: t.tara + nCajas * m.peso,
              cajas: nCajas,
              paso: 0,
              offset: tipo.offset,
            });
            for (const c of cajas) {
              colocaciones.push({
                equipoIdx: ei,
                materialId: m.id,
                tarimaIdx: ti,
                x: pt.x + (girada ? c.y : c.x),
                y: pt.y + (girada ? c.x : c.y),
                z: pt.z + t.alto + c.z,
                l: girada ? c.a : c.l,
                a: girada ? c.l : c.a,
                h: c.h,
                orientacion: girada
                  ? (`${c.o[1]}${c.o[0]}${c.o[2]}` as CodigoOrientacion)
                  : c.o,
                paso: 0,
                capa: c.capa,
              });
            }
          }
        });
        equiposUsados = reparto.length;
        const cargadas = colocaciones.length;
        if (r.cuenta === 0)
          noCargados.push({
            materialId: m.id,
            cantidad: ent.cantidad ?? 1,
            motivo: "volumen",
          });
        else if (ent.cantidad != null && cargadas < ent.cantidad)
          noCargados.push({
            materialId: m.id,
            cantidad: ent.cantidad - cargadas,
            motivo: "limite_equipos",
          });
        if (
          ent.cantidad != null &&
          reparto.length === 1 &&
          cargadas === ent.cantidad
        )
          factor = "ninguno";
      }
    }
  }

  const equipos = Array.from({ length: Math.max(1, equiposUsados) }, () => e);
  const ordenadas = asignarPasos(colocaciones, tarimasArmadas);
  const matsMap = new Map(materiales.map((x) => [x.id, x]));
  const taras = new Map(tarimas.map((x) => [x.id, x.tara]));
  const kpisEq = calcularPorEquipo(
    equipos,
    ordenadas,
    tarimasArmadas,
    matsMap,
    taras,
    p,
  );

  // En bultos diminutos no se dibujan colocaciones: KPIs analíticos.
  if (sinColocaciones && kpisEq[0]) {
    const n = porEquipo;
    kpisEq[0].unidades = n;
    kpisEq[0].pesoKg = n * m.peso;
    kpisEq[0].volumenM3 = (n * m.largo * m.ancho * m.alto) / 1e9;
    kpisEq[0].pctVolumen =
      kpisEq[0].volumenM3 / ((e.largo * e.ancho * e.alturaUtil) / 1e9);
    kpisEq[0].pctPeso = e.cargaUtil ? kpisEq[0].pesoKg / e.cargaUtil : 0;
  }

  const unidades = sinColocaciones ? porEquipo : ordenadas.length;
  const volTotal = kpisEq.reduce((s, k) => s + k.volumenM3, 0);
  const pesoTotal = kpisEq.reduce((s, k) => s + k.pesoKg, 0);
  const volEq = kpisEq.length * ((e.largo * e.ancho * e.alturaUtil) / 1e9);
  const kpis: Kpis = {
    unidadesCargadas: unidades,
    unidadesNoCargadas: noCargados.reduce((s, x) => s + x.cantidad, 0),
    equiposUsados,
    cbm:
      Math.round(((unidades * m.largo * m.ancho * m.alto) / 1e9) * 1000) / 1000,
    pesoRealKg: Math.round(pesoTotal * 1000) / 1000,
    pctVolumen: volTotal / volEq,
    pctPeso: e.cargaUtil ? pesoTotal / (e.cargaUtil * kpisEq.length) : 0,
    factorLimitante: factor,
    porEquipo: kpisEq,
    unidadesPorCapa: porCapa,
    capas,
    unidadesPorEquipo: porEquipo,
    cajasPorTarima,
    tarimasPorEquipo,
    cog: cogGlobal(kpisEq),
  };

  return {
    versionMotor: VERSION_MOTOR,
    semilla: p.semilla,
    equipos,
    materiales,
    tarimas,
    colocaciones: ordenadas,
    tarimasArmadas,
    noCargados,
    kpis,
    avisos: [
      ...(sinColocaciones
        ? [
            {
              nivel: "info" as const,
              codigo: "sin_dibujo",
              mensaje:
                "Son demasiados bultos para dibujarlos uno por uno: se muestran solo los números.",
            },
          ]
        : []),
      ...generarAvisos({
        equipo: e,
        material: m,
        kpis,
        tarima: ent.modoCarga === "paletizada" ? ent.tarima : null,
        parametros: p,
      }),
    ],
    parametros: p,
  };
}

/** Primeras n cajas en orden de capas (abajo → arriba). */
function tomarCajas(r: Pick<ResultadoA, "cajas">, n: number) {
  return r.cajas.slice(0, n);
}

export interface Escenario {
  nombre: string;
  entrada: EntradaHomogeneo;
}

export interface ResultadoEscenario {
  nombre: string;
  plan: PlanCarga;
  unidades: number;
  equipos: number;
  pctVolumen: number;
  pctPeso: number;
  costoPorUnidad: number | null;
}

export function evaluarEscenario({
  nombre,
  entrada,
}: Escenario): ResultadoEscenario {
  const plan = calcularHomogeneo(entrada);
  const costo = entrada.equipo.costoReferencia;
  const u = plan.kpis.unidadesCargadas;
  return {
    nombre,
    plan,
    unidades: u,
    equipos: plan.kpis.equiposUsados,
    pctVolumen: plan.kpis.pctVolumen,
    pctPeso: plan.kpis.pctPeso,
    costoPorUnidad: costo && u ? (costo * plan.kpis.equiposUsados) / u : null,
  };
}

/** Recomienda: más unidades, luego menor costo, luego menos equipos, luego mayor % de uso. */
export function recomendar(res: ResultadoEscenario[]): string | null {
  const costo = (r: ResultadoEscenario) => r.costoPorUnidad ?? Infinity;
  const orden = [...res].sort(
    (a, b) =>
      b.unidades - a.unidades ||
      costo(a) - costo(b) ||
      a.equipos - b.equipos ||
      Math.max(b.pctVolumen, b.pctPeso) - Math.max(a.pctVolumen, a.pctPeso),
  );
  return orden[0]?.nombre ?? null;
}

export function compararEscenarios(escenarios: Escenario[]) {
  const resultados = escenarios.map(evaluarEscenario);
  return { resultados, recomendado: recomendar(resultados) };
}
