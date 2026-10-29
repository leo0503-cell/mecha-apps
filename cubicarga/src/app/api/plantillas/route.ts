import { NextResponse } from "next/server";
import { z } from "zod";
import { esquemaEntradaMixta } from "@/motor";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { CuerpoExcedido, leerJsonLimitado, esMismoOrigen } from "@/lib/http";
const esquema = z.object({
  nombre: z.string().trim().min(1).max(120),
  entrada: esquemaEntradaMixta,
});
export async function POST(request: Request) {
  if (!esMismoOrigen(request))
    return NextResponse.json(
      { error: "Solicitud de otro origen no permitida" },
      { status: 403 },
    );
  try {
    const sb = await supabaseServidor();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
    if (Number(request.headers.get("content-length") ?? 0) > 5 * 1024 * 1024)
      return NextResponse.json(
        { error: "La plantilla excede 5 MB" },
        { status: 413 },
      );
    const d = esquema.safeParse(await leerJsonLimitado(request));
    if (!d.success)
      return NextResponse.json(
        { error: "Plantilla inválida" },
        { status: 400 },
      );
    const { data: perfil } = await sb
      .from("perfiles")
      .select("empresa_id")
      .eq("id", user.id)
      .single();
    if (!perfil?.empresa_id)
      return NextResponse.json(
        { error: "Asocia tu cuenta a una empresa" },
        { status: 403 },
      );
    const { error } = await sb.from("plantillas_carga").insert({
      nombre: d.data.nombre,
      entrada_json: d.data.entrada,
      empresa_id: perfil.empresa_id,
      creado_por: user.id,
    });
    if (error)
      return NextResponse.json(
        { error: "No tienes permiso para guardar plantillas" },
        { status: 403 },
      );
    return NextResponse.json({ guardado: true }, { status: 201 });
  } catch (error) {
    if (error instanceof CuerpoExcedido)
      return NextResponse.json(
        { error: "La plantilla excede 5 MB" },
        { status: 413 },
      );
    return NextResponse.json(
      { error: "No se pudo guardar la plantilla" },
      { status: 400 },
    );
  }
}
