import { actualizarKpis, validarPlan, type PlanCarga } from "@/motor";
export function planParaExportar(p: PlanCarga): PlanCarga {
  const errores = validarPlan(p);
  if (errores.length)
    throw new Error(`Corrige el plan antes de exportar: ${errores[0].mensaje}`);
  if (p.avisos.some((a) => a.codigo === "sin_dibujo"))
    throw new Error(
      "Este cálculo tiene solo un resumen; reduce la cantidad para generar el plan completo",
    );
  return actualizarKpis(p);
}
export function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function escapar(v: unknown) {
  return String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function vistaSuperiorSvg(p: PlanCarga, ei = 0, capa?: number) {
  const e = p.equipos[ei];
  if (!e) return "";
  const cols = p.colocaciones
    .filter(
      (c) =>
        c.equipoIdx === ei &&
        (capa == null || (c.z <= capa && c.z + c.h > capa)),
    )
    .sort((a, b) => a.z - b.z);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 -80 ${e.largo + 160} ${e.ancho + 160}" width="900" height="240"><rect width="${e.largo}" height="${e.ancho}" fill="#E5E7EB" stroke="#0F2A44" stroke-width="20"/>${cols.map((c) => `<rect x="${c.x}" y="${c.y}" width="${c.l}" height="${c.a}" fill="#F97316" stroke="#0F2A44" stroke-width="6"/>`).join("")}<path d="M${e.largo},0 V${e.ancho}" stroke="#F97316" stroke-width="40"/></svg>`;
}
/** Proyección de todas las posiciones del equipo, independiente del paso visible. */
export function vistaIsometricaSvg(p: PlanCarga, ei = 0) {
  const e = p.equipos[ei];
  if (!e) return "";
  const spanY = e.alto + (e.largo + e.ancho) * 0.25;
  const escala = Math.min(680 / (e.largo + e.ancho), 380 / spanY);
  const origenX = (760 - (e.largo + e.ancho) * escala) / 2;
  const origenY =
    (440 - spanY * escala) / 2 + (e.alto + e.largo * 0.25) * escala;
  const proy = (x: number, y: number, z: number) => [
    origenX + (x + y) * escala,
    origenY + (y - x) * escala * 0.25 - z * escala,
  ];
  const puntos = (ps: number[][]) =>
    ps.map((v) => v.map((n) => n.toFixed(2)).join(",")).join(" ");
  const cajas = p.colocaciones
    .filter((c) => c.equipoIdx === ei)
    .sort((a, b) => a.z - b.z || b.x + b.y - a.x - a.y);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 440" width="900" height="440" role="img" aria-label="Vista isométrica completa del equipo ${ei + 1}"><polygon points="${puntos([proy(0, 0, 0), proy(e.largo, 0, 0), proy(e.largo, e.ancho, 0), proy(0, e.ancho, 0)])}" fill="#E5E7EB" stroke="#0F2A44"/>${cajas
    .map((c) => {
      const a = proy(c.x, c.y, c.z + c.h),
        b = proy(c.x + c.l, c.y, c.z + c.h),
        d = proy(c.x, c.y + c.a, c.z + c.h),
        f = proy(c.x + c.l, c.y + c.a, c.z + c.h),
        ab = proy(c.x, c.y, c.z),
        bb = proy(c.x + c.l, c.y, c.z),
        db = proy(c.x, c.y + c.a, c.z);
      return `<g><polygon points="${puntos([a, b, bb, ab])}" fill="#C45E19" stroke="#0F2A44"/><polygon points="${puntos([a, d, db, ab])}" fill="#9A4410" stroke="#0F2A44"/><polygon points="${puntos([a, b, f, d])}" fill="#F97316" stroke="#0F2A44"/></g>`;
    })
    .join("")}</svg>`;
}
export async function exportarExcel(plan: PlanCarga) {
  const p = planParaExportar(plan);
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  const resumen = book.addWorksheet("Resumen");
  resumen.addRows([
    ["CubiCarga", p.versionMotor],
    ["Bultos", p.kpis.unidadesCargadas],
    ["Peso kg", p.kpis.pesoRealKg],
    ["Volumen m³", p.kpis.cbm],
    ["Factor", p.kpis.factorLimitante],
  ]);
  const filas = book.addWorksheet("Plan");
  filas.addRow([
    "Paso",
    "Equipo",
    "SKU",
    "X mm",
    "Y mm",
    "Z mm",
    "Largo mm",
    "Ancho mm",
    "Alto mm",
    "Orientación",
    "Tarima",
  ]);
  for (const c of p.colocaciones) {
    const m = p.materiales.find((m) => m.id === c.materialId);
    filas.addRow([
      c.paso,
      c.equipoIdx + 1,
      m?.sku ?? m?.nombre ?? c.materialId,
      c.x,
      c.y,
      c.z,
      c.l,
      c.a,
      c.h,
      c.orientacion,
      c.tarimaIdx == null ? "" : c.tarimaIdx + 1,
    ]);
  }
  const no = book.addWorksheet("No cargados");
  no.addRow(["Material", "Cantidad", "Motivo"]);
  p.noCargados.forEach((n) => no.addRow([n.materialId, n.cantidad, n.motivo]));
  const avisos = book.addWorksheet("Avisos");
  p.avisos.forEach((a) => avisos.addRow([a.nivel, a.mensaje]));
  book.eachSheet((s) => {
    s.columns.forEach((c) => {
      c.width = 22;
    });
    s.getRow(1).font = { bold: true };
  });
  const buffer = await book.xlsx.writeBuffer();
  descargar(
    new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "cubicarga-plan.xlsx",
  );
}
export function htmlInforme(plan: PlanCarga, png?: string) {
  const p = planParaExportar(plan);
  const pasos = [...new Set(p.colocaciones.map((c) => c.paso))].sort(
    (a, b) => a - b,
  );
  return `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>Plan de carga CubiCarga</title><style>body{font:14px system-ui;color:#0F2A44;margin:25px}section{break-inside:avoid;margin-bottom:20px}svg,img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:5px}h1,h2{color:#0F2A44}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Imprimir / guardar PDF</button><h1>Plan de carga CubiCarga</h1><p>${p.kpis.unidadesCargadas.toLocaleString("es-MX")} bultos · ${p.kpis.pesoRealKg.toLocaleString("es-MX")} kg · ${p.kpis.cbm.toFixed(2)} m³</p>${png && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png) ? `<img src="${png}" alt="Vista 3D del acomodo"/>` : ""}${p.equipos
    .map(
      (e, ei) =>
        `<section><h2>${escapar(e.nombre)} #${ei + 1}</h2>${vistaIsometricaSvg(p, ei)}${vistaSuperiorSvg(p, ei)}${[
          ...new Set(
            p.colocaciones.filter((c) => c.equipoIdx === ei).map((c) => c.z),
          ),
        ]
          .sort((a, b) => a - b)
          .map((z) => `<h3>Capa a ${z} mm</h3>${vistaSuperiorSvg(p, ei, z)}`)
          .join("")}</section>`,
    )
    .join("")}<h2>Paso a paso</h2>${pasos
    .map(
      (n) =>
        `<section><h3>Paso ${n}</h3><ul>${p.colocaciones
          .filter((c) => c.paso === n)
          .map(
            (c) =>
              `<li>${escapar(p.materiales.find((m) => m.id === c.materialId)?.nombre)} · equipo ${c.equipoIdx + 1} · (${c.x}, ${c.y}, ${c.z}) mm · ${c.l}×${c.a}×${c.h} mm</li>`,
          )
          .join("")}</ul></section>`,
    )
    .join(
      "",
    )}<h2>No cargados</h2><ul>${p.noCargados.map((n) => `<li>${escapar(n.materialId)}: ${n.cantidad} · ${escapar(n.motivo)}</li>`).join("") || "<li>Ninguno</li>"}</ul><h2>Avisos</h2><ul>${p.avisos.map((a) => `<li>${escapar(a.mensaje)}</li>`).join("")}</ul></body></html>`;
}
export function imprimirPlan(plan: PlanCarga, png?: string) {
  const html = htmlInforme(plan, png);
  const w = window.open("", "_blank");
  if (!w)
    throw new Error("Permite ventanas emergentes para imprimir el informe");
  w.document.write(html);
  w.document.close();
}
export async function exportarPng(
  plan: PlanCarga,
  canvas?: HTMLCanvasElement | null,
) {
  planParaExportar(plan);
  if (canvas) {
    const png = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!png) throw new Error("No se pudo capturar el plan");
    descargar(png, "cubicarga-plan.png");
    return;
  }
  const svg = vistaSuperiorSvg(plan);
  const blob = new Blob([svg], { type: "image/svg+xml" }),
    url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 1800;
    c.height = 480;
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const result = await new Promise<Blob | null>((r) =>
      c.toBlob(r, "image/png"),
    );
    if (!result) throw new Error("No se pudo capturar el plan");
    descargar(result, "cubicarga-plan.png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
