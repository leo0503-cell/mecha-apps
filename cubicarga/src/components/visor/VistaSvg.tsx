/**
 * Vistas 2D en SVG: superior (planta) o por capa. Respaldo cuando no hay
 * WebGL y base de la pestaña "Por capas".
 */
import type { Colocacion, PlanCarga } from "@/motor";

interface Props {
  plan: PlanCarga;
  equipoIdx?: number;
  /** Altura de corte (mm): solo bultos que la cruzan. null = vista superior completa. */
  capaZ?: number | null;
  titulo?: string;
}

export default function VistaSvg({
  plan,
  equipoIdx = 0,
  capaZ = null,
  titulo,
}: Props) {
  const e = plan.equipos[equipoIdx];
  if (!e) return null;
  const mats = new Map(plan.materiales.map((m) => [m.id, m]));
  let cols: Colocacion[] = plan.colocaciones.filter(
    (c) => c.equipoIdx === equipoIdx,
  );
  if (capaZ != null)
    cols = cols.filter((c) => c.z <= capaZ && c.z + c.h > capaZ);
  else cols = [...cols].sort((a, b) => a.z + a.h - (b.z + b.h)); // lo más alto se dibuja al final
  const m = 120;
  return (
    <figure className="w-full">
      <svg
        viewBox={`${-m} ${-m} ${e.largo + 2 * m} ${e.ancho + 2 * m}`}
        className="w-full h-auto"
        role="img"
        aria-label={
          titulo ?? `Vista superior de ${e.nombre} con ${cols.length} bultos`
        }
      >
        <rect
          x={0}
          y={0}
          width={e.largo}
          height={e.ancho}
          fill="var(--muted)"
          stroke="var(--foreground)"
          strokeWidth={20}
        />
        <line
          x1={e.largo}
          y1={(e.ancho - e.puertaAncho) / 2}
          x2={e.largo}
          y2={(e.ancho + e.puertaAncho) / 2}
          stroke="#f97316"
          strokeWidth={60}
        />
        {plan.tarimasArmadas
          .filter(
            (t) =>
              t.equipoIdx === equipoIdx &&
              (capaZ == null || (t.z <= capaZ && t.z + t.h > capaZ)),
          )
          .map((t, i) => (
            <rect
              key={`t${i}`}
              x={t.x + t.offset}
              y={t.y + t.offset}
              width={t.l - 2 * t.offset}
              height={t.a - 2 * t.offset}
              fill="#b07a45"
              opacity={0.5}
            />
          ))}
        {cols.map((c, i) => (
          <rect
            key={i}
            x={c.x}
            y={c.y}
            width={c.l}
            height={c.a}
            fill={mats.get(c.materialId)?.color ?? "#0072B2"}
            stroke="#0f2a44"
            strokeWidth={8}
            opacity={0.92}
          />
        ))}
        <text
          x={e.largo + 30}
          y={-30}
          fontSize={140}
          fill="#f97316"
          textAnchor="end"
        >
          puerta →
        </text>
      </svg>
      {titulo && (
        <figcaption className="text-xs text-muted-foreground mt-1">
          {titulo}
        </figcaption>
      )}
    </figure>
  );
}
