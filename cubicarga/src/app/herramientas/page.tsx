import type { Metadata } from "next";
import { Encabezado } from "@/components/app/Encabezado";
import { Herramientas } from "@/components/app/Herramientas";

export const metadata: Metadata = {
  title: "CBM, peso cobrable y W/M · CubiCarga",
};

export default function Page() {
  return (
    <>
      <Encabezado />
      <main className="flex-1">
        <Herramientas />
      </main>
    </>
  );
}
