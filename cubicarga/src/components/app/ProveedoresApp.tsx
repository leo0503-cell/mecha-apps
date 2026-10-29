"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Fragment, Suspense, useState } from "react";
import { useSesion } from "@/lib/sesion";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Pwa } from "./Pwa";
import dynamic from "next/dynamic";
import { hayBackend } from "@/lib/supabase/config";
const SincronizarSesion = dynamic(
  () => import("./SincronizarSesion").then((m) => m.SincronizarSesion),
  { ssr: false },
);
function AmbitoSesion({ children }: { children: React.ReactNode }) {
  const { lista, userId, empresaId, rol } = useSesion();
  if (hayBackend && !lista)
    return (
      <p role="status" className="p-6">
        Verificando sesión…
      </p>
    );
  return (
    <Fragment key={hayBackend ? `${userId}:${empresaId}:${rol}` : "local"}>
      {children}
    </Fragment>
  );
}

export function ProveedoresApp({ children }: { children: React.ReactNode }) {
  const [qc] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, networkMode: "always" },
        },
      }),
  );
  return (
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        {hayBackend && <SincronizarSesion />}
        <Suspense fallback={null}>
          <Pwa />
        </Suspense>
        <AmbitoSesion>{children}</AmbitoSesion>
        <Toaster richColors position="top-center" />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
