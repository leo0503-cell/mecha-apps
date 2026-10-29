"use client";
import Link from "next/link";
import { useId } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Boxes,
  Calculator,
  Library,
  Menu,
  Moon,
  Sun,
  Wrench,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { hayBackend } from "@/lib/supabase/config";
import { useSesion, type Rol } from "@/lib/sesion";
import type { UnidadLongitud, UnidadPeso } from "@/motor";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/calculadora", label: "Calculadora", icono: Calculator },
  { href: "/planificar", label: "Planificar", icono: Boxes },
  { href: "/proyectos", label: "Proyectos", icono: Library },
  { href: "/almacen", label: "Almacén", icono: Boxes },
  { href: "/herramientas", label: "Herramientas", icono: Wrench },
  { href: "/catalogos", label: "Catálogos", icono: Library },
];

const ROLES: { v: Rol; t: string }[] = [
  { v: "visor", t: "Visor" },
  { v: "planeador", t: "Planeador" },
  { v: "admin", t: "Admin de empresa" },
  { v: "superadmin", t: "Superadmin" },
];

export function Logo() {
  return (
    <Link
      prefetch={false}
      href="/"
      className="flex items-center gap-2 font-semibold tracking-tight"
    >
      <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
        <Boxes className="size-5" aria-hidden />
      </span>
      CubiCarga
    </Link>
  );
}

function Preferencias() {
  const prefijo = useId(),
    idLong = prefijo + "-long",
    idPeso = prefijo + "-peso",
    idRol = prefijo + "-rol";
  const s = useSesion();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label className="sr-only" htmlFor={idLong}>
        Unidad de longitud
      </label>
      <select
        id={idLong}
        className="h-8 rounded-md border bg-background px-2"
        value={s.unidadLong}
        onChange={(e) =>
          s.setUnidades(e.target.value as UnidadLongitud, s.unidadPeso)
        }
      >
        {["mm", "cm", "m", "in", "ft"].map((u) => (
          <option key={u}>{u}</option>
        ))}
      </select>
      <label className="sr-only" htmlFor={idPeso}>
        Unidad de peso
      </label>
      <select
        id={idPeso}
        className="h-8 rounded-md border bg-background px-2"
        value={s.unidadPeso}
        onChange={(e) =>
          s.setUnidades(s.unidadLong, e.target.value as UnidadPeso)
        }
      >
        {["kg", "lb"].map((u) => (
          <option key={u}>{u}</option>
        ))}
      </select>
      {!hayBackend && (
        <>
          <label className="sr-only" htmlFor={idRol}>
            Rol (modo local)
          </label>
          <select
            id={idRol}
            title="Modo local: elige el rol para probar permisos"
            className="h-8 rounded-md border bg-background px-2"
            value={s.rol}
            onChange={(e) => s.setRol(e.target.value as Rol)}
          >
            {ROLES.map((r) => (
              <option key={r.v} value={r.v}>
                {r.t}
              </option>
            ))}
          </select>
        </>
      )}
      {hayBackend &&
        (s.email ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () =>
              (await import("@/lib/supabase/cliente")).supabase().auth.signOut()
            }
          >
            Salir
          </Button>
        ) : (
          <Link prefetch={false} href="/entrar" className="text-sm underline">
            Entrar
          </Link>
        ))}
      <Button
        variant="ghost"
        size="icon"
        aria-label="Cambiar tema"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        <Sun className="hidden dark:block" />
        <Moon className="dark:hidden" />
      </Button>
    </div>
  );
}

export function Encabezado() {
  const ruta = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4">
        <Logo />
        <nav
          className="hidden xl:flex items-center gap-1"
          aria-label="Principal"
        >
          {NAV.map((n) => (
            <Link
              prefetch={false}
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                ruta.startsWith(n.href) &&
                  "bg-muted text-foreground font-medium",
              )}
            >
              <n.icono className="size-5" aria-hidden />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden xl:block">
          <Preferencias />
        </div>
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto xl:hidden"
                aria-label="Menú"
              />
            }
          >
            <Menu className="size-6" />
          </SheetTrigger>
          <SheetContent side="right" className="p-4">
            <SheetTitle>Menú</SheetTitle>
            <nav
              className="mt-4 flex flex-col gap-1"
              aria-label="Principal móvil"
            >
              {NAV.map((n) => (
                <Link
                  prefetch={false}
                  key={n.href}
                  href={n.href}
                  className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted"
                >
                  <n.icono className="size-5" aria-hidden /> {n.label}
                </Link>
              ))}
            </nav>
            <div className="mt-6">
              <Preferencias />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      {!hayBackend && (
        <p className="border-t bg-muted/60 px-4 py-1 text-center text-xs text-muted-foreground">
          Modo local: tus catálogos se guardan en este navegador. Conecta
          Supabase para cuentas, empresas y proyectos compartidos.
        </p>
      )}
    </header>
  );
}
