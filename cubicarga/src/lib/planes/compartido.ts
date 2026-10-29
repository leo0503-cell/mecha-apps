import "server-only";
import { createClient } from "@supabase/supabase-js";
import { actualizarKpis, validarPlan, type PlanCarga } from "@/motor";
export async function leerCompartido(
  token: string,
): Promise<{ nombre: string; plan: PlanCarga; expira: string } | null> {
  if (!/^[A-Za-z0-9_-]{32}$/.test(token)) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const { data, error } = await createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).rpc("obtener_plan_compartido", { p_token: token });
  if (error || !data?.plan || validarPlan(data.plan).length) return null;
  const p = actualizarKpis(data.plan as PlanCarga);
  // Proyección pública explícita; omite empresa, costo, notas privadas y campos extra.
  return {
    nombre: String(data.nombre),
    expira: String(data.expira),
    plan: {
      ...p,
      materiales: p.materiales.map((m) => ({
        id: m.id,
        sku: m.sku,
        nombre: m.nombre,
        largo: m.largo,
        ancho: m.ancho,
        alto: m.alto,
        peso: m.peso,
        orientaciones: m.orientaciones,
        apilable: m.apilable,
        maxCapas: m.maxCapas,
        maxPesoEncima: m.maxPesoEncima,
        fragil: m.fragil,
        paradaDescarga: m.paradaDescarga,
        color: m.color,
      })),
      equipos: p.equipos.map((e) => ({
        id: e.id,
        codigo: e.codigo,
        nombre: e.nombre,
        categoria: e.categoria,
        largo: e.largo,
        ancho: e.ancho,
        alto: e.alto,
        alturaUtil: e.alturaUtil,
        puertaAncho: e.puertaAncho,
        puertaAlto: e.puertaAlto,
        cargaUtil: e.cargaUtil,
      })),
    },
  };
}
