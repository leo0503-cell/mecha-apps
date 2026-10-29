export function seleccionCatalogo<T extends { id: string; codigo?: string }>(
  filas: T[],
  actual: string,
  preferido: string,
): string {
  return filas.some((f) => f.id === actual)
    ? actual
    : ((filas.find((f) => f.codigo === preferido) ?? filas[0])?.id ?? "");
}
