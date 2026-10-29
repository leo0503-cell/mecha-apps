import { z } from "zod";
import type { Material } from "@/motor";
export const CABECERAS = [
  "sku",
  "nombre",
  "largo_mm",
  "ancho_mm",
  "alto_mm",
  "peso_kg",
  "cantidad",
  "parada",
];
const fila = z.object({
  sku: z.string().min(1),
  nombre: z.string().min(1),
  largo_mm: z.coerce.number().int().min(1).max(20000),
  ancho_mm: z.coerce.number().int().min(1).max(20000),
  alto_mm: z.coerce.number().int().min(1).max(20000),
  peso_kg: z.coerce.number().positive().max(40000),
  cantidad: z.coerce.number().int().positive().max(1000000),
  parada: z.coerce.number().int().positive(),
});
export interface ItemCarga {
  material: Material;
  cantidad: number;
}
/** CSV RFC4180: comillas, separadores y saltos de línea dentro de campos. */
export function leerCsv(texto: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === '"') {
      if (quoted && texto[i + 1] === '"') {
        field += '"';
        i++;
      } else if (!quoted && field.length)
        throw new Error(
          "CSV inválido: comillas dentro de un campo sin delimitar",
        );
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((v) => v.length)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("CSV inválido: falta cerrar comillas");
  row.push(field);
  if (row.some((v) => v.length)) rows.push(row);
  return rows;
}
export function validarPacking(rows: unknown[][]): {
  items: ItemCarga[];
  errores: string[];
} {
  if (rows.length > 5001)
    throw new Error("La importación admite hasta 5,000 filas de carga");
  const headers = (rows[0] ?? []).map((h) =>
    String(h)
      .trim()
      .replace(/^\uFEFF/, ""),
  );
  if (CABECERAS.some((h) => !headers.includes(h)))
    throw new Error(
      `Usa la plantilla con las columnas: ${CABECERAS.join(", ")}`,
    );
  const items: ItemCarga[] = [],
    errores: string[] = [];
  const ids = new Set<string>();
  rows.slice(1).forEach((r, i) => {
    const raw = Object.fromEntries(headers.map((h, j) => [h, r[j] ?? ""]));
    if (!raw.parada) raw.parada = 1;
    const result = fila.safeParse(raw);
    if (!result.success) {
      errores.push(
        `Fila ${i + 2}: revisa ${result.error.issues.map((x) => x.path.join(".")).join(", ")}`,
      );
      return;
    }
    const d = result.data,
      id = `${d.sku}@${d.parada}`;
    if (ids.has(id)) {
      errores.push(
        `Fila ${i + 2}: SKU/parada repetidos (${d.sku}); combina sus cantidades`,
      );
      return;
    }
    ids.add(id);
    items.push({
      cantidad: d.cantidad,
      material: {
        id,
        sku: d.sku,
        nombre: d.nombre,
        largo: d.largo_mm,
        ancho: d.ancho_mm,
        alto: d.alto_mm,
        peso: d.peso_kg,
        paradaDescarga: d.parada,
        orientaciones: ["LAH", "LHA", "ALH", "AHL", "HLA", "HAL"],
        apilable: true,
        color: "#0072B2",
      },
    });
  });
  return { items, errores };
}
/** Revisa tamaños descomprimidos antes de cargar XLSX para limitar archivos comprimidos hostiles. */
export function validarZipXlsx(buffer: ArrayBuffer): void {
  const view = new DataView(buffer);
  let end = -1;
  for (
    let i = view.byteLength - 22;
    i >= Math.max(0, view.byteLength - 65557);
    i--
  ) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("XLSX inválido o dañado");
  const entries = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true),
    size = 0;
  if (entries > 512)
    throw new Error("El XLSX contiene demasiados archivos internos");
  for (let n = 0; n < entries; n++) {
    if (at + 46 > view.byteLength || view.getUint32(at, true) !== 0x02014b50)
      throw new Error("XLSX inválido");
    size += view.getUint32(at + 24, true);
    if (size > 50 * 1024 * 1024)
      throw new Error("El XLSX excede el límite de contenido descomprimido");
    at +=
      46 +
      view.getUint16(at + 28, true) +
      view.getUint16(at + 30, true) +
      view.getUint16(at + 32, true);
  }
}
export async function importarPacking(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("El archivo excede 5 MB");
  if (/\.csv$/i.test(file.name))
    return validarPacking(leerCsv(await file.text()));
  if (!/\.xlsx$/i.test(file.name))
    throw new Error("Selecciona un archivo .xlsx o .csv");
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  validarZipXlsx(buffer);
  await book.xlsx.load(buffer);
  const sheet = book.worksheets[0];
  if (!sheet) throw new Error("El libro no tiene hojas");
  if (sheet.actualRowCount > 5001 || sheet.rowCount > 5001)
    throw new Error("El libro excede 5,000 filas");
  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: unknown[] = [];
    row.eachCell({ includeEmpty: true }, (cell, index) => {
      const v = cell.value;
      if (v && typeof v === "object")
        throw new Error(
          `Fila ${row.number}: no se admiten fórmulas, hipervínculos ni objetos`,
        );
      values[index - 1] = v;
    });
    rows.push(values);
  });
  return validarPacking(rows);
}
