/** KPIs y centro de gravedad de un plan. */
import type {
  Cog,
  Colocacion,
  Equipo,
  KpisEquipo,
  Material,
  ParametrosCalculo,
  TarimaArmada,
} from "./tipos";

export function volumenUtil(e: Equipo): number {
  return (e.largo * e.ancho * e.alturaUtil) / 1e9;
}

export function calcularPorEquipo(
  equipos: Equipo[],
  colocaciones: Colocacion[],
  tarimas: TarimaArmada[],
  materiales: Map<string, Material>,
  taras: Map<string, number>,
  p: Pick<ParametrosCalculo, "toleranciaCogLong" | "toleranciaCogLat">,
): KpisEquipo[] {
  return equipos.map((e, equipoIdx) => {
    let unidades = 0;
    let peso = 0;
    let vol = 0;
    let mx = 0;
    let my = 0;
    let mz = 0;
    for (const c of colocaciones) {
      if (c.equipoIdx !== equipoIdx) continue;
      const w = materiales.get(c.materialId)?.peso ?? 0;
      unidades++;
      peso += w;
      vol += c.l * c.a * c.h;
      mx += w * (c.x + c.l / 2);
      my += w * (c.y + c.a / 2);
      mz += w * (c.z + c.h / 2);
    }
    for (const t of tarimas) {
      if (t.equipoIdx !== equipoIdx) continue;
      const w = taras.get(t.tarimaId) ?? 0;
      peso += w;
      vol += t.l * t.a * t.hTarima;
      mx += w * (t.x + t.l / 2);
      my += w * (t.y + t.a / 2);
      mz += w * (t.z + t.hTarima / 2);
    }
    const volumenM3 = vol / 1e9;
    let cog: Cog | null = null;
    if (peso > 0) {
      const x = mx / peso;
      const y = my / peso;
      const desvLongitudinal = (x - e.largo / 2) / e.largo;
      const desvLateral = (y - e.ancho / 2) / e.ancho;
      cog = {
        x: Math.round(x),
        y: Math.round(y),
        z: Math.round(mz / peso),
        desvLongitudinal,
        desvLateral,
        fueraDeTolerancia:
          Math.abs(desvLongitudinal) > p.toleranciaCogLong ||
          Math.abs(desvLateral) > p.toleranciaCogLat,
      };
    }
    return {
      equipoIdx,
      unidades,
      pesoKg: Math.round(peso * 1000) / 1000,
      volumenM3,
      pctVolumen: volumenM3 / volumenUtil(e),
      pctPeso: e.cargaUtil ? peso / e.cargaUtil : 0,
      cog,
    };
  });
}

/** COG global ponderado por peso (para un solo equipo es el mismo). */
export function cogGlobal(porEquipo: KpisEquipo[]): Cog | null {
  const con = porEquipo.filter((k) => k.cog);
  if (con.length === 0) return null;
  if (con.length === 1) return con[0].cog;
  // En flota, se reporta el peor caso.

  return con.reduce((peor, k) => {
    if (k.cog!.fueraDeTolerancia !== peor.cog!.fueraDeTolerancia)
      return k.cog!.fueraDeTolerancia ? k : peor;
    return Math.max(
      Math.abs(k.cog!.desvLongitudinal),
      Math.abs(k.cog!.desvLateral),
    ) >
      Math.max(
        Math.abs(peor.cog!.desvLongitudinal),
        Math.abs(peor.cog!.desvLateral),
      )
      ? k
      : peor;
  }).cog;
}
