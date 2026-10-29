/** SVG locales generados en código; las etiquetas del equipo siguen siendo texto. */
export function Ilustracion({
  tipo,
  clase = "",
}: {
  tipo: string;
  clase?: string;
}) {
  return (
    <svg aria-hidden viewBox="0 0 360 250" className={clase}>
      <image href={`/ilustraciones/${tipo}.svg`} width="360" height="250" />
    </svg>
  );
}
export function iconoEquipo(codigo: string, categoria: string) {
  return codigo.startsWith("20")
    ? "20dv"
    : codigo === "40HC"
      ? "40hc"
      : categoria === "contenedor" || categoria === "reefer"
        ? "40dv"
        : categoria === "uld"
          ? "uld"
          : categoria === "caja_seca"
            ? "caja-seca"
            : codigo.toLowerCase().includes("torton")
              ? "torton"
              : codigo.toLowerCase().includes("rabon")
                ? "rabon"
                : "camioneta";
}
