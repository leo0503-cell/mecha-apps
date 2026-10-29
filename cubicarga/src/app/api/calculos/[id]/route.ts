import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServidor } from "@/lib/supabase/servidor";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json(
      { error: "Cálculo no encontrado" },
      { status: 404 },
    );
  try {
    const sb = await supabaseServidor();
    const { data, error } = await sb
      .from("calculos")
      .select(
        "id,nombre_escenario,plan_json,entrada_json,version_de,numero_version",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data)
      return NextResponse.json(
        { error: "Cálculo no encontrado" },
        { status: 404 },
      );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Cálculo no disponible" },
      { status: 503 },
    );
  }
}
