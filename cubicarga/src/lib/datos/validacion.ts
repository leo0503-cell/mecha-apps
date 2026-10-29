import { CATALOGOS, esquemaDe } from "@/components/app/catalogos/config";
import type { Entidad } from "./tipos";
export function validarRegistro(e: Entidad, registro: unknown): void {
  const r = esquemaDe(CATALOGOS[e].campos).safeParse(registro);
  if (!r.success)
    throw new Error(
      `Revisa los datos: ${r.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
}
export function errorDatos(code?: string): Error {
  return new Error(
    code === "42501"
      ? "No tienes permiso para modificar este catálogo"
      : code === "23505"
        ? "Ya existe un registro con ese identificador o SKU"
        : code?.startsWith("23")
          ? "Revisa las medidas, cantidades y referencias del registro"
          : "No se pudo guardar o consultar el catálogo; revisa tu conexión",
  );
}
