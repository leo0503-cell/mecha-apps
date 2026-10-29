import { Montacarguista } from "@/components/app/OperacionPlan";
import { CompartirPublico } from "@/components/app/CompartirPublico";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { leerCompartido } from "@/lib/planes/compartido";
import { VisorPlan } from "@/components/visor/VisorPlan";
import { PanelResultado } from "@/components/app/PanelResultado";
import type { Metadata } from "next";
type Props = { params: Promise<{ token: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Plan de carga compartido · CubiCarga",
    robots: { index: false, follow: false },
    openGraph: {
      title: "Plan de carga · CubiCarga",
      images: [`/p/${token}/og`],
    },
  };
}
async function Contenido({ params }: Props) {
  await connection();
  const { token } = await params;
  const data = await leerCompartido(token);
  if (!data) notFound();
  return (
    <main className="mx-auto max-w-7xl p-5 space-y-4">
      <p className="text-sm text-muted-foreground">
        CubiCarga · Plan de solo lectura
      </p>
      <h1 className="text-2xl font-semibold">{data.nombre}</h1>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <VisorPlan plan={data.plan} className="h-[65vh]" />
        <PanelResultado plan={data.plan} />
      </div>
      <Montacarguista plan={data.plan} nombre={data.nombre} />
      <CompartirPublico nombre={data.nombre} />
    </main>
  );
}
export default function Page(p: Props) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-5">
          Cargando plan…
        </p>
      }
    >
      <Contenido {...p} />
    </Suspense>
  );
}
