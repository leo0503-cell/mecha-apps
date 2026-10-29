"use client";
/** CRUD genérico de catálogos: tabla con búsqueda y filtros, alta/edición, duplicar, borrar y exportar CSV. */
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  Copy,
  Download,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBorrar, useCatalogo, useGuardar } from "@/lib/datos/repo";
import type { Entidad, RegistroPorEntidad } from "@/lib/datos/tipos";
import { puedeEscribir, useSesion } from "@/lib/sesion";
import { cn } from "@/lib/utils";
import {
  desdeKg,
  desdeMm,
  NOMBRE_ORIENTACION,
  orientacionesDePreset,
  TODAS_ORIENTACIONES,
  type PresetOrientacion,
} from "@/motor";
import { CampoMedida } from "../CampoMedida";
import { Ilustracion } from "../Ilustracion";
import { celdaCsv } from "@/lib/csv";
import { num } from "../formato";
import { CATALOGOS, esquemaDe, type Campo } from "./config";

type Reg = Record<string, unknown> & {
  id: string;
  empresaId: string | null;
  nombre?: string;
};

const ENTIDADES: Entidad[] = [
  "materiales",
  "tarimas",
  "equipos",
  "transportistas",
  "almacenes",
];

export function PestanasCatalogo({ actual }: { actual: Entidad }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Catálogos">
      {ENTIDADES.map((e) => (
        <Link
          key={e}
          href={`/catalogos/${e}`}
          aria-current={e === actual ? "page" : undefined}
          className={cn(
            "whitespace-nowrap border-b-2 px-3 py-2 text-sm",
            e === actual
              ? "border-primary font-medium"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {CATALOGOS[e].titulo}
        </Link>
      ))}
    </nav>
  );
}

function valorCelda(c: Campo, v: unknown, ul: string, up: string) {
  if (v == null || v === "") return "—";
  if (c.tipo === "medida")
    return num(desdeMm(v as number, ul as "mm"), ul === "mm" ? 0 : 2);
  if (c.tipo === "peso") return num(desdeKg(v as number, up as "kg"), 2);
  if (c.tipo === "bool") return v ? "Sí" : "No";
  if (c.tipo === "opcion")
    return c.opciones?.find(([k]) => k === v)?.[1] ?? String(v);
  if (typeof v === "number") return num(v, 3);
  return String(v);
}

function aCsv(campos: Campo[], filas: Reg[]) {
  const cab = [
    "id",
    "global",
    ...campos.map((c) =>
      c.tipo === "medida" ? `${c.k}_mm` : c.tipo === "peso" ? `${c.k}_kg` : c.k,
    ),
  ];
  return [
    cab.join(","),
    ...filas.map((f) =>
      [f.id, f.empresaId == null ? "si" : "no", ...campos.map((c) => f[c.k])]
        .map(celdaCsv)
        .join(","),
    ),
  ].join("\n");
}

export function CatalogoCrud({ entidad }: { entidad: Entidad }) {
  const cfg = CATALOGOS[entidad];
  const { rol, empresaId, unidadLong, unidadPeso } = useSesion();
  const q = useCatalogo(entidad);
  const borrar = useBorrar(entidad);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "empresa" | "global">("todos");
  const [editando, setEditando] = useState<Reg | null>(null);
  const [aBorrar, setABorrar] = useState<Reg | null>(null);
  const puede = puedeEscribir(entidad, rol);
  const columnas = cfg.campos.filter((c) => c.tabla);

  const filas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return ((q.data ?? []) as unknown as Reg[])
      .filter(
        (r) =>
          filtro === "todos" ||
          (filtro === "global" ? r.empresaId == null : r.empresaId != null),
      )
      .filter(
        (r) =>
          !t ||
          cfg.campos.some(
            (c) =>
              (c.tipo === "texto" || c.tipo === "opcion") &&
              String(r[c.k] ?? "")
                .toLowerCase()
                .includes(t),
          ),
      )
      .sort((a, b) =>
        String(a.nombre ?? "").localeCompare(String(b.nombre ?? ""), "es"),
      );
  }, [q.data, busca, filtro, cfg.campos]);

  const exportar = () => {
    const blob = new Blob(["﻿" + aCsv(cfg.campos, filas)], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cubicarga-${entidad}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const duplicar = (r: Reg) =>
    setEditando({
      ...r,
      id: "",
      empresaId: empresaId ?? "local",
      nombre: `${r.nombre ?? ""} (copia)`,
    });

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold">{cfg.titulo}</h1>
        <p className="text-sm text-muted-foreground">{cfg.descripcion}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Label htmlFor="busca" className="sr-only">
            Buscar
          </Label>
          <Input
            id="busca"
            className="pl-8"
            placeholder="Buscar por nombre, SKU o código"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div
          className="flex rounded-lg bg-muted p-0.5"
          role="radiogroup"
          aria-label="Filtrar"
        >
          {(["todos", "empresa", "global"] as const).map((f) => (
            <button
              key={f}
              role="radio"
              aria-checked={filtro === f}
              onClick={() => setFiltro(f)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm",
                filtro === f
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground",
              )}
            >
              {f === "todos"
                ? "Todos"
                : f === "empresa"
                  ? "Mi empresa"
                  : "Globales"}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={exportar} disabled={!filas.length}>
          <Download /> CSV
        </Button>
        {puede && (
          <Button
            onClick={() =>
              setEditando({
                ...cfg.nuevo(),
                id: "",
                empresaId: empresaId ?? "local",
              } as Reg)
            }
          >
            <Plus /> Nuevo
          </Button>
        )}
      </div>

      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      ) : q.error ? (
        <p className="text-mal">
          No se pudo cargar: {(q.error as Error).message}
        </p>
      ) : filas.length === 0 ? (
        <div className="grid place-items-center rounded-lg border border-dashed p-10 text-center">
          {entidad === "materiales" && (
            <Ilustracion tipo="sin-materiales" clase="h-32" />
          )}
          <p className="font-medium">
            {busca
              ? "Nada coincide con tu búsqueda"
              : `Aún no hay ${cfg.titulo.toLowerCase()}`}
          </p>
          {puede && !busca && (
            <Button
              className="mt-3"
              onClick={() =>
                setEditando({
                  ...cfg.nuevo(),
                  id: "",
                  empresaId: empresaId ?? "local",
                } as Reg)
              }
            >
              <Plus /> Agrega tu primer {cfg.singular}
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {columnas.map((c) => (
                  <TableHead
                    key={c.k}
                    className={cn(
                      (c.tipo === "medida" ||
                        c.tipo === "peso" ||
                        c.tipo === "decimal") &&
                        "text-right",
                    )}
                  >
                    {c.t}
                    {c.tipo === "medida"
                      ? ` (${unidadLong})`
                      : c.tipo === "peso"
                        ? ` (${unidadPeso})`
                        : ""}
                  </TableHead>
                ))}
                <TableHead className="w-0">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((r) => {
                const global = r.empresaId == null;
                return (
                  <TableRow key={r.id}>
                    {columnas.map((c, i) => (
                      <TableCell
                        key={c.k}
                        className={cn(
                          (c.tipo === "medida" ||
                            c.tipo === "peso" ||
                            c.tipo === "decimal") &&
                            "num text-right",
                        )}
                      >
                        {i === 0 &&
                          entidad === "materiales" &&
                          typeof r.color === "string" && (
                            <span
                              className="mr-2 inline-block size-3 rounded-sm align-middle"
                              style={{ background: r.color }}
                              aria-hidden
                            />
                          )}
                        {valorCelda(c, r[c.k], unidadLong, unidadPeso)}
                        {i === 0 && global && (
                          <Badge variant="secondary" className="ml-2">
                            <Lock className="size-3" aria-hidden /> Global
                          </Badge>
                        )}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {!global && puede && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Editar ${r.nombre}`}
                            onClick={() => setEditando(r)}
                          >
                            <Pencil />
                          </Button>
                        )}
                        {puede && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Duplicar ${r.nombre}`}
                            title={
                              global ? "Duplicar a mi empresa" : "Duplicar"
                            }
                            onClick={() => duplicar(r)}
                          >
                            <Copy />
                          </Button>
                        )}
                        {!global && puede && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Borrar ${r.nombre}`}
                            onClick={() => setABorrar(r)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                        {!puede && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Ver ${r.nombre}`}
                            onClick={() =>
                              setEditando({ ...r, __soloLectura: true })
                            }
                          >
                            <Search />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            {filas.length} registro(s)
            {!puede && " · Tu rol solo puede consultar este catálogo."}
          </p>
        </div>
      )}

      {editando && (
        <Formulario
          entidad={entidad}
          inicial={editando}
          onCerrar={() => setEditando(null)}
        />
      )}

      <Dialog open={!!aBorrar} onOpenChange={(o) => !o && setABorrar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Borrar {aBorrar?.nombre}?</DialogTitle>
            <DialogDescription>
              Se quita de tu catálogo. Los cálculos ya guardados conservan sus
              datos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setABorrar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await borrar.mutateAsync(aBorrar!.id);
                  toast.success("Borrado");
                } catch (e) {
                  toast.error((e as Error).message);
                }
                setABorrar(null);
              }}
            >
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const inputCls =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm";

function Formulario({
  entidad,
  inicial,
  onCerrar,
}: {
  entidad: Entidad;
  inicial: Reg;
  onCerrar: () => void;
}) {
  const cfg = CATALOGOS[entidad];
  const { unidadLong, unidadPeso } = useSesion();
  const guardar = useGuardar(entidad);
  const soloLectura = Boolean(inicial.__soloLectura);
  const { control, handleSubmit, setValue, formState } = useForm<
    Record<string, unknown>
  >({
    resolver: zodResolver(esquemaDe(cfg.campos)),
    defaultValues: inicial,
  });
  const preset = useWatch({ control, name: "preset" }) as
    PresetOrientacion | undefined;
  const dims = useWatch({ control, name: ["largo", "ancho", "alto"] }) as (
    number | undefined
  )[];
  const err = formState.errors;

  const enviar = handleSubmit(async (d) => {
    const r = { ...d } as Record<string, unknown>;
    delete r.__soloLectura;
    if (entidad === "equipos") {
      r.alturaUtil ??= r.alto;
      r.puertaAncho ??= r.ancho;
      r.puertaAlto ??= r.alto;
    }
    if (entidad === "tarimas") r.alturaMaxArmada ??= 1800;
    try {
      await guardar.mutateAsync(
        r as unknown as RegistroPorEntidad[typeof entidad],
      );
      toast.success(
        inicial.id
          ? "Cambios guardados"
          : `${cfg.singular[0].toUpperCase()}${cfg.singular.slice(1)} creado`,
      );
      onCerrar();
    } catch (e) {
      toast.error("No se pudo guardar", { description: (e as Error).message });
    }
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {soloLectura
              ? (inicial.nombre as string)
              : inicial.id
                ? `Editar ${cfg.singular}`
                : `Nuevo ${cfg.singular}`}
          </DialogTitle>
          <DialogDescription>{cfg.descripcion}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={enviar}
          className="grid gap-3 sm:grid-cols-3"
          noValidate
        >
          <fieldset disabled={soloLectura} className="contents">
            {cfg.campos.map((c) => (
              <Controller
                key={c.k}
                control={control}
                name={c.k}
                render={({ field }) => {
                  const e = err[c.k]?.message as string | undefined;
                  const id = `f-${c.k}`;
                  const ancho =
                    c.tipo === "orientaciones" ||
                    c.k === "nombre" ||
                    c.k === "notas"
                      ? "sm:col-span-3"
                      : "";
                  if (c.tipo === "bool")
                    return (
                      <label className="flex items-center gap-2 self-end text-sm">
                        <Switch
                          checked={Boolean(field.value)}
                          onCheckedChange={field.onChange}
                          disabled={soloLectura}
                        />{" "}
                        {c.t}
                      </label>
                    );
                  let control: React.ReactNode;
                  if (c.tipo === "medida")
                    control = (
                      <CampoMedida
                        id={id}
                        tipo="longitud"
                        unidad={unidadLong}
                        valor={field.value as number}
                        onCambio={(v) => field.onChange(v ?? null)}
                        invalido={!!e}
                        disabled={soloLectura}
                      />
                    );
                  else if (c.tipo === "peso")
                    control = (
                      <CampoMedida
                        id={id}
                        tipo="peso"
                        unidad={unidadPeso}
                        valor={field.value as number}
                        onCambio={(v) => field.onChange(v ?? null)}
                        invalido={!!e}
                        disabled={soloLectura}
                      />
                    );
                  else if (c.tipo === "opcion")
                    control = (
                      <select
                        id={id}
                        className={inputCls}
                        value={(field.value as string) ?? ""}
                        onChange={(ev) => {
                          field.onChange(ev.target.value);
                          if (c.k === "preset" && dims.every((x) => x))
                            setValue(
                              "orientaciones",
                              orientacionesDePreset(
                                ev.target.value as PresetOrientacion,
                                dims[0]!,
                                dims[1]!,
                                dims[2]!,
                              ),
                            );
                        }}
                      >
                        {!c.req && <option value="">—</option>}
                        {c.opciones!.map(([v, t]) => (
                          <option key={v} value={v}>
                            {t}
                          </option>
                        ))}
                      </select>
                    );
                  else if (c.tipo === "color")
                    control = (
                      <input
                        id={id}
                        type="color"
                        className="h-8 w-16 rounded border"
                        value={(field.value as string) ?? "#0072B2"}
                        onChange={(ev) => field.onChange(ev.target.value)}
                      />
                    );
                  else if (c.tipo === "orientaciones") {
                    const sel = (field.value as string[]) ?? [];
                    control = (
                      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                        {TODAS_ORIENTACIONES.map((o) => (
                          <label
                            key={o}
                            className="flex items-center gap-2 rounded border px-2 py-1 text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={sel.includes(o)}
                              onChange={(ev) =>
                                field.onChange(
                                  ev.target.checked
                                    ? [...sel, o]
                                    : sel.filter((x) => x !== o),
                                )
                              }
                            />
                            <span className="num">{o}</span>{" "}
                            <span className="text-muted-foreground">
                              {NOMBRE_ORIENTACION[o]}
                            </span>
                          </label>
                        ))}
                        {preset && (
                          <p className="col-span-full text-xs text-muted-foreground">
                            Al cambiar la orientación se proponen las
                            rotaciones; puedes ajustarlas a mano.
                          </p>
                        )}
                      </div>
                    );
                  } else
                    control = (
                      <Input
                        id={id}
                        className={c.tipo !== "texto" ? "num" : undefined}
                        inputMode={c.tipo === "texto" ? "text" : "decimal"}
                        aria-invalid={!!e || undefined}
                        value={(field.value as string | number | null) ?? ""}
                        onChange={(ev) => {
                          const v = ev.target.value;
                          if (c.tipo === "texto") return field.onChange(v);
                          field.onChange(
                            v.trim() === ""
                              ? null
                              : Number(v.replace(",", ".")),
                          );
                        }}
                      />
                    );
                  return (
                    <div className={cn("space-y-1", ancho)}>
                      <Label htmlFor={id}>
                        {c.t}
                        {c.req && <span className="text-mal"> *</span>}
                      </Label>
                      {control}
                      {c.ayuda && (
                        <p className="text-xs text-muted-foreground">
                          {c.ayuda}
                        </p>
                      )}
                      {e && (
                        <p className="text-xs text-mal" role="alert">
                          {e}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
            ))}
          </fieldset>
          <DialogFooter className="sm:col-span-3">
            <Button type="button" variant="outline" onClick={onCerrar}>
              {soloLectura ? "Cerrar" : "Cancelar"}
            </Button>
            {!soloLectura && (
              <Button type="submit" disabled={guardar.isPending}>
                Guardar
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
