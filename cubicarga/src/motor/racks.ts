import { z } from "zod";
const positivo = z.number().int().positive();
const esquema = z.object({
  frente: positivo,
  fondo: positivo,
  niveles: positivo,
  bahias: positivo,
  alturaNivel: positivo,
  holguraLateral: z.number().int().nonnegative(),
  holguraVertical: z.number().int().nonnegative(),
  peralte: z.number().int().nonnegative(),
  cargaNivel: z.number().positive().nullable(),
  tarimaAncho: positivo,
  tarimaLargo: positivo,
  alturaArmada: positivo,
});
export type EntradaRack = z.infer<typeof esquema>;
export function capacidadRack(entrada: EntradaRack) {
  const p = esquema.parse(entrada);
  const cabeAlto =
    p.alturaArmada + p.holguraVertical + p.peralte <= p.alturaNivel;
  const cabeFondo = p.tarimaLargo <= p.fondo;
  const porNivel =
    cabeAlto && cabeFondo
      ? Math.max(
          0,
          Math.floor(
            (p.frente - p.holguraLateral) / (p.tarimaAncho + p.holguraLateral),
          ),
        )
      : 0;
  const posiciones = porNivel * p.niveles * p.bahias;
  return {
    posiciones,
    porNivel,
    m3: (posiciones * p.tarimaAncho * p.tarimaLargo * p.alturaArmada) / 1e9,
    kg:
      p.cargaNivel == null
        ? null
        : posiciones > 0
          ? p.cargaNivel * p.niveles * p.bahias
          : 0,
    avisos: [
      ...(!cabeAlto
        ? ["La tarima armada no cabe en la altura libre del nivel"]
        : []),
      ...(!cabeFondo ? ["La tarima rebasa el fondo del rack"] : []),
      ...(p.cargaNivel == null
        ? ["Confirma la carga máxima por nivel con el proveedor del rack"]
        : []),
    ],
  };
}
