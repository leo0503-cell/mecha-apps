import type { Equipo, Material, PresetOrientacion, Tarima } from "@/motor";

export type Entidad =
  "materiales" | "tarimas" | "equipos" | "transportistas" | "almacenes";

interface Base {
  id: string;
  /** null = catálogo global (solo lectura para empresas). */
  empresaId: string | null;
  activo?: boolean;
}

export type MaterialReg = Base &
  Material & {
    preset: PresetOrientacion;
    densidad?: number | null;
    unidadesPorBulto?: number;
    hsCode?: string | null;
    notas?: string | null;
  };

export type TarimaReg = Base &
  Tarima & { region?: string | null; notaValidacion?: string | null };

export type EquipoReg = Base & Equipo;

export type ModoTransportista =
  "aereo" | "lcl" | "fcl" | "ltl" | "ftl" | "paqueteria";

export type TransportistaReg = Base & {
  nombre: string;
  modo: ModoTransportista;
  divisorVolumetrico?: number | null;
  factorKgM3?: number | null;
  redondeo?: number | null;
  minimoCobrable?: number | null;
  tarifaPorKg?: number | null;
  tarifaPorM3?: number | null;
  moneda: "MXN" | "USD";
};

export type AlmacenReg = Base & {
  nombre: string;
  largo: number;
  ancho: number;
  alturaLibre: number;
  holguraRociadores: number;
};

export interface RegistroPorEntidad {
  materiales: MaterialReg;
  tarimas: TarimaReg;
  equipos: EquipoReg;
  transportistas: TransportistaReg;
  almacenes: AlmacenReg;
}

/** Interfaz común de los repositorios (local IndexedDB o Supabase). */
export interface Repositorio {
  modo: "local" | "supabase";
  listar<E extends Entidad>(e: E): Promise<RegistroPorEntidad[E][]>;
  guardar<E extends Entidad>(
    e: E,
    r: RegistroPorEntidad[E],
  ): Promise<RegistroPorEntidad[E]>;
  borrar(e: Entidad, id: string): Promise<void>;
}
