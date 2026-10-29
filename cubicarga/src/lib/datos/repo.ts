"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { hayBackend } from "../supabase/cliente";
import { repoLocal } from "./local";
import { repoSupabase } from "./supabase";
import type { Entidad, RegistroPorEntidad, Repositorio } from "./tipos";

const elegido: Repositorio = hayBackend ? repoSupabase : repoLocal;
export const repo: Repositorio = {
  ...elegido,
  async listar(e) {
    if (hayBackend && typeof navigator !== "undefined" && !navigator.onLine) {
      if (e === "equipos" || e === "tarimas")
        return (await repoLocal.listar(e)).filter((r) => r.empresaId == null);
      return [];
    }
    return elegido.listar(e);
  },
};

export function useCatalogo<E extends Entidad>(e: E) {
  return useQuery({ queryKey: ["catalogo", e], queryFn: () => repo.listar(e) });
}

export function useGuardar<E extends Entidad>(e: E) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (r: RegistroPorEntidad[E]) => repo.guardar(e, r),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalogo", e] }),
  });
}

export function useBorrar(e: Entidad) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => repo.borrar(e, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalogo", e] }),
  });
}
