import { validarRegistro, errorDatos } from "./validacion";
/** Repositorio Supabase: mapea registros camelCase ↔ columnas de la sección 6. RLS decide qué se ve. */
import { TODAS_ORIENTACIONES, type CodigoOrientacion } from "@/motor";
import { supabase } from "../supabase/cliente";
import type { Entidad, RegistroPorEntidad, Repositorio } from "./tipos";

type Mapa = [campo: string, columna: string][];

const MAPAS: Record<Entidad, Mapa> = {
  materiales: [
    ["id", "id"],
    ["empresaId", "empresa_id"],
    ["sku", "sku"],
    ["nombre", "nombre"],
    ["tipo", "tipo"],
    ["largo", "largo_mm"],
    ["ancho", "ancho_mm"],
    ["alto", "alto_mm"],
    ["peso", "peso_kg"],
    ["densidad", "densidad_kg_m3"],
    ["preset", "preset_orientacion"],
    ["apilable", "apilable"],
    ["maxPesoEncima", "max_peso_encima_kg"],
    ["maxCapas", "max_capas"],
    ["fragil", "fragil"],
    ["ectLbIn", "ect_lb_in"],
    ["calibreIn", "calibre_in"],
    ["unidadesPorBulto", "unidades_por_bulto"],
    ["color", "color_hex"],
    ["hsCode", "hs_code"],
    ["notas", "notas"],
    ["activo", "activo"],
  ],
  tarimas: [
    ["id", "id"],
    ["empresaId", "empresa_id"],
    ["nombre", "nombre"],
    ["codigo", "codigo_iso"],
    ["largo", "largo_mm"],
    ["ancho", "ancho_mm"],
    ["alto", "alto_mm"],
    ["tara", "tara_kg"],
    ["cargaMax", "carga_max_kg"],
    ["alturaMaxArmada", "altura_max_armada_mm"],
    ["voladizoMax", "voladizo_max_mm"],
    ["material", "material"],
    ["region", "region"],
    ["activo", "activo"],
    ["notaValidacion", "nota_validacion"],
  ],
  equipos: [
    ["id", "id"],
    ["empresaId", "empresa_id"],
    ["categoria", "categoria"],
    ["codigo", "codigo"],
    ["nombre", "nombre"],
    ["largo", "largo_int_mm"],
    ["ancho", "ancho_int_mm"],
    ["alto", "alto_int_mm"],
    ["alturaUtil", "altura_util_mm"],
    ["puertaAncho", "puerta_ancho_mm"],
    ["puertaAlto", "puerta_alto_mm"],
    ["cargaUtil", "carga_util_kg"],
    ["tara", "tara_kg"],
    ["tieneTecho", "tiene_techo"],
    ["tieneParedes", "tiene_paredes"],
    ["costoReferencia", "costo_referencia"],
    ["moneda", "moneda"],
    ["notaValidacion", "nota_validacion"],
    ["activo", "activo"],
  ],
  transportistas: [
    ["id", "id"],
    ["empresaId", "empresa_id"],
    ["nombre", "nombre"],
    ["modo", "modo"],
    ["divisorVolumetrico", "divisor_volumetrico"],
    ["factorKgM3", "factor_kg_m3"],
    ["redondeo", "redondeo"],
    ["minimoCobrable", "minimo_cobrable"],
    ["tarifaPorKg", "tarifa_por_kg"],
    ["tarifaPorM3", "tarifa_por_m3"],
    ["moneda", "moneda"],
  ],
  almacenes: [
    ["id", "id"],
    ["empresaId", "empresa_id"],
    ["nombre", "nombre"],
    ["largo", "largo_mm"],
    ["ancho", "ancho_mm"],
    ["alturaLibre", "altura_libre_mm"],
    ["holguraRociadores", "holgura_rociadores_mm"],
  ],
};

const NUMERICAS = new Set([
  "peso_kg",
  "densidad_kg_m3",
  "max_peso_encima_kg",
  "ect_lb_in",
  "calibre_in",
  "tara_kg",
  "carga_max_kg",
  "carga_util_kg",
  "costo_referencia",
  "divisor_volumetrico",
  "factor_kg_m3",
  "redondeo",
  "minimo_cobrable",
  "tarifa_por_kg",
  "tarifa_por_m3",
]);

function deFila(e: Entidad, f: Record<string, unknown>) {
  const r: Record<string, unknown> = {};
  for (const [campo, col] of MAPAS[e]) {
    const v = f[col];
    r[campo] = NUMERICAS.has(col) && v != null ? Number(v) : v;
  }
  if (e === "materiales") {
    const o = (f.orientaciones_permitidas ?? {}) as Record<string, boolean>;
    r.orientaciones = TODAS_ORIENTACIONES.filter((k) => o[k]);
  }
  return r;
}

function aFila(e: Entidad, r: Record<string, unknown>) {
  const f: Record<string, unknown> = {};
  for (const [campo, col] of MAPAS[e])
    if (campo in r && !(campo === "id" && !r.id)) f[col] = r[campo] ?? null;
  if (e === "materiales") {
    const ors = (r.orientaciones ?? []) as CodigoOrientacion[];
    f.orientaciones_permitidas = Object.fromEntries(
      TODAS_ORIENTACIONES.map((k) => [k, ors.includes(k)]),
    );
  }
  return f;
}

export const repoSupabase: Repositorio = {
  modo: "supabase",
  async listar<E extends Entidad>(e: E) {
    const { data, error } = await supabase()
      .from(e)
      .select("*")
      .order("nombre");
    if (error) throw errorDatos(error.code);
    return (data ?? []).map((f) =>
      deFila(e, f),
    ) as unknown as RegistroPorEntidad[E][];
  },
  async guardar<E extends Entidad>(e: E, r: RegistroPorEntidad[E]) {
    validarRegistro(e, r);
    const { data, error } = await supabase()
      .from(e)
      .upsert(aFila(e, r as unknown as Record<string, unknown>))
      .select()
      .single();
    if (error) throw errorDatos(error.code);
    return deFila(e, data) as unknown as RegistroPorEntidad[E];
  },
  async borrar(e, id) {
    const { error } = await supabase().from(e).delete().eq("id", id);
    if (error) throw errorDatos(error.code);
  },
};
