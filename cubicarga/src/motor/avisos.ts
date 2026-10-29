/** Avisos fijos y sugerencias (reglas 6, 12, 20, 21). */
import { volumenUtil } from "./kpis";
import type {
  Aviso,
  Equipo,
  Kpis,
  Material,
  ParametrosCalculo,
  Tarima,
} from "./tipos";
import { AVISO_FIJO } from "./tipos";

const NOMBRE_LIMITANTE: Record<Kpis["factorLimitante"], string> = {
  peso: "Limitado por peso",
  volumen: "Limitado por volumen",
  altura: "Limitado por altura",
  puerta: "Limitado por la puerta",
  apilado: "Limitado por apilado",
  ninguno: "Cabe todo",
  busqueda: "Búsqueda incompleta",
  restricciones: "Limitado por varias restricciones",
};

export function textoLimitante(
  k: Pick<Kpis, "factorLimitante" | "pctPeso" | "pctVolumen">,
): string {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return `${NOMBRE_LIMITANTE[k.factorLimitante]}: ${pct(k.pctPeso)} peso / ${pct(k.pctVolumen)} volumen`;
}

export function generarAvisos(args: {
  equipo: Equipo;
  material: Material;
  kpis: Kpis;
  tarima?: Tarima | null;
  parametros: ParametrosCalculo;
}): Aviso[] {
  const { equipo: e, material: m, kpis, tarima, parametros } = args;
  const av: Aviso[] = [
    { nivel: "info", codigo: "referencial", mensaje: AVISO_FIJO },
  ];

  if (e.categoria === "uld")
    av.push({
      nivel: "advertencia",
      codigo: "contorno_uld",
      mensaje:
        "ULD calculado con envolvente rectangular referencial: el contorno útil y la altura autorizada deben confirmarse con la aerolínea antes de cargar.",
    });
  if (e.categoria === "reefer")
    av.push({
      nivel: "advertencia",
      codigo: "reefer",
      mensaje: `No rebases la línea roja (${e.alturaUtil} mm): deja libre el flujo de aire, no bloquees el piso T.`,
    });
  if (e.cargaUtil == null)
    av.push({
      nivel: "advertencia",
      codigo: "sin_carga_util",
      mensaje: `${e.nombre} no tiene carga útil capturada: el cálculo no limita por peso. <Confirma la carga útil con la aerolínea o transportista>.`,
    });
  if (e.categoria === "camion")
    av.push({
      nivel: "info",
      codigo: "confirmar_medidas",
      mensaje:
        "Las medidas de torton, rabón y camioneta varían mucho por carrocería: confirma las de tu unidad.",
    });
  if (e.categoria === "caja_seca")
    av.push({
      nivel: "info",
      codigo: "nom012",
      mensaje:
        "La carga útil de la caja seca está pensada para cruce a EE. UU.; en México depende de la configuración (T3S2/T3S3) y de la NOM-012-SCT-2 vigente.",
    });
  if (
    tarima &&
    parametros.operacion === "exportacion" &&
    (tarima.material ?? "madera") === "madera"
  )
    av.push({
      nivel: "advertencia",
      codigo: "nimf15",
      mensaje:
        "Exportación con tarima de madera: debe llevar tratamiento y sello NIMF-15 (IPPC) conforme a la NOM-144-SEMARNAT vigente.",
    });

  // Densidad (regla 6).
  if (e.cargaUtil) {
    const densCarga = m.peso / ((m.largo * m.ancho * m.alto) / 1e9);
    const densEquipo = e.cargaUtil / volumenUtil(e);
    if (densCarga > densEquipo && kpis.factorLimitante === "peso")
      av.push({
        nivel: "info",
        codigo: "densa",
        mensaje: `Carga densa (${Math.round(densCarga)} kg/m³ vs ${Math.round(densEquipo)} kg/m³ del equipo): te conviene un equipo más chico o carga mixta con mercancía ligera.`,
      });
    else if (
      densCarga < densEquipo * 0.5 &&
      kpis.factorLimitante === "volumen" &&
      !["40HC", "45HC", "CS53"].includes(e.codigo)
    )
      av.push({
        nivel: "info",
        codigo: "ligera",
        mensaje: `Carga ligera (${Math.round(densCarga)} kg/m³): un 40' HC o una caja de 53' aprovecharía mejor el flete.`,
      });
  }

  if (kpis.cog?.fueraDeTolerancia)
    av.push({
      nivel: "advertencia",
      codigo: "cog",
      mensaje: `Centro de gravedad fuera de tolerancia (${(kpis.cog.desvLongitudinal * 100).toFixed(1)}% longitudinal, ${(kpis.cog.desvLateral * 100).toFixed(1)}% lateral). Redistribuye antes de cerrar.`,
    });

  if (e.notaValidacion)
    av.push({
      nivel: "info",
      codigo: "nota_validacion",
      mensaje: e.notaValidacion,
    });
  return av;
}
