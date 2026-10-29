"use client";
/** Con Supabase configurado, toma rol y empresa del perfil del usuario. */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crearSincronizador } from "@/lib/sincronizador";
import { hayBackend, supabase } from "@/lib/supabase/cliente";
import { useSesion, type Rol } from "@/lib/sesion";

export function SincronizarSesion() {
  const qc = useQueryClient();
  const setUsuario = useSesion((s) => s.setUsuario);
  useEffect(() => {
    if (!hayBackend) return;
    const sb = supabase();
    let viva = true;
    const publico = {
      email: null,
      rol: "publico" as const,
      empresaId: null,
      userId: null,
      lista: true,
    };
    const sincronizador = crearSincronizador(
      async () => {
        if (!navigator.onLine) return publico;
        const { data, error } = await sb.auth.getUser();
        if (error && error.name !== "AuthSessionMissingError") throw error;
        if (!data.user) return publico;
        const { data: p, error: errorPerfil } = await sb
          .from("perfiles")
          .select("rol, empresa_id")
          .eq("id", data.user.id)
          .single();
        if (errorPerfil) throw errorPerfil;
        return {
          email: data.user.email ?? null,
          rol: (p?.rol as Rol) ?? "visor",
          empresaId: p?.empresa_id ?? null,
          userId: data.user.id,
          lista: true,
        };
      },
      (u) => {
        const anterior = useSesion.getState();
        if (
          anterior.userId !== u.userId ||
          anterior.empresaId !== u.empresaId ||
          anterior.rol !== u.rol
        )
          qc.clear();
        setUsuario(u);
      },
      () => {
        if (!useSesion.getState().lista) {
          qc.clear();
          setUsuario(publico);
        }
        toast.error(
          "No se pudo verificar la sesión; revisa la conexión o vuelve a entrar",
        );
      },
    );
    void sincronizador.iniciar();
    const { data: sub } = sb.auth.onAuthStateChange((evento, sesion) => {
      if (!viva) return;
      if (
        evento === "SIGNED_OUT" ||
        useSesion.getState().userId !== (sesion?.user.id ?? null)
      ) {
        qc.clear();
        setUsuario({ ...publico, lista: false });
      }
      sincronizador.cambio();
    });
    const reconectar = () => sincronizador.cambio();
    window.addEventListener("online", reconectar);
    return () => {
      viva = false;
      window.removeEventListener("online", reconectar);
      sincronizador.detener();
      sub.subscription.unsubscribe();
    };
  }, [setUsuario, qc]);
  return null;
}
