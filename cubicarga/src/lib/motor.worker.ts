/// <reference lib="webworker" />
/** Web Worker del motor: el cálculo no congela la interfaz. */
import * as Comlink from "comlink";
import {
  calcularHomogeneo,
  calcularMixto,
  sugerirRelleno,
  type PlanCarga,
  type Material,
  type EntradaMixta,
  evaluarEscenario,
  recomendar,
  type EntradaHomogeneo,
  type Escenario,
} from "@/motor";

// El progreso usa el canal del Worker: no crea MessagePorts por recálculo.
const progreso = (pct: number, mensaje: string) =>
  self.postMessage({ tipo: "cubicarga-progreso", pct, mensaje });

const api = {
  relleno(entrada: { plan: PlanCarga; material: Material }) {
    return sugerirRelleno(entrada.plan, entrada.material);
  },
  mixto(entrada: EntradaMixta) {
    const ini = performance.now();
    const plan = calcularMixto(entrada, progreso);
    return { plan, duracionMs: Math.round(performance.now() - ini) };
  },
  calcular(entrada: EntradaHomogeneo) {
    progreso?.(0.1, "Buscando el mejor acomodo");
    const ini = performance.now();
    const plan = calcularHomogeneo(entrada);
    progreso?.(1, "Listo");
    return { plan, duracionMs: Math.round(performance.now() - ini) };
  },
  comparar(escenarios: Escenario[]) {
    const ini = performance.now();
    const res = [];
    for (let i = 0; i < escenarios.length; i++) {
      progreso?.(
        i / escenarios.length,
        `Escenario ${i + 1} de ${escenarios.length}`,
      );
      res.push(evaluarEscenario(escenarios[i]));
    }
    progreso?.(1, "Listo");
    return {
      resultados: res,
      recomendado: recomendar(res),
      duracionMs: Math.round(performance.now() - ini),
    };
  },
};

export type ApiMotor = typeof api;
Comlink.expose(api);
