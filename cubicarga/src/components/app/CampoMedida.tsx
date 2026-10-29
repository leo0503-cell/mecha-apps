"use client";
/** Input numérico que captura en la unidad elegida y entrega mm o kg. */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  aKg,
  aMm,
  desdeKg,
  desdeMm,
  type UnidadLongitud,
  type UnidadPeso,
} from "@/motor";

function fmt(v: number) {
  return String(Number(v.toFixed(3)));
}

type Props = {
  id: string;
  valor: number | null | undefined;
  onCambio: (v: number | null) => void;
  disabled?: boolean;
  invalido?: boolean;
} & (
  | { tipo: "longitud"; unidad: UnidadLongitud }
  | { tipo: "peso"; unidad: UnidadPeso }
);

export function CampoMedida(p: Props) {
  const mostrar = (v: number | null | undefined) =>
    v == null
      ? ""
      : fmt(
          p.tipo === "longitud" ? desdeMm(v, p.unidad) : desdeKg(v, p.unidad),
        );
  const [texto, setTexto] = useState(mostrar(p.valor));
  const [previo, setPrevio] = useState({
    valor: p.valor ?? null,
    unidad: p.unidad,
  });

  // Si cambia la unidad o el valor desde fuera, reescribe el texto (sin efecto: ajuste en render).
  if (previo.valor !== (p.valor ?? null) || previo.unidad !== p.unidad) {
    const n = texto === "" ? null : Number(texto.replace(",", "."));
    const enTexto =
      n == null || !Number.isFinite(n)
        ? null
        : p.tipo === "longitud"
          ? aMm(n, previo.unidad as UnidadLongitud)
          : aKg(n, previo.unidad as UnidadPeso);
    if (previo.unidad !== p.unidad || enTexto !== (p.valor ?? null))
      setTexto(mostrar(p.valor));
    setPrevio({ valor: p.valor ?? null, unidad: p.unidad });
  }

  return (
    <div className="relative">
      <Input
        id={p.id}
        inputMode="decimal"
        className="num pr-10"
        value={texto}
        disabled={p.disabled}
        aria-invalid={p.invalido || undefined}
        onChange={(e) => {
          const t = e.target.value;
          setTexto(t);
          const n = Number(t.replace(",", "."));
          if (t.trim() === "" || !Number.isFinite(n)) return p.onCambio(null);
          p.onCambio(
            p.tipo === "longitud" ? aMm(n, p.unidad) : aKg(n, p.unidad),
          );
        }}
      />
      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-muted-foreground">
        {p.unidad}
      </span>
    </div>
  );
}
