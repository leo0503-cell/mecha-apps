"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import { hayBackend, supabase } from "@/lib/supabase/cliente";

const esquema = z.object({
  email: z.email("Correo no válido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  nombre: z.string().optional(),
});
type Datos = z.infer<typeof esquema>;

export function Entrar() {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "registro">("entrar");
  const { register, handleSubmit, formState } = useForm<Datos>({
    resolver: zodResolver(esquema),
  });

  if (!hayBackend)
    return (
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Cuentas todavía sin conectar</CardTitle>
          <CardDescription>
            Esta instalación corre en modo local: catálogos y cálculos viven en
            tu navegador y el rol se elige arriba para probar permisos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Para cuentas, empresas y proyectos compartidos, agrega en{" "}
            <code className="num">.env.local</code>:
          </p>
          <pre className="num overflow-x-auto rounded bg-muted p-2 text-xs">
            NEXT_PUBLIC_SUPABASE_URL=…{"\n"}NEXT_PUBLIC_SUPABASE_ANON_KEY=…
          </pre>
          <Link className="underline" href="/calculadora">
            Volver a la calculadora
          </Link>
        </CardContent>
      </Card>
    );

  const enviar = handleSubmit(async ({ email, password, nombre }) => {
    const sb = supabase();
    const r =
      modo === "entrar"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({
            email,
            password,
            options: { data: { nombre } },
          });
    if (r.error) return toast.error(r.error.message);
    if (modo === "registro" && !r.data.session)
      return toast.success("Revisa tu correo para confirmar la cuenta");
    router.push("/catalogos");
  });

  const e = formState.errors;
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>{modo === "entrar" ? "Entrar" : "Crear cuenta"}</CardTitle>
        <CardDescription>
          Guarda proyectos, exporta el plan y compártelo con el montacarguista.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="space-y-3" noValidate>
          {modo === "registro" && (
            <div className="space-y-1">
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" autoComplete="name" {...register("nombre")} />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              aria-invalid={!!e.email || undefined}
            />
            {e.email && <p className="text-xs text-mal">{e.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete={
                modo === "entrar" ? "current-password" : "new-password"
              }
              {...register("password")}
              aria-invalid={!!e.password || undefined}
            />
            {e.password && (
              <p className="text-xs text-mal">{e.password.message}</p>
            )}
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={formState.isSubmitting}
          >
            {modo === "entrar" ? "Entrar" : "Crear cuenta"}
          </Button>
          <button
            type="button"
            className="w-full text-sm underline"
            onClick={() => setModo(modo === "entrar" ? "registro" : "entrar")}
          >
            {modo === "entrar"
              ? "¿No tienes cuenta? Créala"
              : "Ya tengo cuenta"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
