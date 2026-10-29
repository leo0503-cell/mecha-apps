import { NextResponse } from "next/server";
import { leerCompartido } from "@/lib/planes/compartido";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const p = await leerCompartido((await params).token);
  return p
    ? NextResponse.json(p, { headers: { "Cache-Control": "no-store" } })
    : NextResponse.json(
        { error: "El enlace no existe, venció o fue revocado" },
        { status: 404 },
      );
}
