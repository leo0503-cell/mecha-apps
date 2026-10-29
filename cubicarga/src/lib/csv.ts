/** Excel interpreta =,+,-,@ como fórmulas aun dentro de una celda CSV entre comillas. */
export function celdaCsv(v: unknown): string {
  let s = Array.isArray(v) ? v.join("|") : v == null ? "" : String(v);
  if (typeof v !== "number" && /^[\u0000-\u0020]*[=+\-@]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
