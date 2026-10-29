import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/app/Encabezado";
import {
  CatalogoCrud,
  PestanasCatalogo,
} from "@/components/app/catalogos/CatalogoCrud";
import { CATALOGOS } from "@/components/app/catalogos/config";
import type { Entidad } from "@/lib/datos/tipos";

export function generateStaticParams() {
  return Object.keys(CATALOGOS).map((entidad) => ({ entidad }));
}

export async function generateMetadata({
  params,
}: PageProps<"/catalogos/[entidad]">): Promise<Metadata> {
  const { entidad } = await params;
  return {
    title: `${CATALOGOS[entidad as Entidad]?.titulo ?? "Catálogos"} · CubiCarga`,
  };
}

export default async function Page({
  params,
}: PageProps<"/catalogos/[entidad]">) {
  const { entidad } = await params;
  if (!(entidad in CATALOGOS)) notFound();
  return (
    <>
      <Encabezado />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4">
        <PestanasCatalogo actual={entidad as Entidad} />
        <CatalogoCrud entidad={entidad as Entidad} />
      </main>
    </>
  );
}
