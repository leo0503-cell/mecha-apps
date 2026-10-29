import Dexie, { type Table } from "dexie";
import type { EntradaMixta, PlanCarga } from "@/motor";
import { planParaExportar } from "./exportar";
import { hayBackend, supabase } from "@/lib/supabase/cliente";
export interface EscenarioGuardado {
  id: string;
  nombre: string;
  entrada: EntradaMixta;
  plan: PlanCarga;
  fecha: string;
  proyectoId?: string;
  versionDe?: string;
  numeroVersion: number;
}
export interface PlantillaCarga {
  id: string;
  nombre: string;
  entrada: EntradaMixta;
  fecha: string;
}
class Archivo extends Dexie {
  plantillas!: Table<PlantillaCarga, string>;
  escenarios!: Table<EscenarioGuardado, string>;
  constructor() {
    super("cubicarga-proyectos");
    this.version(1).stores({ escenarios: "id,fecha,nombre" });
    this.version(2)
      .stores({
        escenarios: "id,fecha,nombre,versionDe",
        plantillas: "id,nombre,fecha",
      })
      .upgrade((tx) =>
        tx
          .table("escenarios")
          .toCollection()
          .modify((r) => {
            r.numeroVersion ??= 1;
          }),
      );
  }
}
let archivo: Archivo | null = null;
const local = () => (archivo ??= new Archivo());
export async function listarEscenarios(): Promise<EscenarioGuardado[]> {
  if (!hayBackend)
    return local().escenarios.orderBy("fecha").reverse().toArray();
  const { data, error } = await supabase()
    .from("calculos")
    .select(
      "id,proyecto_id,nombre_escenario,plan_json,entrada_json,created_at,version_de,numero_version",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar tus proyectos");
  return (data ?? [])
    .filter((c) => c.plan_json && c.entrada_json)
    .map((c) => ({
      id: c.id,
      proyectoId: c.proyecto_id,
      nombre: c.nombre_escenario,
      plan: c.plan_json,
      entrada: c.entrada_json,
      fecha: c.created_at,
      versionDe: c.version_de ?? undefined,
      numeroVersion: c.numero_version ?? 1,
    }));
}
export async function guardarEscenario(
  nombre: string,
  entrada: EntradaMixta,
  plan: PlanCarga,
  proyectoId?: string,
  versionDe?: string,
): Promise<string> {
  const seguro = planParaExportar(plan);
  if (!nombre.trim()) throw new Error("Escribe un nombre para el escenario");
  if (!hayBackend) {
    return local().transaction("rw", local().escenarios, async () => {
      const id = crypto.randomUUID();
      const base = versionDe ? await local().escenarios.get(versionDe) : null;
      if (versionDe && !base)
        throw new Error("No se encontró la versión original");
      const raiz = base?.versionDe ?? base?.id;
      const anteriores = raiz
        ? await local()
            .escenarios.filter((r) => r.id === raiz || r.versionDe === raiz)
            .toArray()
        : [];
      await local().escenarios.add({
        id,
        nombre,
        entrada,
        plan: seguro,
        fecha: new Date().toISOString(),
        versionDe: raiz,
        numeroVersion: anteriores.length
          ? Math.max(...anteriores.map((r) => r.numeroVersion ?? 1)) + 1
          : 1,
      });
      return id;
    });
  }
  const r = await fetch("/api/calculos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nombre,
      entrada,
      plan: seguro,
      proyectoId,
      versionDe,
    }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? "No se pudo guardar el cálculo");
  return d.id;
}
export async function compartirEscenario(id: string): Promise<string> {
  if (!hayBackend)
    throw new Error(
      "Los enlaces públicos requieren conectar Supabase y guardar el escenario en tu cuenta",
    );
  const r = await fetch("/api/compartir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calculoId: id }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? "No se pudo compartir");
  return new URL(`/p/${d.token}`, location.origin).href;
}

export async function listarPlantillas(): Promise<PlantillaCarga[]> {
  if (!hayBackend)
    return local().plantillas.orderBy("fecha").reverse().toArray();
  const { data, error } = await supabase()
    .from("plantillas_carga")
    .select("id,nombre,entrada_json,created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error("No se pudieron cargar las plantillas");
  return (data ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    entrada: r.entrada_json,
    fecha: r.created_at,
  }));
}
export async function guardarPlantilla(
  nombre: string,
  entrada: EntradaMixta,
): Promise<void> {
  if (!nombre.trim()) throw new Error("Escribe un nombre para la plantilla");
  if (!hayBackend) {
    await local().plantillas.add({
      id: crypto.randomUUID(),
      nombre,
      entrada,
      fecha: new Date().toISOString(),
    });
    return;
  }
  const r = await fetch("/api/plantillas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, entrada }),
  });
  if (!r.ok) throw new Error("No se pudo guardar la plantilla en tu empresa");
}
