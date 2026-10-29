export class CuerpoExcedido extends Error {
  constructor() {
    super("La solicitud excede el tamaño permitido");
  }
}
/** Los endpoints con cookies no aceptan mutaciones desde otro origen web. */
export function esMismoOrigen(request: Request): boolean {
  const origen = request.headers.get("origin");
  if (origen)
    return (
      origen === new URL(process.env.NEXT_PUBLIC_SITE_URL || request.url).origin
    );
  return !["cross-site", "same-site"].includes(
    request.headers.get("sec-fetch-site") ?? "",
  );
}
/** Límite real, también sin Content-Length; cancela la lectura al superar la cota. */
export async function leerJsonLimitado(
  request: Request,
  max = 5 * 1024 * 1024,
): Promise<unknown> {
  if (Number(request.headers.get("content-length") ?? 0) > max)
    throw new CuerpoExcedido();
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Falta el contenido de la solicitud");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > max) {
        await reader.cancel();
        throw new CuerpoExcedido();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(bytes);
  let offset = 0;
  for (const c of chunks) {
    buffer.set(c, offset);
    offset += c.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(buffer));
}
