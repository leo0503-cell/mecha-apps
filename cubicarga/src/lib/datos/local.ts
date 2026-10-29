import { validarRegistro } from "./validacion";
/**
 * Repositorio local en IndexedDB (Dexie). Funciona sin conexión y sin cuenta:
 * es el modo de la calculadora pública y de la app cuando Supabase no está
 * configurado. Se siembra con el catálogo global y los materiales demo.
 */
import Dexie, { type Table } from "dexie";
import {
  EQUIPOS_GLOBALES,
  MATERIALES_DEMO,
  NOTA_VALIDACION,
  TARIMAS_GLOBALES,
} from "@/motor";
import type {
  AlmacenReg,
  Entidad,
  EquipoReg,
  MaterialReg,
  RegistroPorEntidad,
  Repositorio,
  TarimaReg,
  TransportistaReg,
} from "./tipos";

export const EMPRESA_LOCAL = "local";
const VERSION_SEMILLA = 1;

class BaseLocal extends Dexie {
  materiales!: Table<MaterialReg, string>;
  tarimas!: Table<TarimaReg, string>;
  equipos!: Table<EquipoReg, string>;
  transportistas!: Table<TransportistaReg, string>;
  almacenes!: Table<AlmacenReg, string>;
  meta!: Table<{ clave: string; valor: number }, string>;
  constructor() {
    super("cubicarga");
    this.version(1).stores({
      materiales: "id, empresaId, sku, nombre",
      tarimas: "id, empresaId, nombre",
      equipos: "id, empresaId, codigo, categoria",
      transportistas: "id, empresaId, nombre",
      almacenes: "id, empresaId, nombre",
      meta: "clave",
    });
  }
}

let db: BaseLocal | null = null;
let sembrado: Promise<void> | null = null;

function base(): BaseLocal {
  if (!db) db = new BaseLocal();
  return db;
}

function presetDe(m: {
  orientaciones: string[];
  tipo?: string;
}): MaterialReg["preset"] {
  if (m.orientaciones.length === 6) return "libre";
  if (m.tipo === "tablero" || m.tipo === "costal") return "plano";
  return "este_lado_arriba";
}

async function sembrar() {
  const d = base();
  const v = await d.meta.get("semilla");
  if (v && v.valor >= VERSION_SEMILLA) return;
  await d.transaction(
    "rw",
    [d.equipos, d.tarimas, d.materiales, d.almacenes, d.meta],
    async () => {
      await d.equipos.bulkPut(
        EQUIPOS_GLOBALES.map((e) => ({ ...e, empresaId: null, activo: true })),
      );
      await d.tarimas.bulkPut(
        TARIMAS_GLOBALES.map((t) => ({
          ...t,
          empresaId: null,
          activo: true,
          notaValidacion: NOTA_VALIDACION,
        })),
      );
      await d.materiales.bulkPut(
        MATERIALES_DEMO.map((m) => ({
          ...m,
          empresaId: EMPRESA_LOCAL,
          preset: presetDe(m),
          unidadesPorBulto: 1,
          activo: true,
        })),
      );
      await d.almacenes.put({
        id: "alm-demo",
        empresaId: EMPRESA_LOCAL,
        nombre: "Nave demo",
        largo: 40000,
        ancho: 25000,
        alturaLibre: 9000,
        holguraRociadores: 457,
      });
      await d.meta.put({ clave: "semilla", valor: VERSION_SEMILLA });
    },
  );
}

function listo() {
  if (!sembrado) sembrado = sembrar();
  return sembrado;
}

export const repoLocal: Repositorio = {
  modo: "local",
  async listar<E extends Entidad>(e: E) {
    await listo();
    const filas = await (
      base()[e] as unknown as Table<RegistroPorEntidad[E], string>
    ).toArray();
    return filas;
  },
  async guardar<E extends Entidad>(e: E, r: RegistroPorEntidad[E]) {
    validarRegistro(e, r);
    await listo();
    if (r.empresaId == null)
      throw new Error(
        "El catálogo global es de solo lectura. Duplícalo para tu empresa.",
      );
    const reg = { ...r, id: r.id || crypto.randomUUID() };
    await (base()[e] as unknown as Table<RegistroPorEntidad[E], string>).put(
      reg,
    );
    return reg;
  },
  async borrar(e, id) {
    await listo();
    const t = base()[e] as unknown as Table<
      { empresaId: string | null },
      string
    >;
    const r = await t.get(id);
    if (r && r.empresaId == null)
      throw new Error("El catálogo global es de solo lectura.");
    await t.delete(id);
  },
};

/** Restablece el catálogo local (útil si se borró algo por error). */
export async function restablecerLocal() {
  await base().delete();
  db = null;
  sembrado = null;
  await listo();
}
