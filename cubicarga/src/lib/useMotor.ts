"use client";
/** Un cálculo activo, progreso real por etapa y cancelación del Worker. */
import * as Comlink from "comlink";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiMotor } from "./motor.worker";
type Estado = { corriendo: boolean; progreso: number; mensaje: string };
function crear() {
  const worker = new Worker(new URL("./motor.worker.ts", import.meta.url), {
    type: "module",
  });
  return { worker, api: Comlink.wrap<ApiMotor>(worker) };
}
export function useMotor() {
  const ref = useRef<ReturnType<typeof crear> | null>(null);
  const cancelado = useRef<(() => void) | null>(null);
  const generacion = useRef(0);
  const [estado, setEstado] = useState<Estado>({
    corriendo: false,
    progreso: 0,
    mensaje: "",
  });
  const detener = useCallback(() => {
    const actual = ref.current;
    ref.current = null;
    actual?.api[Comlink.releaseProxy]();
    actual?.worker.terminate();
    cancelado.current?.();
    cancelado.current = null;
  }, []);
  useEffect(
    () => () => {
      generacion.current++;
      detener();
    },
    [detener],
  );
  const correr = useCallback(
    async <K extends keyof ApiMotor>(
      fn: K,
      ...args: Parameters<ApiMotor[K]> extends [infer A, ...unknown[]]
        ? [A]
        : never
    ) => {
      const id = ++generacion.current;
      detener();
      let activo: ReturnType<typeof crear>;
      try {
        activo = crear();
      } catch {
        setEstado({ corriendo: false, progreso: 0, mensaje: "" });
        throw new Error(
          "El dispositivo no pudo iniciar el motor; vuelve a intentarlo",
        );
      }
      ref.current = activo;
      setEstado({ corriendo: true, progreso: 0, mensaje: "Preparando" });
      activo.worker.onmessage = (evento: MessageEvent<unknown>) => {
        const data = evento.data;
        if (
          generacion.current === id &&
          data &&
          typeof data === "object" &&
          "tipo" in data &&
          data.tipo === "cubicarga-progreso" &&
          "pct" in data &&
          typeof data.pct === "number" &&
          "mensaje" in data &&
          typeof data.mensaje === "string"
        )
          setEstado({
            corriendo: true,
            progreso: data.pct,
            mensaje: data.mensaje,
          });
      };
      const cancel = new Promise<never>((_, rej) => {
        cancelado.current = () => rej(new Error("cancelado"));
      });
      const fallo = new Promise<never>((_, reject) => {
        activo.worker.onerror = (e) => {
          e.preventDefault();
          reject(
            new Error(
              "No se pudo iniciar el motor; recarga la app y revisa la conexión",
            ),
          );
        };
        activo.worker.onmessageerror = () =>
          reject(new Error("No se pudo leer la respuesta del motor"));
      });
      try {
        const llamar = activo.api[fn] as unknown as (
          a: unknown,
        ) => Promise<unknown>;
        return (await Promise.race([
          llamar(args[0]),
          cancel,
          fallo,
        ])) as Awaited<ReturnType<ApiMotor[K]>>;
      } finally {
        if (generacion.current === id) {
          generacion.current++;
          cancelado.current = null;
          detener();
          setEstado({ corriendo: false, progreso: 0, mensaje: "" });
        }
      }
    },
    [detener],
  );
  const cancelar = useCallback(() => {
    generacion.current++;
    detener();
    setEstado({ corriendo: false, progreso: 0, mensaje: "" });
  }, [detener]);
  return { ...estado, correr, cancelar };
}
