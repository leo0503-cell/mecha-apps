import { ImageResponse } from "next/og";
import { leerCompartido } from "@/lib/planes/compartido";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const data = await leerCompartido((await params).token);
  if (!data)
    return new Response("Enlace vencido o revocado", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  const p = data.plan,
    e = p.equipos[0];
  const scale = e ? 550 / (e.largo + e.ancho) : 1;
  const proj = (x: number, y: number, z: number) => [
    90 + (x + y) * scale,
    370 + (y - x) * scale * 0.3 - z * scale,
  ];
  const poly = (vs: number[][]) =>
    vs.map((v) => v.map((n) => n.toFixed(1)).join(",")).join(" ");
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "#0F2A44",
        color: "white",
        padding: 40,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, color: "#F97316" }}>
        CubiCarga · Plan de carga
      </div>
      <div style={{ display: "flex", fontSize: 42, marginTop: 16 }}>
        {e?.codigo ?? "Plan"} ·{" "}
        {p.kpis.unidadesCargadas.toLocaleString("es-MX")} bultos ·{" "}
        {Math.round(p.kpis.pctVolumen * 100)}% volumen
      </div>
      <div style={{ display: "flex", position: "relative", flex: 1 }}>
        <svg width="750" height="420" viewBox="0 0 750 420">
          {p.colocaciones
            .filter((c) => c.equipoIdx === 0)
            .sort((a, b) => a.z - b.z || a.x - b.x)
            .map((c, i) => {
              const a = proj(c.x, c.y, c.z + c.h),
                b = proj(c.x + c.l, c.y, c.z + c.h),
                d = proj(c.x, c.y + c.a, c.z + c.h),
                cc = proj(c.x + c.l, c.y + c.a, c.z + c.h);
              const ab = proj(c.x, c.y, c.z),
                bb = proj(c.x + c.l, c.y, c.z),
                db = proj(c.x, c.y + c.a, c.z);
              return (
                <g key={i}>
                  <polygon
                    points={poly([a, b, cc, d])}
                    fill="#F97316"
                    stroke="#0F2A44"
                  />
                  <polygon
                    points={poly([a, b, bb, ab])}
                    fill="#C45E19"
                    stroke="#0F2A44"
                  />
                  <polygon
                    points={poly([a, d, db, ab])}
                    fill="#9A4410"
                    stroke="#0F2A44"
                  />
                </g>
              );
            })}
        </svg>
      </div>
      <div style={{ display: "flex", fontSize: 24 }}>
        {p.equipos.length > 1 ? `Vista equipo 1 de ${p.equipos.length} · ` : ""}
        {data.nombre.slice(0, 70)} · {p.kpis.pesoRealKg.toLocaleString("es-MX")}{" "}
        kg · {p.kpis.cbm.toFixed(2)} m³
      </div>
    </div>,
    { width: 1200, height: 630, headers: { "Cache-Control": "no-store" } },
  );
}
