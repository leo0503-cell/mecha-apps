"use client";
import { Ilustracion, iconoEquipo } from "./Ilustracion";
import { bloquearConApoyos } from "@/motor/bloqueos";
import { Plantillas, Montacarguista, imprimirEtiquetas } from "./OperacionPlan";
import { motion, useReducedMotion } from "motion/react";
import { useSesion } from "@/lib/sesion";
import { CampoMedida } from "./CampoMedida";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VisorPlan } from "@/components/visor/VisorPlan";
import { PanelResultado } from "./PanelResultado";
import { repo } from "@/lib/datos/repo";
import { useMotor } from "@/lib/useMotor";
import {
  PARAMETROS_DEFAULT,
  validarPlan,
  actualizarKpis,
  asignarPasos,
  type EntradaMixta,
  type Material,
  type PlanCarga,
} from "@/motor";
import {
  CABECERAS,
  importarPacking,
  type ItemCarga,
} from "@/lib/planes/packing";
import {
  descargar,
  exportarExcel,
  exportarPng,
  imprimirPlan,
} from "@/lib/planes/exportar";
import {
  guardarEscenario,
  listarEscenarios,
  compartirEscenario,
  type EscenarioGuardado,
} from "@/lib/planes/repositorio";
const pasos = ["Operación y modo", "Carga", "Unidad de carga", "Equipo"];
const nueva = (): ItemCarga => ({
  cantidad: 10,
  material: {
    id: crypto.randomUUID(),
    nombre: "Caja",
    largo: 600,
    ancho: 400,
    alto: 400,
    peso: 15,
    apilable: true,
    orientaciones: ["LAH", "LHA", "ALH", "AHL", "HLA", "HAL"],
    paradaDescarga: 1,
    color: "#0072B2",
  },
});
export function Planificador() {
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const { unidadLong, unidadPeso } = useSesion();
  const reducido = useReducedMotion();
  const { data: equipos = [], error: errEquipos } = useQuery({
    queryKey: ["equipos"],
    queryFn: () => repo.listar("equipos"),
  });
  const { data: tarimas = [] } = useQuery({
    queryKey: ["tarimas"],
    queryFn: () => repo.listar("tarimas"),
  });
  const { data: catalogo = [] } = useQuery({
    queryKey: ["materiales"],
    queryFn: () => repo.listar("materiales"),
  });
  const [paso, setPaso] = useState(0),
    [nombre, setNombre] = useState("Nuevo escenario"),
    [operacion, setOperacion] = useState<
      "nacional" | "exportacion" | "importacion"
    >("nacional");
  const [modo, setModo] = useState("terrestre"),
    [items, setItems] = useState<ItemCarga[]>([]),
    [slots, setSlots] = useState<string[]>([]),
    [unidad, setUnidad] = useState("suelta"),
    [tarima, setTarima] = useState(""),
    [doble, setDoble] = useState(false);
  const [plan, setPlan] = useState<PlanCarga | null>(null),
    [entrada, setEntrada] = useState<EntradaMixta | null>(null),
    [seleccion, setSeleccion] = useState<number | null>(null),
    [bloqueos, setBloqueos] = useState<number[]>([]),
    [errores, setErrores] = useState<string[]>([]),
    [savedId, setSavedId] = useState<string | null>(null),
    [enlace, setEnlace] = useState<string | null>(null),
    [ocupado, setOcupado] = useState(false);
  const [versionBase, setVersionBase] = useState<string | undefined>();
  const [historial, setHistorial] = useState<
    { plan: PlanCarga; seleccion: number | null; bloqueos: number[] }[]
  >([]);
  const motor = useMotor(),
    contenedor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancel = false;
    const id = new URLSearchParams(location.search).get("escenario");
    if (id)
      listarEscenarios()
        .then((rs) => {
          if (cancel) return;
          const r = rs.find((r) => r.id === id);
          if (!r) {
            setErrorCarga(
              "No se encontró el escenario o no tienes permiso para abrirlo",
            );
            return;
          }
          setNombre(r.nombre);
          setItems(r.entrada.items);
          setSlots(r.entrada.equipos.map((e) => e.id));
          setEntrada(r.entrada);
          setPlan(r.plan);
          setPaso(3);
          setSavedId(r.id);
          setVersionBase(r.id);
          setOperacion(r.entrada.parametros?.operacion ?? "nacional");
          if (r.plan.tarimasArmadas.length) {
            setUnidad("paletizada");
            setTarima(r.plan.tarimas[0]?.id ?? "");
            setDoble(!!r.plan.parametros.permitirDobleEstiba);
          }
          if (r.entrada.equipos[0]?.categoria === "uld") setModo("aereo");
          else if (
            ["contenedor", "reefer"].includes(r.entrada.equipos[0]?.categoria)
          )
            setModo("maritimo");
          if (new URLSearchParams(location.search).has("otroEquipo")) {
            setSlots([]);
            setPlan(null);
            setSavedId(null);
            setVersionBase(undefined);
          }
        })
        .catch(() => {
          if (!cancel)
            setErrorCarga("No se pudo cargar el escenario; revisa la conexión");
        });
    return () => {
      cancel = true;
    };
  }, []);
  const accion = async (fn: () => Promise<unknown> | unknown) => {
    setOcupado(true);
    try {
      await fn();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo completar la acción",
      );
    } finally {
      setOcupado(false);
    }
  };
  const cambiar = (i: number, k: keyof Material, v: unknown) => {
    setItems((xs) =>
      xs.map((x, j) =>
        j === i ? { ...x, material: { ...x.material, [k]: v } } : x,
      ),
    );
  };
  const validarPaso = () => {
    if (paso === 0 && !nombre.trim()) {
      toast.error("Escribe el nombre del escenario");
      return false;
    }
    if (paso === 1 && !items.length) {
      toast.error("Agrega al menos un material");
      return false;
    }
    if (
      paso === 2 &&
      unidad === "paletizada" &&
      (items.length !== 1 || !tarima)
    ) {
      toast.error("Paletiza un material por escenario y selecciona una tarima");
      return false;
    }
    return true;
  };
  const calcular = () =>
    accion(async () => {
      const elegidos = slots
        .map((id) => equipos.find((e) => e.id === id))
        .filter((e): e is (typeof equipos)[number] => !!e);
      if (!elegidos.length) throw new Error("Selecciona al menos un equipo");
      const e: EntradaMixta = {
        items,
        equipos: elegidos,
        parametros: {
          ...PARAMETROS_DEFAULT,
          operacion,
          permitirDobleEstiba: doble,
        },
      };
      const r =
        unidad === "paletizada"
          ? await motor.correr("calcular", {
              material: items[0].material,
              cantidad: items[0].cantidad,
              equipo: elegidos[0],
              modoCarga: "paletizada",
              tarima: tarimas.find((t) => t.id === tarima),
              maxEquipos: elegidos.length,
              parametros: e.parametros,
            })
          : await motor.correr("mixto", e);
      const violaciones = validarPlan(r.plan);
      if (violaciones.length)
        throw new Error(
          `El resultado requiere corrección: ${violaciones[0].mensaje}`,
        );
      setPlan(r.plan);
      setEntrada(e);
      setSeleccion(null);
      setBloqueos([]);
      setSavedId(null);
      setEnlace(null);
      setErrores([]);
      setHistorial([]);
    });
  const editar = (k: "x" | "y" | "z" | "orientacion", v: number | string) => {
    if (!plan || seleccion == null) return;
    setHistorial((xs) => [
      ...xs.slice(-19),
      { plan: structuredClone(plan), seleccion, bloqueos: [...bloqueos] },
    ]);
    const previo = structuredClone(plan),
      selPrevia = seleccion,
      locksPrevios = [...bloqueos];
    toast.success("Edición aplicada; revisa la validación", {
      action: {
        label: "Deshacer",
        onClick: () => {
          setPlan(previo);
          setSeleccion(selPrevia);
          setBloqueos(locksPrevios);
          setErrores(validarPlan(previo).map((v) => v.mensaje));
          setHistorial((xs) => xs.slice(0, -1));
        },
      },
    });
    const p = structuredClone(plan),
      c = p.colocaciones[seleccion];
    if (k === "orientacion") {
      const m = p.materiales.find((m) => m.id === c.materialId)!;
      const o = v as typeof c.orientacion;
      c.orientacion = o;
      const d: { [key: string]: number } = {
        L: m.largo,
        A: m.ancho,
        H: m.alto,
      };
      c.l = d[o[0]];
      c.a = d[o[1]];
      c.h = d[o[2]];
    } else c[k] = Number(v);
    const violaciones = validarPlan(p);
    setErrores(violaciones.map((v) => v.mensaje));
    if (violaciones.length) setPlan(p);
    else {
      const ordenadas = asignarPasos(p.colocaciones, p.tarimasArmadas);
      setBloqueos(bloqueos.map((i) => ordenadas.indexOf(p.colocaciones[i])));
      setSeleccion(ordenadas.indexOf(c));
      setPlan(actualizarKpis({ ...p, colocaciones: ordenadas }));
    }
    setSavedId(null);
    setEnlace(null);
  };
  const deshacer = () => {
    const anterior = historial[historial.length - 1];
    if (!anterior) return;
    setPlan(anterior.plan);
    setSeleccion(anterior.seleccion);
    setBloqueos(anterior.bloqueos);
    setErrores(validarPlan(anterior.plan).map((v) => v.mensaje));
    setHistorial((xs) => xs.slice(0, -1));
    setSavedId(null);
    setEnlace(null);
  };
  const rotar = () => {
    if (!plan || seleccion == null) return;
    const c = plan.colocaciones[seleccion];
    if (c.tarimaIdx != null) return;
    const m = plan.materiales.find((m) => m.id === c.materialId)!;
    editar(
      "orientacion",
      m.orientaciones[
        (m.orientaciones.indexOf(c.orientacion) + 1) % m.orientaciones.length
      ],
    );
  };
  const canvas = () => contenedor.current?.querySelector("canvas");
  if (errorCarga)
    return (
      <div role="alert" className="rounded border p-6">
        <h1 className="text-xl font-semibold">Escenario no disponible</h1>
        <p>{errorCarga}</p>
        <a href="/proyectos" className="underline">
          Volver a proyectos
        </a>
      </div>
    );
  return (
    <div className="space-y-6" ref={contenedor}>
      <header>
        <h1 className="text-2xl font-semibold">Planificador de carga</h1>
        <p className="text-muted-foreground">
          Acomodo recomendado, validación independiente y escenarios de carga.
        </p>
      </header>
      <Plantillas
        nombre={nombre}
        entrada={entrada}
        onAplicar={(e) => {
          setItems(e.items);
          setSlots(e.equipos.map((e) => e.id));
          setOperacion(e.parametros?.operacion ?? "nacional");
          setEntrada(e);
          setPlan(null);
          setPaso(1);
          setVersionBase(undefined);
          setSavedId(null);
          toast.success("Plantilla cargada; actualiza las cantidades");
        }}
      />
      <ol
        className="grid grid-cols-2 gap-2 md:grid-cols-4"
        aria-label="Pasos del asistente"
      >
        {pasos.map((p, i) => (
          <li
            key={p}
            className={`rounded-lg border p-3 ${i === paso ? "border-primary bg-primary/10" : ""}`}
            aria-current={i === paso ? "step" : undefined}
          >
            {i + 1}. {p}
          </li>
        ))}
      </ol>
      <motion.section
        key={paso}
        initial={reducido ? false : { opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
        className="rounded-xl border bg-card p-5 space-y-4"
      >
        {paso === 0 && (
          <>
            <Label htmlFor="nombre-escenario">Nombre del escenario</Label>
            <Input
              id="nombre-escenario"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <Label htmlFor="operacion-plan">Operación</Label>
            <select
              id="operacion-plan"
              className="w-full rounded border p-2"
              value={operacion}
              onChange={(e) => setOperacion(e.target.value as typeof operacion)}
            >
              <option value="nacional">Nacional</option>
              <option value="exportacion">Exportación</option>
              <option value="importacion">Importación</option>
            </select>
            <Label htmlFor="modo-plan">Modo</Label>
            <select
              id="modo-plan"
              className="w-full rounded border p-2"
              value={modo}
              onChange={(e) => setModo(e.target.value)}
            >
              <option value="terrestre">Terrestre</option>
              <option value="maritimo">Marítimo</option>
              <option value="aereo">Aéreo</option>
            </select>
          </>
        )}
        {paso === 1 && (
          <>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setItems((xs) => [...xs, nueva()])}>
                Agregar material
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  descargar(
                    new Blob([CABECERAS.join(",") + "\n"], {
                      type: "text/csv;charset=utf-8",
                    }),
                    "cubicarga-plantilla.csv",
                  )
                }
              >
                Descargar plantilla
              </Button>
            </div>
            <Label htmlFor="packing-file">
              Importar packing list (.csv / .xlsx), máximo 5 MB y 5,000 filas
            </Label>
            <Input
              id="packing-file"
              type="file"
              accept=".csv,.xlsx"
              disabled={ocupado}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                  accion(async () => {
                    const r = await importarPacking(f);
                    setErrores(r.errores);
                    if (!r.errores.length) setItems(r.items);
                    else
                      toast.error(
                        "Corrige el archivo antes de importar; tu carga se conserva",
                      );
                  });
                e.target.value = "";
              }}
            />
            <Label htmlFor="material-catalogo">Agregar del catálogo</Label>
            <select
              id="material-catalogo"
              className="w-full rounded border p-2"
              value=""
              onChange={(e) => {
                const m = catalogo.find((m) => m.id === e.target.value);
                if (m)
                  setItems((xs) => [
                    ...xs,
                    {
                      cantidad: 1,
                      material: { ...m, id: crypto.randomUUID() },
                    },
                  ]);
              }}
            >
              <option value="">Selecciona un material</option>
              {catalogo.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
            {!items.length && (
              <p className="rounded border border-dashed p-5 text-muted-foreground">
                <Ilustracion tipo="sin-materiales" clase="mx-auto h-24" />
                Sin materiales. Captura tu carga o importa la plantilla.
              </p>
            )}
            {items.map((x, i) => (
              <fieldset
                key={x.material.id}
                className="grid grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-4"
              >
                <legend className="px-2">Material {i + 1}</legend>
                <div className="col-span-2">
                  <Label htmlFor={`m-${i}-nombre`}>Nombre / SKU</Label>
                  <Input
                    id={`m-${i}-nombre`}
                    value={x.material.nombre}
                    onChange={(e) => cambiar(i, "nombre", e.target.value)}
                  />
                </div>
                {(
                  [
                    ["largo", "Largo mm"],
                    ["ancho", "Ancho mm"],
                    ["alto", "Alto mm"],
                    ["peso", "Peso kg"],
                    ["paradaDescarga", "Parada"],
                  ] as const
                ).map(([k, t]) => (
                  <div key={k}>
                    <Label htmlFor={`m-${i}-${k}`}>
                      {k === "paradaDescarga"
                        ? t
                        : t.replace(
                            /mm|kg/,
                            k === "peso" ? unidadPeso : unidadLong,
                          )}
                    </Label>
                    {k === "paradaDescarga" ? (
                      <Input
                        id={`m-${i}-${k}`}
                        type="number"
                        min={1}
                        step={1}
                        value={x.material[k] ?? 1}
                        onChange={(e) => cambiar(i, k, Number(e.target.value))}
                      />
                    ) : k === "peso" ? (
                      <CampoMedida
                        id={`m-${i}-${k}`}
                        tipo="peso"
                        unidad={unidadPeso}
                        valor={x.material.peso}
                        onCambio={(v) => cambiar(i, k, v ?? 0)}
                      />
                    ) : (
                      <CampoMedida
                        id={`m-${i}-${k}`}
                        tipo="longitud"
                        unidad={unidadLong}
                        valor={x.material[k]}
                        onCambio={(v) => cambiar(i, k, v ?? 0)}
                      />
                    )}
                  </div>
                ))}
                <div>
                  <Label htmlFor={`cantidad-${i}`}>Cantidad</Label>
                  <Input
                    id={`cantidad-${i}`}
                    type="number"
                    min={1}
                    step={1}
                    value={x.cantidad}
                    onChange={(e) =>
                      setItems((xs) =>
                        xs.map((y, j) =>
                          i === j
                            ? { ...y, cantidad: Number(e.target.value) }
                            : y,
                        ),
                      )
                    }
                  />
                </div>
                <div>
                  <Label htmlFor={`orientaciones-${i}`}>Orientación</Label>
                  <select
                    id={`orientaciones-${i}`}
                    className="rounded border p-2 w-full"
                    value={
                      x.material.orientaciones.length === 6 ? "libre" : "arriba"
                    }
                    onChange={(e) =>
                      cambiar(
                        i,
                        "orientaciones",
                        e.target.value === "libre"
                          ? ["LAH", "LHA", "ALH", "AHL", "HLA", "HAL"]
                          : ["LAH", "ALH"],
                      )
                    }
                  >
                    <option value="libre">Libre</option>
                    <option value="arriba">Este lado arriba</option>
                  </select>
                </div>
                <label className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    checked={x.material.apilable}
                    onChange={(e) => cambiar(i, "apilable", e.target.checked)}
                  />
                  Apilable
                </label>
                <label className="flex gap-2 items-center">
                  <input
                    type="checkbox"
                    checked={!!x.material.fragil}
                    onChange={(e) => cambiar(i, "fragil", e.target.checked)}
                  />
                  Frágil
                </label>
                <Button
                  variant="outline"
                  onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}
                >
                  Quitar material {i + 1}
                </Button>
              </fieldset>
            ))}
          </>
        )}
        {paso === 2 && (
          <>
            <Label htmlFor="unidad-plan">Unidad de carga</Label>
            <select
              id="unidad-plan"
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              className="rounded border p-2 w-full"
            >
              <option value="suelta">Mercancía suelta</option>
              <option value="paletizada">Cajas → tarima → equipo</option>
            </select>
            {unidad === "paletizada" && (
              <>
                <p className="text-sm text-muted-foreground">
                  Un SKU por escenario paletizado. Los equipos se repiten del
                  tipo seleccionado primero.
                </p>
                <Label htmlFor="tarima-plan">Tarima</Label>
                <select
                  id="tarima-plan"
                  className="rounded border p-2 w-full"
                  value={tarima}
                  onChange={(e) => setTarima(e.target.value)}
                >
                  <option value="">Selecciona tarima</option>
                  {tarimas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-4 gap-2">
                  {tarimas.map((t, i) => (
                    <button
                      type="button"
                      key={t.id}
                      className="rounded border p-2 hover:border-primary"
                      onClick={() => setTarima(t.id)}
                    >
                      <Ilustracion
                        tipo={
                          "tarima-" +
                          [
                            "gma",
                            "eur",
                            "iso2",
                            "t11",
                            "1067",
                            "1140",
                            "australiana",
                            "media-eur",
                          ][i % 8]
                        }
                        clase="h-14"
                      />
                      <span className="text-xs">{t.nombre}</span>
                    </button>
                  ))}
                </div>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={doble}
                    onChange={(e) => setDoble(e.target.checked)}
                  />
                  Permitir doble estiba
                </label>
              </>
            )}
          </>
        )}
        {paso === 3 && (
          <>
            {errEquipos ? (
              <p role="alert">No se pudieron cargar los equipos.</p>
            ) : (
              <>
                <Label htmlFor="equipo-plan">Agregar equipo a la flota</Label>
                <select
                  id="equipo-plan"
                  className="w-full rounded border p-2"
                  value=""
                  onChange={(e) => {
                    if (slots.length >= 10)
                      return toast.error("Máximo 10 equipos");
                    setSlots((xs) => [...xs, e.target.value]);
                  }}
                >
                  <option value="">Selecciona un equipo</option>
                  {equipos
                    .filter((e) =>
                      modo === "aereo"
                        ? e.categoria === "uld"
                        : modo === "maritimo"
                          ? ["contenedor", "reefer"].includes(e.categoria)
                          : e.categoria !== "uld",
                    )
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre}
                      </option>
                    ))}
                </select>
                <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                  {equipos
                    .filter((e) =>
                      modo === "aereo"
                        ? e.categoria === "uld"
                        : modo === "maritimo"
                          ? ["contenedor", "reefer"].includes(e.categoria)
                          : e.categoria !== "uld",
                    )
                    .map((e) => (
                      <button
                        type="button"
                        key={e.id}
                        className="rounded-lg border p-2 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-primary"
                        onClick={() => {
                          if (slots.length < 10)
                            setSlots((xs) => [...xs, e.id]);
                          else toast.error("Máximo 10 equipos");
                        }}
                      >
                        <Ilustracion
                          tipo={iconoEquipo(e.codigo, e.categoria)}
                          clase="h-20 w-full"
                        />
                        <span className="text-xs">{e.nombre}</span>
                      </button>
                    ))}
                </div>

                <ul>
                  {slots.map((id, i) => (
                    <li
                      key={i}
                      className="flex justify-between gap-2 items-center border-b py-2"
                    >
                      {i + 1}. {equipos.find((e) => e.id === id)?.nombre ?? id}
                      <Button
                        variant="ghost"
                        onClick={() =>
                          setSlots((xs) => xs.filter((_, j) => j !== i))
                        }
                      >
                        Quitar equipo {i + 1}
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <Button
              disabled={ocupado || motor.corriendo || !slots.length}
              onClick={calcular}
            >
              Calcular plan
            </Button>
            {motor.corriendo && (
              <div aria-live="polite">
                <progress className="w-full" max={1} value={motor.progreso} />
                <p>{motor.mensaje}</p>
                <Button onClick={motor.cancelar}>Cancelar</Button>
              </div>
            )}
          </>
        )}
        <div className="flex justify-between">
          <Button
            variant="outline"
            disabled={!paso}
            onClick={() => {
              setPaso((p) => p - 1);
              setErrores([]);
            }}
          >
            Anterior
          </Button>
          {paso < 3 && (
            <Button
              onClick={() => {
                if (validarPaso()) {
                  setPaso((p) => p + 1);
                  setErrores([]);
                }
              }}
            >
              Siguiente
            </Button>
          )}
        </div>
      </motion.section>
      {!!errores.length && (
        <div
          role="alert"
          className="rounded border border-red-600 bg-red-50 p-4 text-red-800"
        >
          <h2 className="font-semibold">Revisa los datos o el acomodo</h2>
          <ul>
            {errores.slice(0, 100).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          {errores.length > 100 && <p>Hay {errores.length} avisos en total.</p>}
        </div>
      )}
      {plan && (
        <section className="space-y-4">
          <Label htmlFor="seleccion-bulto">
            Seleccionar bulto para editar (número global)
          </Label>
          <Input
            id="seleccion-bulto"
            type="number"
            min={1}
            max={plan.colocaciones.length}
            step={1}
            value={seleccion == null ? "" : seleccion + 1}
            onChange={(e) => {
              const n = Number(e.target.value);
              setSeleccion(
                Number.isInteger(n) && n >= 1 && n <= plan.colocaciones.length
                  ? n - 1
                  : null,
              );
            }}
          />
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <VisorPlan
              plan={plan}
              className="h-[65vh] min-h-[420px]"
              onSeleccionGlobal={setSeleccion}
              onRotar={rotar}
              onDeshacer={deshacer}
            />
            <PanelResultado plan={plan} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Montacarguista plan={plan} nombre={nombre} />
            <Button
              variant="outline"
              disabled={
                !enlace ||
                !plan.tarimasArmadas.length ||
                ocupado ||
                !!errores.length
              }
              onClick={() => accion(() => imprimirEtiquetas(plan, enlace!))}
            >
              Imprimir etiquetas con QR
            </Button>
            <Button
              variant="outline"
              disabled={
                ocupado || !!errores.length || !!plan.tarimasArmadas.length
              }
              onClick={() =>
                accion(async () => {
                  const m =
                    plan.materiales.find(
                      (m) =>
                        m.id === plan.colocaciones[seleccion ?? 0]?.materialId,
                    ) ?? plan.materiales[0];
                  const r = await motor.correr("relleno", {
                    plan,
                    material: m,
                  });
                  toast.info(
                    `Se encontraron ${r.alMenos ? "al menos " : ""}${r.cantidad} posiciones adicionales para ${m.nombre}${r.incompleta ? "; búsqueda incompleta" : ""}`,
                  );
                })
              }
            >
              Sugerir relleno
            </Button>
            <Button
              variant="outline"
              disabled={!historial.length}
              onClick={deshacer}
            >
              Deshacer edición
            </Button>

            <Button
              disabled={ocupado || !!errores.length}
              onClick={() =>
                accion(async () => {
                  if (!entrada) return;
                  const id = await guardarEscenario(
                    nombre,
                    entrada,
                    plan,
                    undefined,
                    versionBase,
                  );
                  setSavedId(id);
                  setVersionBase(id);
                  toast.success("Escenario guardado");
                })
              }
            >
              Guardar escenario
            </Button>
            <Button
              variant="outline"
              disabled={!!errores.length}
              onClick={() =>
                accion(() =>
                  imprimirPlan(plan, canvas()?.toDataURL("image/png")),
                )
              }
            >
              PDF / imprimir
            </Button>
            <Button
              variant="outline"
              disabled={ocupado || !!errores.length}
              onClick={() => accion(() => exportarExcel(plan))}
            >
              Exportar Excel
            </Button>
            <Button
              variant="outline"
              disabled={ocupado || !!errores.length}
              onClick={() => accion(() => exportarPng(plan, canvas()))}
            >
              Exportar PNG
            </Button>
            <Button
              variant="outline"
              disabled={!savedId || ocupado}
              onClick={() =>
                accion(async () => {
                  setEnlace(await compartirEscenario(savedId!));
                })
              }
            >
              Crear enlace compartido
            </Button>
          </div>
          {enlace && (
            <div className="flex flex-wrap gap-3 rounded border p-3">
              <a className="underline break-all" href={enlace}>
                {enlace}
              </a>
              <a
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`Plan de carga ${nombre}: ${enlace}`)}`}
              >
                Enviar por WhatsApp
              </a>
              <Button
                variant="outline"
                onClick={() =>
                  accion(async () => {
                    const token = enlace.split("/").pop();
                    const r = await fetch(`/api/compartir?token=${token}`, {
                      method: "DELETE",
                    });
                    if (!r.ok)
                      throw new Error(
                        "Solo un administrador puede revocar el enlace",
                      );
                    setEnlace(null);
                    toast.success("Enlace revocado");
                  })
                }
              >
                Revocar enlace
              </Button>
            </div>
          )}
          {seleccion != null && plan.colocaciones[seleccion] && (
            <fieldset className="rounded border p-4 space-y-3">
              <legend>Editar bulto #{seleccion + 1}</legend>
              {plan.colocaciones[seleccion].tarimaIdx != null ? (
                <p>
                  La edición individual de cajas paletizadas está restringida
                  para conservar su tarima. Recalcula sus cantidades o
                  parámetros.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {(["x", "y", "z"] as const).map((k) => (
                      <div key={k}>
                        <Label htmlFor={`editar-${k}`}>
                          {k.toUpperCase()} mm
                        </Label>
                        <Input
                          id={`editar-${k}`}
                          type="number"
                          step={1}
                          min={0}
                          value={plan.colocaciones[seleccion!][k]}
                          onChange={(e) => editar(k, Number(e.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                  <Label htmlFor="editar-rotacion">Orientación del bulto</Label>
                  <select
                    id="editar-rotacion"
                    className="border rounded p-2"
                    value={plan.colocaciones[seleccion].orientacion}
                    onChange={(e) => editar("orientacion", e.target.value)}
                  >
                    {plan.materiales
                      .find(
                        (m) =>
                          m.id === plan.colocaciones[seleccion!].materialId,
                      )
                      ?.orientaciones.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                  </select>
                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={bloqueos.includes(seleccion)}
                      onChange={(e) =>
                        setBloqueos((xs) =>
                          e.target.checked
                            ? bloquearConApoyos(plan, [...xs, seleccion])
                            : xs.filter((i) => i !== seleccion),
                        )
                      }
                    />
                    Bloquear posición y sus apoyos
                  </label>
                  <Button
                    disabled={ocupado || !!errores.length}
                    onClick={() =>
                      accion(async () => {
                        if (!entrada) return;
                        const fijos = bloquearConApoyos(plan, bloqueos).map(
                          (i) => plan.colocaciones[i],
                        );
                        const r = await motor.correr("mixto", {
                          ...entrada,
                          bloqueadas: fijos,
                        });
                        setPlan(r.plan);
                        setBloqueos(
                          fijos
                            .map((c) =>
                              r.plan.colocaciones.findIndex(
                                (n) =>
                                  n.materialId === c.materialId &&
                                  n.equipoIdx === c.equipoIdx &&
                                  n.x === c.x &&
                                  n.y === c.y &&
                                  n.z === c.z &&
                                  n.orientacion === c.orientacion,
                              ),
                            )
                            .filter((i) => i >= 0),
                        );
                        setSeleccion(null);
                        setSavedId(null);
                      })
                    }
                  >
                    Reoptimizar el resto
                  </Button>
                </>
              )}
            </fieldset>
          )}
        </section>
      )}
    </div>
  );
}
export function Proyectos() {
  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({ queryKey: ["escenarios"], queryFn: listarEscenarios });
  const [comparar, setComparar] = useState<string[]>([]);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Proyectos y escenarios</h1>
      <a href="/planificar" className="underline">
        Nuevo escenario
      </a>
      {isLoading && <p role="status">Cargando proyectos…</p>}
      {error && (
        <div role="alert">
          No se pudieron cargar los proyectos.{" "}
          <Button onClick={() => refetch()}>Reintentar</Button>
        </div>
      )}
      {!isLoading && !error && !data.length && (
        <div className="rounded border border-dashed p-8 text-center">
          <Ilustracion tipo="sin-proyectos" clase="mx-auto h-32" />
          <p>Sin proyectos. Crea tu primer plan de carga.</p>
        </div>
      )}
      <ul className="grid gap-3 md:grid-cols-2">
        {data.map((r: EscenarioGuardado) => (
          <li key={r.id} className="rounded-xl border p-4">
            <h2 className="font-semibold">{r.nombre}</h2>
            <p className="text-sm text-muted-foreground">
              {new Intl.DateTimeFormat("es-MX", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "America/Mexico_City",
              }).format(new Date(r.fecha))}
            </p>
            <p>
              {r.plan.kpis.unidadesCargadas.toLocaleString("es-MX")} bultos ·
              Versión {r.numeroVersion ?? 1}
            </p>
            <a href={`/planificar?escenario=${r.id}`} className="underline">
              Abrir escenario
            </a>
            <div className="flex flex-wrap gap-2 mt-3">
              <a
                className="underline"
                href={`/planificar?escenario=${r.id}&otroEquipo=1`}
              >
                Probar con otro equipo
              </a>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await guardarEscenario(
                      `${r.nombre} (copia)`,
                      r.entrada,
                      r.plan,
                    );
                    await refetch();
                    toast.success("Escenario duplicado");
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "No se pudo duplicar",
                    );
                  }
                }}
              >
                Duplicar escenario
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await guardarEscenario(
                      r.nombre,
                      r.entrada,
                      r.plan,
                      undefined,
                      r.id,
                    );
                    await refetch();
                    toast.success("Versión restaurada como nueva versión");
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : "No se pudo restaurar",
                    );
                  }
                }}
              >
                Restaurar versión {r.numeroVersion ?? 1}
              </Button>
            </div>

            <label className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={comparar.includes(r.id)}
                onChange={(e) =>
                  setComparar((xs) =>
                    e.target.checked
                      ? xs.length < 2
                        ? [...xs, r.id]
                        : xs
                      : xs.filter((id) => id !== r.id),
                  )
                }
              />
              Comparar (máximo dos)
            </label>
          </li>
        ))}
      </ul>
      {comparar.length === 2 && (
        <section className="grid gap-4 md:grid-cols-2">
          {comparar.map((id) => {
            const r = data.find((r) => r.id === id)!;
            return (
              <article key={id}>
                <h2 className="font-semibold">{r.nombre}</h2>
                <VisorPlan plan={r.plan} className="h-[400px]" />
                <PanelResultado plan={r.plan} />
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
