"use client";
/** Calculadoras rápidas: CBM, peso volumétrico, W/M LCL, conversor y densidad. */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSesion } from "@/lib/sesion";
import {
  aMm,
  equipoPorCodigo,
  volumenUtil,
  cbm,
  desdeKg,
  desdeMm,
  FACTORES_COBRO,
  pesoCobrableAereo,
  revenueTon,
  type BultoCobro,
  type UnidadLongitud,
  type UnidadPeso,
} from "@/motor";
import { CampoMedida } from "./CampoMedida";
import { num } from "./formato";

type Fila = {
  id: number;
  l: number | null;
  a: number | null;
  h: number | null;
  peso: number | null;
  cantidad: number;
};

function Resultado({
  etiqueta,
  valor,
  fuerte,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t py-1.5 first:border-t-0">
      <span className="text-sm text-muted-foreground">{etiqueta}</span>
      <span className={`num ${fuerte ? "text-lg font-semibold" : ""}`}>
        {valor}
      </span>
    </div>
  );
}

function Bultos({
  filas,
  setFilas,
}: {
  filas: Fila[];
  setFilas: (f: Fila[]) => void;
}) {
  const { unidadLong, unidadPeso } = useSesion();
  const set = (id: number, k: keyof Fila, v: number | null) =>
    setFilas(filas.map((f) => (f.id === id ? { ...f, [k]: v } : f)));
  return (
    <div className="space-y-2">
      {filas.map((f, i) => (
        <fieldset
          key={f.id}
          className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_1fr_1fr_80px_auto] sm:items-end"
        >
          <legend className="sr-only">Bulto {i + 1}</legend>
          {(["l", "a", "h"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`b${f.id}${k}`} className="text-xs">
                {k === "l" ? "Largo" : k === "a" ? "Ancho" : "Alto"}
              </Label>
              <CampoMedida
                id={`b${f.id}${k}`}
                tipo="longitud"
                unidad={unidadLong}
                valor={f[k]}
                onCambio={(v) => set(f.id, k, v)}
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor={`b${f.id}p`} className="text-xs">
              Peso c/u
            </Label>
            <CampoMedida
              id={`b${f.id}p`}
              tipo="peso"
              unidad={unidadPeso}
              valor={f.peso}
              onCambio={(v) => set(f.id, "peso", v)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`b${f.id}c`} className="text-xs">
              Cantidad
            </Label>
            <Input
              id={`b${f.id}c`}
              className="num"
              inputMode="numeric"
              value={f.cantidad}
              onChange={(e) =>
                set(
                  f.id,
                  "cantidad",
                  Math.max(0, Math.round(Number(e.target.value) || 0)),
                )
              }
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Quitar bulto ${i + 1}`}
            disabled={filas.length === 1}
            onClick={() => setFilas(filas.filter((x) => x.id !== f.id))}
          >
            <Trash2 />
          </Button>
        </fieldset>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setFilas([
            ...filas,
            {
              id: Date.now(),
              l: null,
              a: null,
              h: null,
              peso: null,
              cantidad: 1,
            },
          ])
        }
      >
        <Plus /> Agregar bulto
      </Button>
    </div>
  );
}

const completos = (fs: Fila[]): BultoCobro[] =>
  fs
    .filter((f) => f.l && f.a && f.h && f.peso != null && f.cantidad > 0)
    .map((f) => ({
      l: f.l!,
      a: f.a!,
      h: f.h!,
      peso: f.peso!,
      cantidad: f.cantidad,
    }));

export function Herramientas() {
  const { unidadPeso } = useSesion();
  const [filas, setFilas] = useState<Fila[]>([
    { id: 1, l: 500, a: 400, h: 300, peso: 8, cantidad: 3 },
  ]);
  const [divisor, setDivisor] = useState<number>(FACTORES_COBRO.aereoDivisor);
  const [minimoRt, setMinimoRt] = useState(1);
  const bs = completos(filas);
  const vol = cbm(bs);
  const kg = bs.reduce((s, b) => s + b.peso * b.cantidad, 0);
  const aereo = bs.length ? pesoCobrableAereo(bs, divisor || 1) : null;
  const lcl = bs.length ? revenueTon(vol, kg, minimoRt) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Herramientas rápidas</h1>
      <Card>
        <CardHeader>
          <CardTitle>Tus bultos</CardTitle>
          <CardDescription>
            Medidas exteriores con empaque. Sirven para CBM, peso volumétrico y
            W/M.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Bultos filas={filas} setFilas={setFilas} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>CBM</CardTitle>
          </CardHeader>
          <CardContent>
            <Resultado etiqueta="Volumen" valor={`${num(vol, 3)} m³`} fuerte />
            <Resultado
              etiqueta="Peso real"
              valor={`${num(desdeKg(kg, unidadPeso), 2)} ${unidadPeso}`}
            />
            <Resultado
              etiqueta="Piezas"
              valor={num(bs.reduce((s, b) => s + b.cantidad, 0))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Peso cobrable aéreo / express</CardTitle>
            <CardDescription>
              max(real, L×A×H cm ÷ divisor), al siguiente 0.5 kg.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="div" className="whitespace-nowrap">
                Divisor
              </Label>
              <Input
                id="div"
                className="num"
                inputMode="numeric"
                value={divisor}
                onChange={(e) => setDivisor(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex gap-1">
              <Button
                size="xs"
                variant={divisor === 6000 ? "default" : "outline"}
                onClick={() => setDivisor(6000)}
              >
                Aéreo IATA 6,000
              </Button>
              <Button
                size="xs"
                variant={divisor === 5000 ? "default" : "outline"}
                onClick={() => setDivisor(5000)}
              >
                Express 5,000
              </Button>
            </div>
            {aereo && (
              <div>
                <Resultado
                  etiqueta="Peso real"
                  valor={`${num(aereo.pesoRealKg, 1)} kg`}
                />
                <Resultado
                  etiqueta="Volumétrico"
                  valor={`${num(aereo.pesoVolumetricoKg, 1)} kg`}
                />
                <Resultado
                  etiqueta={`Cobrable (${aereo.cobraPor === "real" ? "por peso real" : "por volumen"})`}
                  valor={`${num(aereo.pesoCobrableKg, 1)} kg`}
                  fuerte
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Marítimo LCL (W/M)</CardTitle>
            <CardDescription>
              1 m³ = 1,000 kg. Se cobra lo mayor, redondeo a 0.1.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="min" className="whitespace-nowrap">
                Mínimo R/T
              </Label>
              <Input
                id="min"
                className="num"
                inputMode="decimal"
                value={minimoRt}
                onChange={(e) => setMinimoRt(Number(e.target.value) || 0)}
              />
            </div>
            {lcl && (
              <div>
                <Resultado etiqueta="m³" valor={num(lcl.m3, 3)} />
                <Resultado etiqueta="Toneladas" valor={num(lcl.toneladas, 3)} />
                <Resultado
                  etiqueta={`Se cobra (${lcl.cobraPor === "minimo" ? "mínimo" : lcl.cobraPor})`}
                  valor={`${num(lcl.rt, 1)} R/T`}
                  fuerte
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Conversor />
        <Densidad />
      </div>
    </div>
  );
}

function Conversor() {
  const [v, setV] = useState("1");
  const [u, setU] = useState<UnidadLongitud | UnidadPeso>("in");
  const n = Number(v.replace(",", "."));
  const esPeso = u === "kg" || u === "lb";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conversor de unidades</CardTitle>
        <CardDescription>1 in = 25.4 mm · 1 lb = 0.45359237 kg</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex gap-2">
          <Label htmlFor="conv" className="sr-only">
            Valor
          </Label>
          <Input
            id="conv"
            className="num"
            inputMode="decimal"
            value={v}
            onChange={(e) => setV(e.target.value)}
          />
          <Label htmlFor="convu" className="sr-only">
            Unidad
          </Label>
          <select
            id="convu"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            value={u}
            onChange={(e) => setU(e.target.value as UnidadLongitud)}
          >
            {["mm", "cm", "m", "in", "ft", "kg", "lb"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
        {Number.isFinite(n) &&
          (esPeso
            ? (["kg", "lb"] as UnidadPeso[]).map((d) => (
                <Resultado
                  key={d}
                  etiqueta={d}
                  valor={num(desdeKg(u === "kg" ? n : n * 0.45359237, d), 4)}
                />
              ))
            : (["mm", "cm", "m", "in", "ft"] as UnidadLongitud[]).map((d) => (
                <Resultado
                  key={d}
                  etiqueta={d}
                  valor={num(
                    desdeMm(n * (aMm(1000, u as UnidadLongitud) / 1000), d),
                    4,
                  )}
                />
              )))}
      </CardContent>
    </Card>
  );
}

function Densidad() {
  const { unidadLong, unidadPeso } = useSesion();
  const [d, setD] = useState<{
    l: number | null;
    a: number | null;
    h: number | null;
    p: number | null;
  }>({ l: 600, a: 400, h: 400, p: 15 });
  const v = d.l && d.a && d.h ? (d.l * d.a * d.h) / 1e9 : 0;
  const dens = v && d.p ? d.p / v : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Densidad</CardTitle>
        <CardDescription>
          Compárala con la del equipo para saber si te limitará el peso o el
          volumen.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-4 gap-2">
          {(["l", "a", "h"] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`d${k}`} className="text-xs">
                {k === "l" ? "Largo" : k === "a" ? "Ancho" : "Alto"}
              </Label>
              <CampoMedida
                id={`d${k}`}
                tipo="longitud"
                unidad={unidadLong}
                valor={d[k]}
                onCambio={(x) => setD({ ...d, [k]: x })}
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor="dp" className="text-xs">
              Peso
            </Label>
            <CampoMedida
              id="dp"
              tipo="peso"
              unidad={unidadPeso}
              valor={d.p}
              onCambio={(x) => setD({ ...d, p: x })}
            />
          </div>
        </div>
        <Resultado etiqueta="Densidad" valor={`${num(dens, 1)} kg/m³`} fuerte />
        {["20DV", "40HC", "CS53"].map((c) => {
          const e = equipoPorCodigo(c);
          return (
            <Resultado
              key={c}
              etiqueta={`${e.nombre} aguanta`}
              valor={`${num((e.cargaUtil ?? 0) / volumenUtil(e), 0)} kg/m³`}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
