import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServidor } from "@/lib/supabase/servidor";
import { CuerpoExcedido, leerJsonLimitado, esMismoOrigen } from "@/lib/http";
const esquema = z.object({ calculoId: z.uuid() });
export async function POST(request: Request) {
  if (!esMismoOrigen(request))
    return NextResponse.json(
      { error: "Solicitud de otro origen no permitida" },
      { status: 403 },
    );
  try {
    const d = esquema.safeParse(await leerJsonLimitado(request, 16 * 1024));
    if (!d.success)
      return NextResponse.json({ error: "Cálculo inválido" }, { status: 400 });
    const sb = await supabaseServidor();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Inicia sesión" }, { status: 401 });
    const { data, error } = await sb
      .from("links_compartidos")
      .insert({ calculo_id: d.data.calculoId })
      .select("token")
      .single();
    if (error)
      return NextResponse.json(
        { error: "No tienes permiso para compartir este cálculo" },
        { status: 403 },
      );
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof CuerpoExcedido)
      return NextResponse.json(
        { error: "Solicitud demasiado grande" },
        { status: 413 },
      );
    return NextResponse.json(
      { error: "No se pudo crear el enlace" },
      { status: 400 },
    );
  }
}
export async function DELETE(request: Request) {
  if (!esMismoOrigen(request))
    return NextResponse.json(
      { error: "Solicitud de otro origen no permitida" },
      { status: 403 },
    );
  try {
    const token = new URL(request.url).searchParams.get("token");
    if (!token || !/^[A-Za-z0-9_-]{32}$/.test(token))
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    const sb = await supabaseServidor();
    const { data, error } = await sb
      .from("links_compartidos")
      .update({ activo: false })
      .eq("token", token)
      .select("id");
    if (error || !data?.length)
      return NextResponse.json(
        { error: "No tienes permiso para revocar este enlace" },
        { status: 403 },
      );
    return NextResponse.json({ revocado: true });
  } catch {
    return NextResponse.json(
      { error: "No se pudo revocar el enlace" },
      { status: 400 },
    );
  }
}
