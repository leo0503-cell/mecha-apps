/** Heurística determinista de puntos extremos. Valida cada colocación y preserva bloqueos. */
import { z } from "zod";
import { esquemaEquipo, esquemaMaterial, esquemaParametros } from "./esquemas";
import { generarAvisos } from "./avisos";
import { volumenTraslape, fraccionSoporte } from "./geometria";
import { calcularPorEquipo, cogGlobal, volumenUtil } from "./kpis";
import { orientacionesPorPuerta } from "./homogeneo";
import { orientacionesUnicas } from "./orientaciones";
import { asignarPasos } from "./secuencia";
import { validarPlan } from "./validador";
import {
  PARAMETROS_DEFAULT,
  VERSION_MOTOR,
  type PlanCarga,
  type Material,
  type Equipo,
  type Colocacion,
  type ParametrosCalculo,
  type NoCargado,
} from "./tipos";
export interface EntradaMixta {
  items: { material: Material; cantidad: number }[];
  /** Un slot por equipo disponible, permite tipos diferentes. */
  equipos: Equipo[];
  parametros?: Partial<ParametrosCalculo>;
  bloqueadas?: Colocacion[];
}
export const esquemaEntradaMixta = z
  .object({
    items: z
      .array(
        z.object({
          material: esquemaMaterial,
          cantidad: z.number().int().positive().max(1000000),
        }),
      )
      .min(1)
      .max(5000),
    equipos: z.array(esquemaEquipo).min(1).max(10),
    parametros: esquemaParametros.partial().optional(),
  })
  .passthrough();
export function actualizarKpis(plan: PlanCarga): PlanCarga {
  const porEquipo = calcularPorEquipo(
    plan.equipos,
    plan.colocaciones,
    plan.tarimasArmadas,
    new Map(plan.materiales.map((m) => [m.id, m])),
    new Map(plan.tarimas.map((t) => [t.id, t.tara])),
    plan.parametros,
  );
  const peso = porEquipo.reduce((s, k) => s + k.pesoKg, 0),
    vol = porEquipo.reduce((s, k) => s + k.volumenM3, 0);
  const capacidad = plan.equipos.reduce((s, e) => s + volumenUtil(e), 0);
  const carga = plan.equipos.reduce((s, e) => s + (e.cargaUtil ?? 0), 0);
  return {
    ...plan,
    kpis: {
      ...plan.kpis,
      unidadesCargadas: plan.colocaciones.length,
      unidadesNoCargadas: plan.noCargados.reduce((s, n) => s + n.cantidad, 0),
      equiposUsados: porEquipo.filter((k) => k.unidades > 0).length,
      cbm: vol,
      pesoRealKg: peso,
      pctVolumen: capacidad ? vol / capacidad : 0,
      pctPeso: carga ? peso / carga : 0,
      porEquipo,
      cog: cogGlobal(porEquipo),
    },
  };
}
export function calcularMixto(
  entrada: EntradaMixta,
  progreso?: (pct: number, mensaje: string, cargadas: number) => void,
): PlanCarga {
  if (!esquemaEntradaMixta.safeParse(entrada).success)
    throw new Error(
      "La carga mixta contiene cantidades, medidas o equipos inválidos",
    );
  const parametros = { ...PARAMETROS_DEFAULT, ...entrada.parametros };
  if (
    new Set(entrada.items.map((i) => i.material.id)).size !==
    entrada.items.length
  )
    throw new Error(
      "Cada material debe tener un identificador único; combina cantidades repetidas",
    );
  let plan: PlanCarga = {
    versionMotor: VERSION_MOTOR,
    semilla: parametros.semilla,
    equipos: entrada.equipos,
    materiales: entrada.items.map((i) => i.material),
    tarimas: [],
    colocaciones: structuredClone(entrada.bloqueadas ?? []),
    tarimasArmadas: [],
    noCargados: [],
    parametros,
    kpis: {
      unidadesCargadas: 0,
      unidadesNoCargadas: 0,
      equiposUsados: 0,
      cbm: 0,
      pesoRealKg: 0,
      pctVolumen: 0,
      pctPeso: 0,
      factorLimitante: "ninguno",
      porEquipo: [],
      cog: null,
    },
    avisos: [],
  };
  if (validarPlan(plan).length)
    throw new Error("Las posiciones bloqueadas no forman un plan válido");
  let seed = parametros.semilla >>> 0;
  const azar = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const items = entrada.items
    .map((i) => ({ ...i, orden: azar() }))
    .sort(
      (a, b) =>
        (b.material.paradaDescarga ?? 1) - (a.material.paradaDescarga ?? 1) ||
        Number(!!a.material.fragil) - Number(!!b.material.fragil) ||
        b.material.peso - a.material.peso ||
        a.orden - b.orden,
    );
  const puntos = entrada.equipos.map(() => [{ x: 0, y: 0, z: 0 }]);
  const agregarPuntos = (c: Colocacion) => {
    const g = parametros.holguraEntreBultos;
    puntos[c.equipoIdx].push(
      { x: c.x + c.l + g, y: c.y, z: c.z },
      { x: c.x, y: c.y + c.a + g, z: c.z },
      { x: c.x, y: c.y, z: c.z + c.h },
    );
  };
  plan.colocaciones.forEach(agregarPuntos);
  const total = items.reduce((s, i) => s + i.cantidad, 0);
  let visitadas = plan.colocaciones.length,
    comprobaciones = 0;
  // Presupuesto de búsqueda determinista: una semilla no depende del reloj/hardware.
  const presupuesto = Math.min(
    100000,
    Math.max(5000, Math.floor(parametros.tiempoMaxS * 10000)),
  );
  for (const item of items) {
    const m = item.material;
    const fijadas = plan.colocaciones.filter(
      (c) => c.materialId === m.id,
    ).length;
    if (fijadas > item.cantidad)
      throw new Error(
        "Las posiciones bloqueadas exceden la cantidad solicitada",
      );
    let restantes = item.cantidad - fijadas;
    let motivo: NoCargado["motivo"] = "volumen";
    while (
      restantes > 0 &&
      plan.colocaciones.length < 5000 &&
      comprobaciones < presupuesto
    ) {
      let colocada = false,
        cabePuerta = false,
        tienePeso = false;
      equipo: for (const [ei, e] of plan.equipos.entries()) {
        const ors = orientacionesPorPuerta(m, e);
        if (!ors.length) continue;
        cabePuerta = true;
        const actuales = plan.colocaciones.filter((c) => c.equipoIdx === ei);
        const peso = actuales.reduce(
          (s, c) =>
            s + (plan.materiales.find((t) => t.id === c.materialId)?.peso ?? 0),
          0,
        );
        if (e.cargaUtil != null && peso + m.peso > e.cargaUtil + 1e-3) continue;
        tienePeso = true;
        const candidatos = [
          ...new Map(
            puntos[ei].map((p) => [`${p.x},${p.y},${p.z}`, p]),
          ).values(),
        ].sort((a, b) => a.z - b.z || a.x - b.x || a.y - b.y);
        for (const p of candidatos)
          for (const { o, d } of orientacionesUnicas(
            ors,
            m.largo,
            m.ancho,
            m.alto,
          )) {
            if (++comprobaciones > presupuesto) break equipo;
            if (
              p.x + d.l > e.largo ||
              p.y + d.a > e.ancho ||
              p.z + d.h > e.alturaUtil
            )
              continue;
            const c: Colocacion = {
              ...p,
              ...d,
              equipoIdx: ei,
              materialId: m.id,
              tarimaIdx: null,
              orientacion: o,
              paso: 0,
              capa: 1,
            };
            if (actuales.some((b) => volumenTraslape(c, b) > 0)) continue;
            if (
              c.z > 0 &&
              fraccionSoporte(
                c,
                actuales.filter((b) => b.z + b.h === c.z),
              ) <
                parametros.soporteMin - 1e-9
            )
              continue;
            plan.colocaciones.push(c);
            const violaciones = validarPlan(plan);
            if (violaciones.length) {
              plan.colocaciones.pop();
              motivo = violaciones.some((v) => v.tipo === "lifo")
                ? "orden_descarga"
                : violaciones.some((v) =>
                      [
                        "soporte",
                        "peso_encima",
                        "capas",
                        "fragil",
                        "no_apilable",
                      ].includes(v.tipo),
                    )
                  ? "apilado"
                  : "volumen";
              continue;
            }
            c.capa =
              1 +
              Math.max(
                0,
                ...actuales
                  .filter(
                    (b) =>
                      b.z + b.h === c.z &&
                      b.x < c.x + c.l &&
                      c.x < b.x + b.l &&
                      b.y < c.y + c.a &&
                      c.y < b.y + b.a,
                  )
                  .map((b) => b.capa),
              );
            agregarPuntos(c);
            colocada = true;
            break equipo;
          }
      }
      if (!colocada) {
        if (!cabePuerta) motivo = "puerta";
        else if (!tienePeso) motivo = "peso";
        break;
      }
      restantes--;
      visitadas++;
      if (visitadas % 10 === 0)
        progreso?.(
          visitadas / total,
          `Colocados ${visitadas} de ${total}`,
          plan.colocaciones.length,
        );
    }
    if (restantes > 0)
      plan.noCargados.push({
        materialId: m.id,
        cantidad: restantes,
        motivo:
          comprobaciones >= presupuesto || plan.colocaciones.length >= 5000
            ? "limite_busqueda"
            : motivo,
      });
  }
  plan.colocaciones = asignarPasos(plan.colocaciones, plan.tarimasArmadas);
  const motivos = new Set(plan.noCargados.map((n) => n.motivo));
  plan.kpis.factorLimitante =
    motivos.size === 0
      ? "ninguno"
      : motivos.has("limite_busqueda")
        ? "busqueda"
        : motivos.size > 1
          ? "restricciones"
          : motivos.has("peso")
            ? "peso"
            : motivos.has("puerta")
              ? "puerta"
              : motivos.has("apilado")
                ? "apilado"
                : motivos.has("orden_descarga")
                  ? "restricciones"
                  : "volumen";
  plan = actualizarKpis(plan);
  plan.avisos = generarAvisos({
    equipo: plan.equipos[0],
    material: plan.materiales[0],
    kpis: plan.kpis,
    parametros,
  });
  if (plan.noCargados.some((n) => n.motivo === "limite_busqueda"))
    plan.avisos.push({
      nivel: "advertencia",
      codigo: "busqueda",
      mensaje:
        "Se alcanzó el presupuesto de búsqueda; quedan bultos sin resolver. Aumenta el esfuerzo o cambia el equipo.",
    });
  plan.avisos.push({
    nivel: "info",
    codigo: "heuristica",
    mensaje:
      "Acomodo recomendado por heurística de puntos extremos; no garantiza el óptimo global.",
  });
  progreso?.(1, "Plan validado", plan.colocaciones.length);
  return plan;
}
