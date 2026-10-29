"use client";
/** Visor con controles: vistas, color, corte, secuencia paso a paso y detalle del bulto. */
import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { NOMBRE_ORIENTACION, type Colocacion, type PlanCarga } from "@/motor";
import { dims, peso } from "@/components/app/formato";
import { useSesion } from "@/lib/sesion";
import { cn } from "@/lib/utils";
import VistaSvg from "./VistaSvg";
import type { ColorPor, VistaVisor } from "./Visor3D";

const Visor3D = dynamic(() => import("./Visor3D"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const sinSuscripcion = () => () => {};

let webglCache: boolean | null = null;
function hayWebGL() {
  if (webglCache != null) return webglCache;
  try {
    const c = document.createElement("canvas");
    return (webglCache = Boolean(
      c.getContext("webgl2") || c.getContext("webgl"),
    ));
  } catch {
    return (webglCache = false);
  }
}

const VISTAS: { v: VistaVisor; t: string }[] = [
  { v: "iso", t: "Isométrica" },
  { v: "puerta", t: "Desde la puerta" },
  { v: "lateral", t: "Lateral" },
  { v: "superior", t: "Superior" },
];

export function VisorPlan({
  plan,
  className,
  onSeleccionGlobal,
  pasoExterno,
  onRotar,
  onDeshacer,
}: {
  plan: PlanCarga;
  className?: string;
  onSeleccionGlobal?: (i: number | null) => void;
  pasoExterno?: number;
  onRotar?: () => void;
  onDeshacer?: () => void;
}) {
  const { unidadLong, unidadPeso } = useSesion();
  const reducido = useReducedMotion() ?? false;
  const [simple, setSimple] = useState(false),
    [velocidad, setVelocidad] = useState(1),
    [explotar, setExplotar] = useState(false);
  const webgl = useSyncExternalStore(sinSuscripcion, hayWebGL, () => null);
  const [equipoSeleccionado, setEquipoIdx] = useState(0);
  const equipoIdx = Math.min(
    equipoSeleccionado,
    Math.max(0, plan.equipos.length - 1),
  );
  const [vista, setVista] = useState<VistaVisor>("iso");
  const [colorPor, setColorPor] = useState<ColorPor>("sku");
  const [corte, setCorte] = useState(1);
  const [sel, setSel] = useState<{ c: Colocacion; i: number } | null>(null);
  const pasos = useMemo(() => {
    const ps = plan.colocaciones
      .filter((c) => c.equipoIdx === equipoIdx)
      .map((c) => c.paso);
    const ts = plan.tarimasArmadas
      .filter((t) => t.equipoIdx === equipoIdx)
      .map((t) => t.paso);
    const todos = [...ps, ...ts];
    return {
      min: todos.length ? Math.min(...todos) : 0,
      max: todos.length ? Math.max(...todos) : 0,
    };
  }, [plan, equipoIdx]);
  const [paso, setPaso] = useState(pasos.max);
  const [animando, setAnimando] = useState(false);

  const [planPrevio, setPlanPrevio] = useState(plan);
  if (planPrevio !== plan) {
    setPlanPrevio(plan);
    setPaso(pasos.max);
    setSel(null);
    if (equipoSeleccionado >= plan.equipos.length) setEquipoIdx(0);
  }

  useEffect(() => {
    if (!animando) return;
    const cajas = plan.colocaciones.filter(
      (c) => c.equipoIdx === equipoIdx && c.paso === paso,
    ).length;
    const t = setTimeout(
      () => {
        if (paso >= pasos.max) setAnimando(false);
        else setPaso((p) => p + 1);
      },
      Math.max(300 / velocidad, (cajas * 300) / velocidad),
    );
    return () => clearTimeout(t);
  }, [animando, paso, pasos, plan, equipoIdx, velocidad]);

  const mat = sel
    ? plan.materiales.find((m) => m.id === sel.c.materialId)
    : null;
  const encima = sel
    ? plan.colocaciones.filter(
        (d) =>
          d.equipoIdx === sel.c.equipoIdx &&
          d.z === sel.c.z + sel.c.h &&
          d.x < sel.c.x + sel.c.l &&
          sel.c.x < d.x + d.l &&
          d.y < sel.c.y + sel.c.a &&
          sel.c.y < d.y + d.a,
      ).length
    : 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 focus-visible:outline-2 focus-visible:outline-primary",
        className,
      )}
      tabIndex={0}
      role="region"
      aria-label="Visor del plan de carga"
      onKeyDown={(e) => {
        if ((e.target as HTMLElement).closest("input,textarea,select,button"))
          return;
        if (["1", "2", "3", "4"].includes(e.key)) {
          setVista(VISTAS[Number(e.key) - 1].v);
          e.preventDefault();
        } else if (e.code === "Space" && pasoExterno == null) {
          if (reducido) {
            setPaso(pasos.max);
            setAnimando(false);
            return;
          }
          if (paso >= pasos.max) setPaso(Math.max(0, pasos.min - 1));
          setAnimando((a) => !a);
          e.preventDefault();
        } else if (e.key.toLowerCase() === "r") {
          if (onRotar) onRotar();
          else setVista((v) => (v === "iso" ? "puerta" : "iso"));
          e.preventDefault();
        } else if (
          (e.ctrlKey || e.metaKey) &&
          e.key.toLowerCase() === "z" &&
          onDeshacer
        ) {
          onDeshacer();
          e.preventDefault();
        }
      }}
    >
      {plan.equipos.length > 1 && (
        <div
          className="flex flex-wrap gap-1"
          role="tablist"
          aria-label="Equipo"
        >
          {plan.equipos.map((e, i) => (
            <Button
              key={i}
              size="sm"
              variant={i === equipoIdx ? "default" : "outline"}
              onClick={() => {
                setEquipoIdx(i);
                setSel(null);
                setAnimando(false);
                setPaso(
                  Math.max(
                    0,
                    ...plan.colocaciones
                      .filter((c) => c.equipoIdx === i)
                      .map((c) => c.paso),
                    ...plan.tarimasArmadas
                      .filter((t) => t.equipoIdx === i)
                      .map((t) => t.paso),
                  ),
                );
              }}
              role="tab"
              aria-selected={i === equipoIdx}
            >
              {e.codigo} #{i + 1}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={simple}
            onChange={(e) => setSimple(e.target.checked)}
          />
          Modo simple
        </label>
        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={explotar}
            onChange={(e) => setExplotar(e.target.checked)}
          />
          Explotar capas
        </label>
        <label className="flex gap-2 items-center">
          Velocidad
          <select
            className="rounded border px-2 py-1"
            aria-label="Velocidad de carga"
            value={velocidad}
            onChange={(e) => setVelocidad(Number(e.target.value))}
          >
            {[0.5, 1, 2, 4].map((v) => (
              <option key={v} value={v}>
                {v}×
              </option>
            ))}
          </select>
        </label>
        {reducido && <span>Movimiento reducido activo</span>}
      </div>
      <div className="relative min-h-[320px] flex-1 overflow-hidden rounded-lg border bg-[var(--visor-fondo)]">
        {webgl === null ? (
          <Skeleton className="absolute inset-0" />
        ) : webgl ? (
          <div className="absolute inset-0">
            <Visor3D
              plan={plan}
              equipoIdx={equipoIdx}
              paso={pasoExterno ?? paso}
              vista={vista}
              colorPor={colorPor}
              corte={corte}
              simple={simple}
              reducido={reducido}
              velocidad={velocidad}
              explotar={explotar ? 250 : 0}
              onLento={() => setSimple(true)}
              seleccion={sel?.i ?? null}
              onSeleccion={(c, i) => {
                setSel(c && i != null ? { c, i } : null);
                onSeleccionGlobal?.(i);
              }}
            />
          </div>
        ) : (
          <div className="p-3">
            <p className="mb-2 text-sm text-muted-foreground">
              Tu navegador no tiene WebGL: te mostramos la vista superior.
            </p>
            <VistaSvg plan={plan} equipoIdx={equipoIdx} />
          </div>
        )}
        {webgl && (
          <div className="relative z-10 m-2 flex flex-wrap gap-1">
            {VISTAS.map((x) => (
              <Button
                key={x.v}
                size="xs"
                variant={vista === x.v ? "default" : "secondary"}
                onClick={() => setVista(x.v)}
              >
                {x.t}
              </Button>
            ))}
          </div>
        )}
        {webgl && (
          <div className="relative z-10 m-2 flex flex-wrap gap-1">
            <Button
              size="xs"
              variant={colorPor === "sku" ? "default" : "secondary"}
              onClick={() => setColorPor("sku")}
            >
              Color por SKU
            </Button>
            <Button
              size="xs"
              variant={colorPor === "peso" ? "default" : "secondary"}
              onClick={() => setColorPor("peso")}
            >
              Por peso
            </Button>
          </div>
        )}
        {sel && mat && (
          <div
            className="absolute bottom-2 left-2 right-2 rounded-lg border bg-card/95 p-3 text-sm shadow-sm sm:right-auto sm:w-80"
            aria-live="polite"
          >
            <div className="font-medium">
              {mat.sku ? `${mat.sku} · ` : ""}
              {mat.nombre}
            </div>
            <dl className="num mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-xs">
              <dt className="text-muted-foreground">Medidas</dt>
              <dd>{dims(sel.c.l, sel.c.a, sel.c.h, unidadLong)}</dd>
              <dt className="text-muted-foreground">Peso</dt>
              <dd>{peso(mat.peso, unidadPeso)}</dd>
              <dt className="text-muted-foreground">Orientación</dt>
              <dd>{NOMBRE_ORIENTACION[sel.c.orientacion]}</dd>
              <dt className="text-muted-foreground">Posición</dt>
              <dd>
                x {sel.c.x} · y {sel.c.y} · z {sel.c.z} mm
              </dd>
              <dt className="text-muted-foreground">Encima</dt>
              <dd>{encima} bulto(s)</dd>
              <dt className="text-muted-foreground">Paso</dt>
              <dd>
                {sel.c.paso}
                {sel.c.tarimaIdx != null
                  ? ` (tarima #${sel.c.tarimaIdx + 1})`
                  : ""}
              </dd>
            </dl>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Con el visor enfocado: 1–4 vistas · espacio secuencia · R{" "}
        {onRotar ? "rota el bulto seleccionado" : "cambia la vista"}
        {onDeshacer ? " · Ctrl+Z deshacer" : ""}.
      </p>
      {pasos.max > 0 && pasoExterno == null && (
        <div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (reducido) {
                setPaso(pasos.max);
                setAnimando(false);
                return;
              }
              if (paso >= pasos.max) setPaso(Math.max(0, pasos.min - 1));
              setAnimando((a) => !a);
            }}
            aria-label={animando ? "Pausar secuencia" : "Reproducir secuencia"}
          >
            {animando ? <Pause /> : <Play />} Secuencia
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Paso
            </span>
            <Slider
              aria-label="Paso de carga"
              min={pasos.min}
              max={pasos.max}
              step={1}
              value={[paso]}
              onValueChange={(v) => {
                setAnimando(false);
                setPaso(Array.isArray(v) ? v[0] : v);
              }}
            />
            <span className="num w-20 text-right text-sm">
              {paso}/{pasos.max}
            </span>
          </div>
          {webgl && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Corte</span>
              <Slider
                aria-label="Plano de corte"
                className="w-28"
                min={0.05}
                max={1}
                step={0.01}
                value={[corte]}
                onValueChange={(v) => setCorte(Array.isArray(v) ? v[0] : v)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
