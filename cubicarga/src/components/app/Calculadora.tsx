"use client";
import { Ilustracion } from "./Ilustracion";
/** Calculadora rápida (sin cuenta): ¿cuántos caben de este material? */
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { seleccionCatalogo } from "@/lib/seleccion-catalogo";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Calculator, Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VisorPlan } from "@/components/visor/VisorPlan";
import { useCatalogo } from "@/lib/datos/repo";
import { useSesion } from "@/lib/sesion";
import { useMotor } from "@/lib/useMotor";
import {
  EQUIPOS_GLOBALES,
  orientacionesDePreset,
  RANGO_MEDIDA_MM,
  RANGO_PESO_KG,
  TARIMAS_GLOBALES,
  type EntradaHomogeneo,
  type Equipo,
  type Material,
  type PlanCarga,
  type ResultadoEscenario,
  type Tarima,
} from "@/motor";
import { CampoMedida } from "./CampoMedida";
import { num, pct } from "./formato";
import { PanelResultado } from "./PanelResultado";

const medida = z
  .number({ error: "Captura la medida" })
  .int()
  .min(RANGO_MEDIDA_MM.min, "Mínimo 1 mm")
  .max(RANGO_MEDIDA_MM.max, "Máximo 20,000 mm");
const esquema = z.object({
  equipoId: z.string().min(1),
  largo: medida,
  ancho: medida,
  alto: medida,
  peso: z
    .number({ error: "Captura el peso" })
    .min(RANGO_PESO_KG.min, "Mínimo 0.01 kg")
    .max(RANGO_PESO_KG.max, "Máximo 40,000 kg"),
  preset: z.enum(["libre", "este_lado_arriba", "plano"]),
  apilable: z.boolean(),
  maxCapas: z.number().int().min(1).max(200).nullable(),
  cantidad: z.number().int().min(1).max(1_000_000).nullable(),
  modoCarga: z.enum(["suelta", "paletizada"]),
  tarimaId: z.string(),
  alturaMaxArmada: z.number().int().min(300).max(4000).nullable(),
  dobleEstiba: z.boolean(),
  rotarTarima: z.boolean(),
  exportacion: z.boolean(),
});
type Datos = z.infer<typeof esquema>;

const COMPARAR = ["20DV", "40DV", "40HC", "45HC", "CS48", "CS53"];

function Campo({
  id,
  etiqueta,
  error,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {error && (
        <p className="text-xs text-mal" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

const selectCls =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm";

export function Calculadora() {
  const { unidadLong, unidadPeso } = useSesion();
  const motor = useMotor();
  const equiposQ = useCatalogo("equipos");
  const tarimasQ = useCatalogo("tarimas");
  const materialesQ = useCatalogo("materiales");
  const equipos: Equipo[] =
    (equiposQ.data?.filter((e) => e.activo !== false) as
      Equipo[] | undefined) ?? EQUIPOS_GLOBALES;
  const tarimas: Tarima[] =
    (tarimasQ.data?.filter((t) => t.activo !== false) as
      Tarima[] | undefined) ?? TARIMAS_GLOBALES;
  const [resultado, setResultado] = useState<{
    plan: PlanCarga;
    ms: number;
  } | null>(null);
  const [comparacion, setComparacion] = useState<{
    resultados: ResultadoEscenario[];
    recomendado: string | null;
  } | null>(null);

  const { control, handleSubmit, setValue, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      equipoId: "eq-40hc",
      largo: 600,
      ancho: 400,
      alto: 400,
      peso: 15,
      preset: "libre",
      apilable: true,
      maxCapas: null,
      cantidad: null,
      modoCarga: "suelta",
      tarimaId: "ta-gma",
      alturaMaxArmada: null,
      dobleEstiba: false,
      rotarTarima: true,
      exportacion: false,
    },
  });
  const modoCarga = useWatch({ control, name: "modoCarga" });
  const equipoActual = useWatch({ control, name: "equipoId" }),
    tarimaActual = useWatch({ control, name: "tarimaId" });
  useEffect(() => {
    const id = seleccionCatalogo(equipos, equipoActual, "40HC");
    if (id && id !== equipoActual) setValue("equipoId", id);
    const tid = seleccionCatalogo(tarimas, tarimaActual, "GMA");
    if (tid && tid !== tarimaActual) setValue("tarimaId", tid);
  }, [equipos, tarimas, equipoActual, tarimaActual, setValue]);
  const errores = formState.errors;

  const entradaDe = (d: Datos, equipo: Equipo): EntradaHomogeneo => {
    const material: Material = {
      id: "calc",
      nombre: "Tu bulto",
      largo: d.largo,
      ancho: d.ancho,
      alto: d.alto,
      peso: d.peso,
      orientaciones: orientacionesDePreset(d.preset, d.largo, d.ancho, d.alto),
      apilable: d.apilable,
      maxCapas: d.maxCapas,
      color: "#0072B2",
    };
    return {
      material,
      equipo,
      cantidad: d.cantidad,
      modoCarga: d.modoCarga,
      tarima: tarimas.find((t) => t.id === d.tarimaId) ?? null,
      alturaMaxArmada: d.alturaMaxArmada,
      rotarTarima: d.rotarTarima,
      parametros: {
        permitirDobleEstiba: d.dobleEstiba,
        operacion: d.exportacion ? "exportacion" : "nacional",
      },
    };
  };

  const calcular = handleSubmit(async (d) => {
    const equipo = equipos.find((e) => e.id === d.equipoId);
    if (!equipo) return;
    try {
      const r = await motor.correr("calcular", entradaDe(d, equipo));
      setResultado({ plan: r.plan, ms: r.duracionMs });
      setComparacion(null);
    } catch (e) {
      if ((e as Error).message !== "cancelado")
        toast.error("No se pudo calcular", {
          description: (e as Error).message,
        });
    }
  });

  const comparar = handleSubmit(async (d) => {
    const lista = COMPARAR.map((c) =>
      equipos.find((e) => e.codigo === c),
    ).filter(Boolean) as Equipo[];
    try {
      const r = await motor.correr(
        "comparar",
        lista.map((e) => ({ nombre: e.nombre, entrada: entradaDe(d, e) })),
      );
      setComparacion({ resultados: r.resultados, recomendado: r.recomendado });
    } catch (e) {
      if ((e as Error).message !== "cancelado")
        toast.error("No se pudo comparar", {
          description: (e as Error).message,
        });
    }
  });

  const cargarMaterial = (id: string) => {
    const m = materialesQ.data?.find((x) => x.id === id);
    if (!m) return;
    setValue("largo", m.largo);
    setValue("ancho", m.ancho);
    setValue("alto", m.alto);
    setValue("peso", m.peso);
    setValue("preset", m.preset);
    setValue("apilable", m.apilable);
    setValue("maxCapas", m.maxCapas ?? null);
  };

  const equiposOrdenados = useMemo(
    () => [...equipos].sort((a, b) => a.categoria.localeCompare(b.categoria)),
    [equipos],
  );

  return (
    <div className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[340px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="size-5" aria-hidden /> Calculadora rápida
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={calcular} className="space-y-3" noValidate>
            {materialesQ.data && materialesQ.data.length > 0 && (
              <Campo id="mat" etiqueta="Cargar del catálogo (opcional)">
                <select
                  id="mat"
                  className={selectCls}
                  defaultValue=""
                  onChange={(e) => cargarMaterial(e.target.value)}
                >
                  <option value="">Captura rápida</option>
                  {materialesQ.data.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.sku ? `${m.sku} · ` : ""}
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
            <Controller
              control={control}
              name="equipoId"
              render={({ field }) => (
                <Campo id="equipo" etiqueta="Equipo">
                  <select id="equipo" className={selectCls} {...field}>
                    {equiposOrdenados.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                      </option>
                    ))}
                  </select>
                </Campo>
              )}
            />
            <fieldset className="grid grid-cols-3 gap-2">
              <legend className="mb-1 text-sm font-medium">
                Medidas exteriores con empaque
              </legend>
              {(["largo", "ancho", "alto"] as const).map((k) => (
                <Controller
                  key={k}
                  control={control}
                  name={k}
                  render={({ field }) => (
                    <Campo
                      id={k}
                      etiqueta={k[0].toUpperCase() + k.slice(1)}
                      error={errores[k]?.message}
                    >
                      <CampoMedida
                        id={k}
                        tipo="longitud"
                        unidad={unidadLong}
                        valor={field.value}
                        onCambio={(v) => field.onChange(v ?? undefined)}
                        invalido={!!errores[k]}
                      />
                    </Campo>
                  )}
                />
              ))}
            </fieldset>
            <div className="grid grid-cols-2 gap-2">
              <Controller
                control={control}
                name="peso"
                render={({ field }) => (
                  <Campo
                    id="peso"
                    etiqueta="Peso por bulto"
                    error={errores.peso?.message}
                  >
                    <CampoMedida
                      id="peso"
                      tipo="peso"
                      unidad={unidadPeso}
                      valor={field.value}
                      onCambio={(v) => field.onChange(v ?? undefined)}
                      invalido={!!errores.peso}
                    />
                  </Campo>
                )}
              />
              <Controller
                control={control}
                name="cantidad"
                render={({ field }) => (
                  <Campo
                    id="cantidad"
                    etiqueta="Cantidad"
                    error={errores.cantidad?.message}
                  >
                    <input
                      id="cantidad"
                      inputMode="numeric"
                      placeholder="Llenar al máximo"
                      className={`${selectCls} num`}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? null
                            : Math.round(Number(e.target.value)),
                        )
                      }
                    />
                  </Campo>
                )}
              />
            </div>
            <Controller
              control={control}
              name="preset"
              render={({ field }) => (
                <Campo id="preset" etiqueta="Orientación">
                  <select id="preset" className={selectCls} {...field}>
                    <option value="libre">Libre (6 rotaciones)</option>
                    <option value="este_lado_arriba">Este lado arriba</option>
                    <option value="plano">Plano (cara mayor abajo)</option>
                  </select>
                </Campo>
              )}
            />
            <div className="grid grid-cols-2 gap-2">
              <Controller
                control={control}
                name="apilable"
                render={({ field }) => (
                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />{" "}
                    Apilable
                  </label>
                )}
              />
              <Controller
                control={control}
                name="maxCapas"
                render={({ field }) => (
                  <Campo id="maxCapas" etiqueta="Capas máx.">
                    <input
                      id="maxCapas"
                      inputMode="numeric"
                      placeholder="Sin límite"
                      className={`${selectCls} num`}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? null
                            : Math.round(Number(e.target.value)),
                        )
                      }
                    />
                  </Campo>
                )}
              />
            </div>
            <Controller
              control={control}
              name="modoCarga"
              render={({ field }) => (
                <div
                  className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
                  role="radiogroup"
                  aria-label="Unidad de carga"
                >
                  {(["suelta", "paletizada"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={field.value === v}
                      onClick={() => field.onChange(v)}
                      className={`rounded-md px-2 py-1.5 text-sm ${field.value === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
                    >
                      {v === "suelta" ? "Suelto" : "En tarima"}
                    </button>
                  ))}
                </div>
              )}
            />
            {modoCarga === "paletizada" && (
              <div className="space-y-2 rounded-lg border p-2">
                <Controller
                  control={control}
                  name="tarimaId"
                  render={({ field }) => (
                    <Campo id="tarima" etiqueta="Tarima">
                      <select id="tarima" className={selectCls} {...field}>
                        {tarimas.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nombre} ({t.largo}×{t.ancho})
                          </option>
                        ))}
                      </select>
                    </Campo>
                  )}
                />
                <Controller
                  control={control}
                  name="alturaMaxArmada"
                  render={({ field }) => (
                    <Campo
                      id="altArm"
                      etiqueta="Altura máx. armada (con tarima)"
                    >
                      <CampoMedida
                        id="altArm"
                        tipo="longitud"
                        unidad={unidadLong}
                        valor={field.value ?? undefined}
                        onCambio={(v) => field.onChange(v)}
                      />
                    </Campo>
                  )}
                />
                <Controller
                  control={control}
                  name="dobleEstiba"
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />{" "}
                      Permitir doble estiba
                    </label>
                  )}
                />
                <Controller
                  control={control}
                  name="rotarTarima"
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />{" "}
                      Permitir girar la tarima
                    </label>
                  )}
                />
                <Controller
                  control={control}
                  name="exportacion"
                  render={({ field }) => (
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />{" "}
                      Es exportación
                    </label>
                  )}
                />
              </div>
            )}
            {motor.corriendo ? (
              <div className="space-y-2" aria-live="polite">
                <Progress value={motor.progreso * 100} />
                <div className="flex items-center justify-between text-sm">
                  <span>{motor.mensaje}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={motor.cancelar}
                  >
                    <X /> Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button type="submit" size="lg">
                  Calcular
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={comparar}
                >
                  <Scale /> Comparar
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <section className="min-w-0 space-y-4" aria-label="Resultado">
        {comparacion && <TablaComparacion {...comparacion} />}
        {resultado ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
            <VisorPlan
              plan={resultado.plan}
              className="h-[60vh] min-h-[380px]"
            />
            <div className="space-y-4">
              <PanelResultado plan={resultado.plan} duracionMs={resultado.ms} />
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
                <p className="font-medium">Guarda y exporta tu plan</p>
                <p className="text-muted-foreground">
                  Abre el planificador para guardar escenarios y generar PDF o
                  Excel. Los enlaces públicos requieren Supabase.
                </p>
                <Link
                  href="/planificar"
                  className="mt-2 inline-block font-medium underline"
                >
                  Abrir planificador
                </Link>
              </div>
            </div>
          </div>
        ) : (
          !comparacion && (
            <div className="grid min-h-[50vh] place-items-center rounded-lg border border-dashed p-8 text-center text-muted-foreground">
              <div>
                <Ilustracion tipo="sin-resultados" clase="mx-auto h-32" />
                <p className="text-lg font-medium text-foreground">
                  Captura tu bulto y presiona Calcular
                </p>
                <p className="mt-1 text-sm">
                  Te decimos cuántos caben, qué limita (peso, volumen o puerta)
                  y cómo acomodarlos.
                </p>
              </div>
            </div>
          )
        )}
      </section>
    </div>
  );
}

function TablaComparacion({
  resultados,
  recomendado,
}: {
  resultados: ResultadoEscenario[];
  recomendado: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Equipo</TableHead>
            <TableHead className="text-right">Unidades</TableHead>
            <TableHead className="text-right">% volumen</TableHead>
            <TableHead className="text-right">% peso</TableHead>
            <TableHead>Limita</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {resultados.map((r) => (
            <TableRow
              key={r.nombre}
              className={r.nombre === recomendado ? "bg-primary/10" : undefined}
            >
              <TableCell className="font-medium">
                {r.nombre}
                {r.nombre === recomendado && (
                  <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">
                    Recomendado
                  </span>
                )}
              </TableCell>
              <TableCell className="num text-right">
                {num(r.unidades)}
              </TableCell>
              <TableCell className="num text-right">
                {pct(r.pctVolumen)}
              </TableCell>
              <TableCell className="num text-right">{pct(r.pctPeso)}</TableCell>
              <TableCell>{r.plan.kpis.factorLimitante}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="px-3 py-2 text-xs text-muted-foreground">
        Se recomienda el que carga más unidades; si empatan, el de menor costo
        por unidad (cuando hay tarifa), menos equipos y mayor % de uso.
      </p>
    </div>
  );
}
