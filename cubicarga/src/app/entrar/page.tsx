import type { Metadata } from "next";
import { Encabezado } from "@/components/app/Encabezado";
import { Entrar } from "@/components/app/Entrar";

export const metadata: Metadata = { title: "Entrar · CubiCarga" };

export default function Page() {
  return (
    <>
      <Encabezado />
      <main className="grid flex-1 place-items-center p-4">
        <Entrar />
      </main>
    </>
  );
}
