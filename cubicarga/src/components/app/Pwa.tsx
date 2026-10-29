"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
type Instalar = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export function Pwa() {
  const ruta = usePathname();
  const promptRef = useRef<Instalar | null>(null),
    [disponible, setDisponible] = useState(false),
    [offline, setOffline] = useState(false),
    [listo, setListo] = useState(false);
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    )
      return;
    const instalar = (e: Event) => {
        e.preventDefault();
        promptRef.current = e as Instalar;
        setDisponible(true);
      },
      red = () => setOffline(!navigator.onLine),
      mensaje = (e: MessageEvent) => {
        if (e.data?.tipo === "OFFLINE_LISTO") setListo(true);
      };
    window.addEventListener("beforeinstallprompt", instalar);
    window.addEventListener("online", red);
    window.addEventListener("offline", red);
    navigator.serviceWorker.addEventListener("message", mensaje);
    // Preparar el uso offline al entrar a la aplicación evita descargar
    // el motor y sus herramientas durante la primera pintura de la landing.
    if (ruta !== "/")
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .then(() => {
          setListo(true);
          red();
        })
        .catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", instalar);
      window.removeEventListener("online", red);
      window.removeEventListener("offline", red);
      navigator.serviceWorker.removeEventListener("message", mensaje);
    };
  }, [ruta]);
  return disponible || offline ? (
    <aside className="fixed bottom-3 left-3 z-40 max-w-[260px] rounded-lg border bg-card p-3 shadow-lg text-sm">
      {offline && (
        <p role="status">
          {listo
            ? "Sin conexión · calculadora y catálogos globales disponibles"
            : "Sin conexión"}
        </p>
      )}
      {disponible && (
        <Button
          size="sm"
          onClick={async () => {
            await promptRef.current?.prompt();
            setDisponible(false);
            promptRef.current = null;
          }}
        >
          Instalar CubiCarga
        </Button>
      )}
    </aside>
  ) : null;
}
