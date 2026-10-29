"use client";
/** Preferencias y sesión del usuario (persisten en el navegador). */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UnidadLongitud, UnidadPeso } from "@/motor";

export type Rol = "publico" | "visor" | "planeador" | "admin" | "superadmin";

interface Sesion {
  /** En modo local (sin Supabase) el rol se elige para probar permisos. */
  rol: Rol;
  email: string | null;
  empresaId: string | null;
  userId: string | null;
  lista: boolean;
  unidadLong: UnidadLongitud;
  unidadPeso: UnidadPeso;
  setRol: (r: Rol) => void;
  setUsuario: (u: {
    email: string | null;
    rol: Rol;
    empresaId: string | null;
    userId?: string | null;
    lista?: boolean;
  }) => void;
  setUnidades: (l: UnidadLongitud, p: UnidadPeso) => void;
}

export const useSesion = create<Sesion>()(
  persist(
    (set) => ({
      rol: "planeador",
      email: null,
      empresaId: "local",
      userId: null,
      lista: false,
      unidadLong: "mm",
      unidadPeso: "kg",
      setRol: (rol) => set({ rol }),
      setUsuario: (u) =>
        set({ ...u, userId: u.userId ?? null, lista: u.lista ?? false }),
      setUnidades: (unidadLong, unidadPeso) => set({ unidadLong, unidadPeso }),
    }),
    {
      name: "cubicarga-sesion",
      partialize: (s) => ({
        rol: s.rol,
        email: s.email,
        empresaId: s.empresaId,
        userId: s.userId,
        unidadLong: s.unidadLong,
        unidadPeso: s.unidadPeso,
      }),
    },
  ),
);

export const puedeEditar = (r: Rol) =>
  r === "planeador" || r === "admin" || r === "superadmin";
export const esAdmin = (r: Rol) => r === "admin" || r === "superadmin";

/** Qué rol puede escribir cada catálogo de empresa (igual que las políticas RLS). */
export function puedeEscribir(entidad: string, rol: Rol): boolean {
  if (entidad === "materiales") return puedeEditar(rol);
  return esAdmin(rol);
}
