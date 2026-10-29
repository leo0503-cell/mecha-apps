/** Fronteras de datos compartidas por el motor, Worker y exportadores. */
import { z } from "zod";
const mm = z.number().int().min(1).max(20000);
const coord = z.number().int().nonnegative().max(20000);
const kg = z.number().positive().max(40000);
const orientacion = z.enum(["LAH", "LHA", "ALH", "AHL", "HLA", "HAL"]);
export const esquemaMaterial = z
  .object({
    id: z.string().min(1),
    nombre: z.string().min(1),
    largo: mm,
    ancho: mm,
    alto: mm,
    peso: kg,
    orientaciones: z.array(orientacion).min(1).max(6),
    apilable: z.boolean(),
    maxPesoEncima: z.number().nonnegative().nullable().optional(),
    maxCapas: z.number().int().positive().nullable().optional(),
    paradaDescarga: z.number().int().positive().optional(),
    fragil: z.boolean().optional(),
  })
  .passthrough();
export const esquemaEquipo = z
  .object({
    id: z.string().min(1),
    codigo: z.string(),
    nombre: z.string(),
    categoria: z.enum([
      "contenedor",
      "reefer",
      "caja_seca",
      "camion",
      "uld",
      "personalizado",
    ]),
    largo: mm,
    ancho: mm,
    alto: mm,
    alturaUtil: mm,
    puertaAncho: mm,
    puertaAlto: mm,
    cargaUtil: z.number().positive().nullable(),
  })
  .passthrough()
  .refine((e) => e.alturaUtil <= e.alto, {
    message: "La altura útil supera el alto interior",
  });
export const esquemaTarima = z
  .object({
    id: z.string().min(1),
    nombre: z.string(),
    largo: mm,
    ancho: mm,
    alto: mm,
    tara: z.number().nonnegative(),
    cargaMax: z.number().positive(),
    alturaMaxArmada: mm,
    voladizoMax: coord,
  })
  .passthrough();
export const esquemaParametros = z
  .object({
    soporteMin: z.number().min(0.8).max(1),
    tiempoMaxS: z.number().positive(),
    holguraEntreBultos: coord,
    permitirDobleEstiba: z.boolean(),
    toleranciaCogLong: z.number().min(0).max(0.5),
    toleranciaCogLat: z.number().min(0).max(0.5),
    semilla: z.number().int(),
    amarre: z.boolean(),
  })
  .passthrough();
export const esquemaEntrada = z
  .object({
    material: esquemaMaterial,
    equipo: esquemaEquipo,
    cantidad: z.number().int().positive().max(1000000).nullable(),
    maxEquipos: z.number().int().min(1).max(10).optional(),
    modoCarga: z.enum(["suelta", "paletizada"]),
    tarima: esquemaTarima.nullable().optional(),
    alturaMaxArmada: mm.nullable().optional(),
    parametros: esquemaParametros.partial().optional(),
  })
  .passthrough()
  .refine((e) => e.modoCarga !== "paletizada" || e.tarima != null, {
    message: "Selecciona una tarima para paletizar",
  });
export const esquemaPlanEstructura = z
  .object({
    versionMotor: z.string().min(1),
    semilla: z.number().int(),
    noCargados: z.array(
      z.object({
        materialId: z.string(),
        cantidad: z.number().int().nonnegative(),
        motivo: z.enum([
          "peso",
          "volumen",
          "puerta",
          "apilado",
          "altura_tarima",
          "limite_equipos",
          "limite_busqueda",
          "orden_descarga",
        ]),
      }),
    ),
    avisos: z.array(
      z.object({
        nivel: z.enum(["info", "advertencia", "error"]),
        codigo: z.string(),
        mensaje: z.string(),
      }),
    ),
    kpis: z
      .object({
        factorLimitante: z.enum([
          "peso",
          "volumen",
          "altura",
          "puerta",
          "apilado",
          "ninguno",
          "busqueda",
          "restricciones",
        ]),
      })
      .passthrough(),
    equipos: z.array(esquemaEquipo),
    materiales: z.array(esquemaMaterial),
    tarimas: z.array(esquemaTarima),
    parametros: esquemaParametros,
    colocaciones: z.array(
      z
        .object({
          equipoIdx: coord,
          materialId: z.string(),
          tarimaIdx: coord.nullable(),
          x: coord,
          y: coord,
          z: coord,
          l: mm,
          a: mm,
          h: mm,
          orientacion,
          paso: z.number().int().nonnegative(),
          capa: z.number().int().positive(),
        })
        .passthrough(),
    ),
    tarimasArmadas: z.array(
      z
        .object({
          equipoIdx: coord,
          tarimaId: z.string(),
          x: coord,
          y: coord,
          z: coord,
          l: mm,
          a: mm,
          h: mm,
          hTarima: mm,
          offset: coord,
          peso: z.number().nonnegative(),
          cajas: z.number().int().nonnegative(),
          paso: coord,
        })
        .passthrough(),
    ),
  })
  .passthrough();
export function exigirEntrada(entrada: unknown): void {
  const r = esquemaEntrada.safeParse(entrada);
  if (!r.success)
    throw new Error(
      `Datos de carga inválidos: ${r.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
}
