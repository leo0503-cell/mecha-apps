"use client";
import { useState } from "react";
import { capacidadRack, type EntradaRack } from "@/motor/racks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
const campos: [keyof EntradaRack, string][] = [
  ["frente", "Frente de viga mm"],
  ["fondo", "Fondo mm"],
  ["niveles", "Niveles"],
  ["bahias", "Bahías"],
  ["alturaNivel", "Altura por nivel mm"],
  ["peralte", "Peralte de viga mm"],
  ["holguraLateral", "Holgura lateral mm"],
  ["holguraVertical", "Holgura vertical mm"],
  ["tarimaLargo", "Largo de tarima mm"],
  ["tarimaAncho", "Ancho de tarima mm"],
  ["alturaArmada", "Altura armada mm"],
  ["cargaNivel", "Carga máxima por nivel kg"],
];
export function Almacen() {
  const [p, setP] = useState<EntradaRack>({
    frente: 2438,
    fondo: 1067,
    niveles: 4,
    bahias: 1,
    alturaNivel: 0,
    peralte: 125,
    holguraLateral: 100,
    holguraVertical: 150,
    tarimaLargo: 1016,
    tarimaAncho: 1219,
    alturaArmada: 1800,
    cargaNivel: null,
  });
  const [r, setR] = useState<ReturnType<typeof capacidadRack> | null>(null),
    [error, setError] = useState("");
  return (
    <div className="space-y-5 max-w-4xl">
      <h1 className="text-2xl font-semibold">Capacidad de almacén y racks</h1>
      <p className="text-muted-foreground">
        Rack selectivo: posiciones y volumen de las tarimas armadas. Confirma
        resistencia y condiciones de operación con el proveedor.
      </p>
      <form
        className="grid grid-cols-2 gap-4 rounded-xl border p-5"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            setR(capacidadRack(p));
            setError("");
          } catch {
            setError(
              "Revisa las medidas y cantidades: usa valores positivos en mm y kg.",
            );
          }
        }}
      >
        {campos.map(([k, t]) => (
          <div key={k}>
            <Label htmlFor={`rack-${k}`}>{t}</Label>
            <Input
              id={`rack-${k}`}
              type="number"
              step={k === "cargaNivel" ? 0.001 : 1}
              value={k === "alturaNivel" && p[k] === 0 ? "" : (p[k] ?? "")}
              placeholder={
                k === "alturaNivel" ? "<Altura por nivel>" : undefined
              }
              onChange={(e) => {
                setP((x) => ({
                  ...x,
                  [k]:
                    k === "cargaNivel" && e.target.value === ""
                      ? null
                      : Number(e.target.value),
                }));
                setR(null);
              }}
            />
          </div>
        ))}
        <Button type="submit">Calcular capacidad</Button>
      </form>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      {r && (
        <section className="rounded border p-5">
          <h2 className="text-xl font-semibold">
            {r.posiciones.toLocaleString("es-MX")} posiciones
          </h2>
          <p>
            {r.m3.toLocaleString("es-MX", { maximumFractionDigits: 2 })} m³ ·{" "}
            {r.kg == null
              ? "<Carga máxima por nivel pendiente>"
              : `${r.kg.toLocaleString("es-MX")} kg`}
          </p>
          <ul>
            {r.avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
