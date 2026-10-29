import Link from "next/link";
import { Menu } from "lucide-react";
const rutas = [
  ["/calculadora", "Calculadora"],
  ["/planificar", "Planificar"],
  ["/proyectos", "Proyectos"],
  ["/almacen", "Almacén"],
  ["/herramientas", "Herramientas"],
  ["/catalogos", "Catálogos"],
];
/** La portada usa navegación HTML; los controles de operación cargan al entrar. */
export function EncabezadoInicio() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-6 px-4">
        <Link
          href="/"
          prefetch={false}
          className="flex items-center gap-2 font-semibold"
        >
          <svg viewBox="0 0 192 192" className="size-8" aria-hidden>
            <image href="/logo-cubo.svg" width="192" height="192" />
          </svg>
          CubiCarga
        </Link>
        <nav aria-label="Principal" className="ml-auto hidden gap-4 lg:flex">
          {rutas.map(([href, t]) => (
            <Link
              key={href}
              href={href}
              prefetch={false}
              className="text-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              {t}
            </Link>
          ))}
        </nav>
        <details className="relative ml-auto lg:hidden">
          <summary className="flex cursor-pointer items-center gap-2 rounded p-2 focus-visible:outline-2">
            <Menu className="size-6" aria-hidden />
            <span className="sr-only">Menú</span>
          </summary>
          <nav
            aria-label="Principal móvil"
            className="absolute right-0 top-full grid w-56 gap-2 rounded border bg-card p-4 shadow-lg"
          >
            {rutas.map(([href, t]) => (
              <Link
                key={href}
                href={href}
                prefetch={false}
                className="rounded p-2 text-sm hover:bg-muted focus-visible:outline-2"
              >
                {t}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
