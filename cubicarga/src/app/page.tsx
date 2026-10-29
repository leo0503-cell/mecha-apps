import Image from "next/image";
import { HeroAnimado } from "@/components/app/HeroAnimado";
import Link from "next/link";
import {
  ArrowRight,
  Box,
  FileDown,
  MessageCircle,
  Ruler,
  Scale,
  Truck,
} from "lucide-react";
import { EncabezadoInicio } from "@/components/app/EncabezadoInicio";
import { buttonVariants } from "@/components/ui/button-estilos";
import { cn } from "@/lib/utils";

const BENEFICIOS = [
  {
    icono: Box,
    t: "Contenedores llenos, no medio vacíos",
    d: "El motor prueba orientaciones mixtas y busca huecos para aprovechar el espacio disponible.",
  },
  {
    icono: Scale,
    t: "Sabes qué te limita",
    d: "Peso, volumen, altura o puerta: lo ves con barras y en una frase, antes de reservar el flete.",
  },
  {
    icono: Truck,
    t: "Cero sorpresas el día de la carga",
    d: "Valida puerta, altura útil, apilado y carga útil del equipo. Lo que no cabe sale listado con su motivo.",
  },
  {
    icono: FileDown,
    t: "Plan para el montacarguista",
    d: "Secuencia paso a paso en 3D, desde el fondo hasta la puerta, que se abre en el celular.",
  },
];

const PASOS = [
  {
    n: 1,
    t: "Captura tu carga",
    d: "Medidas exteriores con empaque, peso y si se puede voltear o apilar. En mm, cm, pulgadas o pies.",
  },
  {
    n: 2,
    t: "Elige el equipo",
    d: "20', 40', 40' HC, reefer, caja seca 53', torton, rabón, ULD aéreo o tu equipo personalizado.",
  },
  {
    n: 3,
    t: "Carga con el plan",
    d: "Ve el acomodo en 3D, compara escenarios y comparte el plan paso a paso.",
  },
];

const FAQ = [
  {
    p: "¿Las medidas de los contenedores son exactas?",
    r: "Son referenciales: varían por fabricante, naviera y carrocería. Cada equipo es editable para que uses las medidas de tu proveedor.",
  },
  {
    p: "¿Considera la NOM-012 para carretera?",
    r: "La carga útil de cada caja seca es editable. En México depende de la configuración del vehículo y de la NOM-012-SCT-2 vigente; valídala con tu transportista.",
  },
  {
    p: "¿Necesito cuenta?",
    r: "No para la calculadora rápida. Con cuenta guardas proyectos, catálogos de tu empresa y exportas el plan.",
  },
  {
    p: "¿Calcula peso cobrable?",
    r: "Sí: aéreo (divisor 6,000), paquetería (5,000, editable) y marítimo LCL W/M con mínimo de 1 R/T.",
  },
];

export default function Inicio() {
  return (
    <div
      className="flex min-h-dvh flex-col"
      style={{
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <EncabezadoInicio />
      <main
        className="flex-1"
        style={{
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <section className="border-b bg-gradient-to-b from-muted/60 to-background">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-2 md:items-center">
            <div>
              <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground">
                <Ruler className="size-3.5" aria-hidden /> Para comercio
                exterior, logística y almacén
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
                Deja de calcular la carga a ojo.
              </h1>
              <p className="mt-4 text-lg text-muted-foreground text-pretty">
                CubiCarga calcula cuánta mercancía cabe en tarimas,
                contenedores, cajas secas y ULD, y te da el acomodo en 3D con la
                secuencia de carga.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  prefetch={false}
                  href="/calculadora"
                  className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
                >
                  Calcular gratis <ArrowRight aria-hidden />
                </Link>
                <Link
                  prefetch={false}
                  href="/herramientas"
                  className={cn(
                    buttonVariants({ size: "lg", variant: "outline" }),
                    "h-11 px-5",
                  )}
                >
                  CBM y peso cobrable
                </Link>
              </div>
            </div>
            <HeroAnimado>
              <ContenedorIlustrado />
            </HeroAnimado>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-semibold">Lo que resuelve</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {BENEFICIOS.map((b) => (
              <div key={b.t} className="rounded-lg border bg-card p-5">
                <b.icono className="size-5 text-primary" aria-hidden />
                <h3 className="mt-3 font-medium">{b.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{b.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-10">
          <h2 className="text-2xl font-semibold">Planea con una vista clara</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {[
              ["hero-contenedor", "Ilustración provisional de un contenedor"],
              [
                "bodega-tarimas",
                "Ilustración provisional para la sección de almacén",
              ],
              [
                "operador-carga",
                "Ilustración provisional para la sección de operación",
              ],
            ].map(([archivo, alt]) => (
              <figure
                key={archivo}
                className="overflow-hidden rounded-xl border bg-card"
              >
                <Image
                  src={"/img/" + archivo + ".webp"}
                  width={1920}
                  height={1080}
                  sizes="(max-width: 768px) 100vw, 33vw"
                  alt={alt}
                  className="aspect-video w-full object-cover"
                />
                <figcaption className="p-3 text-sm text-muted-foreground">
                  Vista referencial · {alt}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
        <section className="border-y bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-12">
            <h2 className="text-2xl font-semibold">Cómo funciona</h2>
            <ol className="mt-6 grid gap-4 md:grid-cols-3">
              {PASOS.map((p) => (
                <li key={p.n} className="rounded-lg border bg-card p-5">
                  <span className="grid size-8 place-items-center rounded-full bg-primary font-semibold text-primary-foreground">
                    {p.n}
                  </span>
                  <h3 className="mt-3 font-medium">{p.t}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{p.d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-semibold">Elige cómo trabajar</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Plan
              nombre="Calculadora rápida"
              precio="Sin cuenta"
              puntos={[
                "Calculadora rápida",
                "Captura en distintas unidades",
                "Vista 3D y respaldo 2D",
              ]}
            />
            <Plan
              nombre="Planificación"
              precio="CubiCarga"
              puntos={[
                "Proyectos ilimitados",
                "Informe PDF, Excel y PNG",
                "Link para montacarguista",
              ]}
            />
            <Plan
              nombre="Trabajo en equipo"
              precio="CubiCarga"
              puntos={[
                "Usuarios y roles",
                "Catálogos y tarifas propias",
                "Almacén y racks",
              ]}
            />
          </div>
        </section>

        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-3xl px-4 py-12">
            <h2 className="text-2xl font-semibold">Preguntas frecuentes</h2>
            <div className="mt-4 divide-y rounded-lg border bg-card">
              {FAQ.map((f) => (
                <details key={f.p} className="group p-4">
                  <summary className="cursor-pointer font-medium">
                    {f.p}
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{f.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t px-4 py-6 text-center text-xs text-muted-foreground">
        Medidas y cargas útiles referenciales. Valida con tu
        naviera/transportista y con la NOM-012-SCT-2 para carretera.
      </footer>
      <a
        href="https://wa.me/?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20de%20CubiCarga"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-medium text-[#0b2e17] shadow-lg"
        aria-label="Escríbenos por WhatsApp"
      >
        <MessageCircle className="size-5" aria-hidden /> WhatsApp
      </a>
    </div>
  );
}

function Plan({
  nombre,
  precio,
  puntos,
}: {
  nombre: string;
  precio: string;
  puntos: string[];
}) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <h3 className="font-medium">{nombre}</h3>
      <p className="mt-2 text-2xl font-semibold">{precio}</p>
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        {puntos.map((p) => (
          <li key={p}>• {p}</li>
        ))}
      </ul>
    </div>
  );
}

/** Contenedor isométrico que se va llenando (CSS, sin WebGL). */
function ContenedorIlustrado() {
  const cajas = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-md" aria-hidden>
      <svg viewBox="0 0 400 300" className="h-full w-full">
        <polygon
          points="40,200 260,260 360,200 140,140"
          fill="var(--muted)"
          stroke="var(--foreground)"
          strokeWidth="1.5"
        />
        <polygon
          points="40,200 40,90 140,30 140,140"
          fill="none"
          stroke="var(--foreground)"
          strokeOpacity=".35"
        />
        <polygon
          points="140,140 140,30 360,90 360,200"
          fill="none"
          stroke="var(--foreground)"
          strokeOpacity=".35"
        />
        {cajas.map((i) => {
          const col = i % 6;
          const fila = Math.floor(i / 6) % 2;
          const piso = Math.floor(i / 12);
          const x = 60 + col * 34 + fila * 18;
          const y = 190 + col * 9 - fila * 11 - piso * 34;
          return (
            <g
              key={i}
              className="caja-entra"
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              <polygon
                points={`${x},${y} ${x + 30},${y + 8} ${x + 46},${y - 2} ${x + 16},${y - 10}`}
                fill="#f97316"
              />
              <polygon
                points={`${x},${y} ${x},${y + 28} ${x + 30},${y + 36} ${x + 30},${y + 8}`}
                fill="#c2570f"
              />
              <polygon
                points={`${x + 30},${y + 8} ${x + 30},${y + 36} ${x + 46},${y + 26} ${x + 46},${y - 2}`}
                fill="#9a4410"
              />
            </g>
          );
        })}
        <polygon
          points="260,260 260,150 360,90 360,200"
          fill="none"
          stroke="#f97316"
          strokeWidth="3"
        />
      </svg>
      <style>{`
        .caja-entra { opacity: 0; animation: entra 0.5s ease-out forwards; }
        @keyframes entra { from { opacity: 0; transform: translate(30px, 12px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .caja-entra { animation: none; opacity: 1; } }
      `}</style>
    </div>
  );
}
