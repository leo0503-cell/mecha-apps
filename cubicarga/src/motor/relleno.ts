import { calcularMixto } from "./mixto";
import { validarPlan } from "./validador";
import type { Material, PlanCarga } from "./tipos";
/** Capacidad adicional comprobada geométricamente, no división de volumen libre. */
export function sugerirRelleno(plan: PlanCarga, material: Material) {
  if (validarPlan(plan).length)
    throw new Error("Corrige el plan antes de buscar espacio adicional");
  if (plan.tarimasArmadas.length)
    throw new Error(
      "El relleno automático se calcula para carga suelta; recalcula las tarimas para cambiar su contenido",
    );
  const materiales = plan.materiales.some((m) => m.id === material.id)
    ? plan.materiales
    : [...plan.materiales, material];
  const items = materiales
    .map((m) => ({
      material: m,
      cantidad:
        plan.colocaciones.filter((c) => c.materialId === m.id).length +
        (m.id === material.id ? 100 : 0),
    }))
    .filter((i) => i.cantidad > 0);
  const r = calcularMixto({
    items,
    equipos: plan.equipos,
    parametros: plan.parametros,
    bloqueadas: plan.colocaciones,
  });
  const cantidad = r.colocaciones.length - plan.colocaciones.length;
  return {
    cantidad,
    alMenos: cantidad === 100,
    incompleta: r.noCargados.some((n) => n.motivo === "limite_busqueda"),
  };
}
