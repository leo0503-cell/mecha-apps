"use client";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, PackageX } from "lucide-react";
import { textoLimitante, type PlanCarga } from "@/motor";
import { useSesion } from "@/lib/sesion";
import { cn } from "@/lib/utils";
import { num, pct, peso } from "./formato";

const MOTIVO: Record<string, string> = {
  peso: "peso",
  volumen: "volumen (no cabe)",
  puerta: "no pasa por la puerta",
  apilado: "restricción de apilado",
  altura_tarima: "altura de tarima",
  orden_descarga: "bloqueo en el orden de descarga",
  limite_busqueda: "presupuesto de búsqueda agotado",
  limite_equipos: "se llegó al máximo de equipos",
};

export function Barra({
  etiqueta,
  valor,
  limita,
}: {
  etiqueta: string;
  valor: number;
  limita: boolean;
}) {
  const v = Math.min(1, Math.max(0, valor));
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className={cn(limita && "font-semibold")}>
          {etiqueta}
          {limita && " · limita"}
        </span>
        <span className="num">{pct(valor, 1)}</span>
      </div>
      <div
        className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(v * 100)}
        aria-label={etiqueta}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-400 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none",
            v >= 0.9
              ? "bg-red-600"
              : v >= 0.75
                ? "bg-amber-500"
                : "bg-green-600",
          )}
          style={{ width: `${v * 100}%` }}
        />
      </div>
    </div>
  );
}

function Conteo({ valor }: { valor: string }) {
  const reducido = useReducedMotion(),
    m = valor.match(/^-?[\d,]+(?:\.\d+)?/),
    objetivo = m ? Number(m[0].replaceAll(",", "")) : 0;
  const value = useMotionValue(0),
    decimales = m?.[0].split(".")[1]?.length ?? 0;
  const texto = useTransform(
    value,
    (v) => num(v, decimales) + (m ? valor.slice(m[0].length) : ""),
  );
  useEffect(() => {
    if (reducido) {
      value.set(objetivo);
      return;
    }
    const c = animate(value, objetivo, {
      duration: 0.4,
      ease: [0.2, 0.8, 0.2, 1],
    });
    return () => c.stop();
  }, [objetivo, value, reducido]);
  return m ? <motion.span>{texto}</motion.span> : <span>{valor}</span>;
}
function Kpi({
  etiqueta,
  valor,
  sub,
}: {
  etiqueta: string;
  valor: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{etiqueta}</div>
      <div className="num text-xl font-semibold leading-tight">
        <Conteo valor={valor} />
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function PanelResultado({
  plan,
  duracionMs,
  compacto = false,
}: {
  plan: PlanCarga;
  duracionMs?: number;
  compacto?: boolean;
}) {
  const { unidadPeso } = useSesion();
  const k = plan.kpis;
  const mats = new Map(plan.materiales.map((m) => [m.id, m]));
  const tarimado = k.cajasPorTarima != null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Kpi
          etiqueta="Unidades cargadas"
          valor={num(k.unidadesCargadas)}
          sub={
            k.equiposUsados > 1 ? `en ${k.equiposUsados} equipos` : undefined
          }
        />
        <Kpi
          etiqueta={tarimado ? "Tarimas por equipo" : "Capas (máximo)"}
          valor={
            tarimado
              ? num(k.tarimasPorEquipo ?? 0)
              : num(Math.max(0, ...plan.colocaciones.map((c) => c.capa)))
          }
          sub={
            tarimado
              ? `${num(k.cajasPorTarima ?? 0)} cajas por tarima`
              : "La cantidad puede variar entre capas"
          }
        />
        <Kpi etiqueta="CBM de la carga" valor={`${num(k.cbm, 2)} m³`} />
        <Kpi
          etiqueta="Peso real"
          valor={peso(k.pesoRealKg, unidadPeso, 0)}
          sub={tarimado ? "incluye taras de tarima" : undefined}
        />
      </div>

      <div
        className={cn(
          "rounded-lg border p-3",
          k.factorLimitante === "ninguno"
            ? "border-ok/40"
            : "border-primary/50",
        )}
      >
        <p className="mb-2 font-medium">{textoLimitante(k)}</p>
        <div className="space-y-2">
          <Barra
            etiqueta="Peso"
            valor={k.pctPeso}
            limita={k.factorLimitante === "peso"}
          />
          <Barra
            etiqueta="Volumen"
            valor={k.pctVolumen}
            limita={k.factorLimitante === "volumen"}
          />
        </div>
      </div>

      {k.cog && !compacto && (
        <div className="rounded-lg border p-3 text-sm">
          <div className="flex items-center gap-2 font-medium">
            {k.cog.fueraDeTolerancia ? (
              <AlertTriangle className="size-4 text-aviso" aria-hidden />
            ) : (
              <CheckCircle2 className="size-4 text-ok" aria-hidden />
            )}
            Centro de gravedad
          </div>
          <p className="num mt-1 text-muted-foreground">
            {pct(k.cog.desvLongitudinal, 1)} longitudinal ·{" "}
            {pct(k.cog.desvLateral, 1)} lateral · altura {num(k.cog.z)} mm
          </p>
          <p className="text-xs text-muted-foreground">
            Tolerancia ±{pct(plan.parametros.toleranciaCogLong)} / ±
            {pct(plan.parametros.toleranciaCogLat)}
          </p>
        </div>
      )}

      {plan.noCargados.length > 0 && (
        <div className="rounded-lg border border-mal/40 p-3 text-sm">
          <div className="flex items-center gap-2 font-medium text-mal">
            <PackageX className="size-5" aria-hidden /> No cargados
          </div>
          <ul className="mt-1 space-y-0.5">
            {plan.noCargados.map((n, i) => (
              <li key={i}>
                <span className="num">{num(n.cantidad)}</span> ×{" "}
                {mats.get(n.materialId)?.nombre ?? n.materialId}:{" "}
                {MOTIVO[n.motivo] ?? n.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-1.5 text-sm">
        {plan.avisos.map((a, i) => (
          <li
            key={i}
            className={cn(
              "flex gap-2",
              a.nivel === "info" && "text-muted-foreground",
            )}
          >
            {a.nivel === "info" ? (
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-aviso"
                aria-hidden
              />
            )}
            <span>{a.mensaje}</span>
          </li>
        ))}
      </ul>
      {duracionMs != null && (
        <p className="text-xs text-muted-foreground">
          Motor v{plan.versionMotor} · {num(duracionMs)} ms
        </p>
      )}
    </div>
  );
}
