import { areaTraslape, IndiceXY } from "./geometria";
import type { Colocacion, PlanCarga } from "./tipos";
/** Conserva la cadena de apoyo necesaria para mantener un bulto bloqueado. */
export function bloquearConApoyos(
  plan: PlanCarga,
  elegidos: number[],
): number[] {
  const indices = new Map<number, IndiceXY<Colocacion & { i: number }>>();
  plan.colocaciones.forEach((c, i) => {
    let ix = indices.get(c.equipoIdx);
    if (!ix) indices.set(c.equipoIdx, (ix = new IndiceXY()));
    ix.agregar({ ...c, i });
  });
  const bloqueados = new Set(
      elegidos.filter((i) => plan.colocaciones[i] != null),
    ),
    cola = [...bloqueados];
  for (let k = 0; k < cola.length; k++) {
    const c = plan.colocaciones[cola[k]];
    if (c.z === 0) continue;
    for (const abajo of indices.get(c.equipoIdx)!.vecinos(c)) {
      if (
        abajo.z + abajo.h === c.z &&
        areaTraslape(c, abajo) > 0 &&
        !bloqueados.has(abajo.i)
      ) {
        bloqueados.add(abajo.i);
        cola.push(abajo.i);
      }
    }
  }
  return [...bloqueados];
}
