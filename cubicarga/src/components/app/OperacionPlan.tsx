"use client";
import { useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisorPlan } from "@/components/visor/VisorPlan";
import { listarPlantillas, guardarPlantilla } from "@/lib/planes/repositorio";
import { planParaExportar, escapar } from "@/lib/planes/exportar";
import type { EntradaMixta, PlanCarga } from "@/motor";
const sinEventos = (cb: () => void) => {
  window.addEventListener("popstate", cb);
  return () => window.removeEventListener("popstate", cb);
};
export function Plantillas({
  nombre,
  entrada,
  onAplicar,
}: {
  nombre: string;
  entrada: EntradaMixta | null;
  onAplicar: (e: EntradaMixta) => void;
}) {
  const {
    data = [],
    error,
    refetch,
  } = useQuery({ queryKey: ["plantillas"], queryFn: listarPlantillas });
  const [ocupado, setOcupado] = useState(false);
  return (
    <section className="flex flex-wrap items-center gap-3 rounded border p-3">
      <Label htmlFor="plantilla-recurrente">Carga recurrente</Label>
      <select
        id="plantilla-recurrente"
        className="max-w-full rounded border p-2"
        value=""
        onChange={(e) => {
          const p = data.find((p) => p.id === e.target.value);
          if (p) onAplicar(structuredClone(p.entrada));
        }}
      >
        <option value="">Selecciona una plantilla</option>
        {data.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        disabled={!entrada || ocupado}
        onClick={async () => {
          if (!entrada) return;
          setOcupado(true);
          try {
            await guardarPlantilla(nombre, entrada);
            await refetch();
            toast.success("Plantilla guardada");
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "No se pudo guardar");
          } finally {
            setOcupado(false);
          }
        }}
      >
        Guardar como plantilla
      </Button>
      {error && <p role="alert">No se pudieron cargar las plantillas.</p>}
    </section>
  );
}
export function Montacarguista({
  plan,
  nombre,
}: {
  plan: PlanCarga;
  nombre: string;
}) {
  const [abierto, setAbierto] = useState(false),
    [manual, setManual] = useState<number | null>(null),
    [cumplidos, setCumplidos] = useState<number[]>([]);
  const urlPaso = useSyncExternalStore(
    sinEventos,
    () => Number(new URLSearchParams(location.search).get("paso")) || 0,
    () => 0,
  );
  const pasos = [
    ...new Set([
      ...plan.colocaciones.map((c) => c.paso),
      ...plan.tarimasArmadas.map((t) => t.paso),
    ]),
  ].sort((a, b) => a - b);
  const actual =
      manual ?? (pasos.includes(urlPaso) ? urlPaso : (pasos[0] ?? 0)),
    idx = pasos.indexOf(actual);
  const cs = plan.colocaciones.filter((c) => c.paso === actual);
  const cerrar = () => {
    const u = new URL(location.href);
    u.searchParams.delete("paso");
    history.replaceState(null, "", u);
    window.dispatchEvent(new Event("popstate"));
    setAbierto(false);
    setManual(null);
  };
  return (
    <>
      <Button
        variant="outline"
        disabled={!pasos.length}
        onClick={() => setAbierto(true)}
      >
        Modo montacarguista
      </Button>
      <Dialog
        open={abierto || urlPaso > 0}
        onOpenChange={(v) => {
          if (v) setAbierto(true);
          else cerrar();
        }}
      >
        <DialogContent className="flex h-[92dvh] w-[95vw] max-w-none flex-col overflow-y-auto sm:max-w-none">
          <DialogTitle className="text-2xl">
            {nombre} · Paso {idx + 1} de {pasos.length}
          </DialogTitle>
          <p className="text-lg">
            Carga {cs.length} bulto(s)
            {plan.tarimasArmadas.some((t) => t.paso === actual)
              ? " de la tarima indicada"
              : " de esta fila"}
            .
          </p>
          <VisorPlan
            plan={plan}
            pasoExterno={actual}
            className="min-h-[320px] flex-1"
          />
          <ul className="text-lg">
            {cs.slice(0, 25).map((c, i) => (
              <li key={i}>
                {plan.materiales.find((m) => m.id === c.materialId)?.nombre} ·
                equipo {c.equipoIdx + 1} · {c.x}, {c.y}, {c.z} mm
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-3 text-xl">
            <input
              type="checkbox"
              checked={cumplidos.includes(actual)}
              onChange={(e) =>
                setCumplidos((xs) =>
                  e.target.checked
                    ? [...xs, actual]
                    : xs.filter((p) => p !== actual),
                )
              }
            />
            Paso cumplido
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              variant="outline"
              disabled={idx <= 0}
              onClick={() => setManual(pasos[idx - 1])}
            >
              Anterior
            </Button>
            <Button
              size="lg"
              disabled={idx >= pasos.length - 1}
              onClick={() => {
                setCumplidos((xs) =>
                  xs.includes(actual) ? xs : [...xs, actual],
                );
                setManual(pasos[idx + 1]);
              }}
            >
              Siguiente
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {cumplidos.length} pasos cumplidos durante esta sesión.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
export async function imprimirEtiquetas(plan: PlanCarga, enlace: string) {
  const p = planParaExportar(plan),
    u = new URL(enlace);
  if (
    !["http:", "https:"].includes(u.protocol) ||
    !/^\/p\/[A-Za-z0-9_-]{32}$/.test(u.pathname)
  )
    throw new Error("Usa un enlace compartido válido para el QR");
  if (!p.tarimasArmadas.length)
    throw new Error("Este plan no tiene tarimas para etiquetar");
  const w = window.open("", "_blank");
  if (!w) throw new Error("Permite la ventana de impresión");
  try {
    const { default: QRCode } = await import("qrcode");
    const etiquetas = [];
    for (const [i, t] of p.tarimasArmadas.entries()) {
      const url = new URL(u);
      url.searchParams.set("paso", String(t.paso));
      const qr = await QRCode.toDataURL(url.href, { width: 240, margin: 2 });
      etiquetas.push(
        `<section><h1>Tarima ${i + 1}</h1><p>Equipo ${t.equipoIdx + 1} · Paso ${t.paso}</p><p>${t.cajas} cajas · ${t.peso.toLocaleString("es-MX")} kg</p><img src="${qr}" alt="QR al paso de carga"/><p>${escapar(url.href)}</p></section>`,
      );
    }
    w.document.write(
      `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><title>Etiquetas CubiCarga</title><style>body{font:18px system-ui;color:#0F2A44}section{break-after:page;padding:25px;border:2px solid #0F2A44}img{width:180px}p{overflow-wrap:anywhere}@media print{button{display:none}}</style></head><body><button onclick="window.print()">Imprimir etiquetas</button>${etiquetas.join("")}</body></html>`,
    );
    w.document.close();
  } catch (e) {
    w.close();
    throw e;
  }
}
