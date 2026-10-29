import { Encabezado } from "@/components/app/Encabezado";
import { Planificador } from "@/components/app/Planificador";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { z } from "zod";
import { hayBackend } from "@/lib/supabase/config";
import { supabaseServidor } from "@/lib/supabase/servidor";
async function Acceso({
  searchParams,
}: Pick<PageProps<"/planificar">, "searchParams">) {
  await connection();
  const { escenario } = await searchParams;
  if (hayBackend && escenario) {
    const id = z.uuid().safeParse(escenario);
    if (!id.success) notFound();
    const sb = await supabaseServidor();
    const { data, error } = await sb
      .from("calculos")
      .select("id")
      .eq("id", id.data)
      .maybeSingle();
    if (error || !data) notFound();
  }
  return <Planificador />;
}
export default function Page({ searchParams }: PageProps<"/planificar">) {
  return (
    <>
      <Encabezado />
      <main className="mx-auto w-full max-w-7xl px-4 py-8">
        <Suspense fallback={<p role="status">Cargando escenario…</p>}>
          <Acceso searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}
