import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { CuerpoExcedido, leerJsonLimitado, esMismoOrigen } from "@/lib/http";
import {
  esquemaPlanEstructura,
  esquemaEntradaMixta,
  actualizarKpis,
  validarPlan,
  type PlanCarga,
} from "@/motor";
const esquema = z.object({
  nombre: z.string().trim().min(1).max(120),
  proyectoId: z.uuid().optional(),
  versionDe: z.uuid().optional(),
  plan: esquemaPlanEstructura,
  entrada: esquemaEntradaMixta,
});
export async function POST(request: Request) {
  if (!esMismoOrigen(request))
    return NextResponse.json(
      { error: "Solicitud de otro origen no permitida" },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length") ?? 0) > 5 * 1024 * 1024)
    return NextResponse.json({ error: "El plan excede 5 MB" }, { status: 413 });
  try {
    const sb = await supabaseServidor();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
    const d = esquema.safeParse(await leerJsonLimitado(request));
    if (!d.success)
      return NextResponse.json(
        { error: "Datos del cálculo inválidos" },
        { status: 400 },
      );
    const p = d.data.plan as unknown as PlanCarga;
    if (validarPlan(p).length)
      return NextResponse.json(
        { error: "El plan contiene violaciones" },
        { status: 422 },
      );
    const seguro = actualizarKpis(p);
    const { data, error } = d.data.versionDe
      ? await sb.rpc("guardar_version", {
          p_base: d.data.versionDe,
          p_nombre: d.data.nombre,
          p_plan: seguro,
          p_entrada: d.data.entrada,
        })
      : await sb.rpc("guardar_calculo", {
          p_nombre: d.data.nombre,
          p_plan: seguro,
          p_entrada: d.data.entrada,
          p_proyecto: d.data.proyectoId ?? null,
        });
    if (error)
      return NextResponse.json(
        { error: "No tienes permiso para guardar este proyecto" },
        { status: 403 },
      );
    return NextResponse.json({ id: data }, { status: 201 });
  } catch (error) {
    if (error instanceof CuerpoExcedido)
      return NextResponse.json(
        { error: "El plan excede 5 MB" },
        { status: 413 },
      );
    return NextResponse.json(
      {
        error: "No se pudo guardar el cálculo; revisa la conexión y los datos",
      },
      { status: 400 },
    );
  }
}
