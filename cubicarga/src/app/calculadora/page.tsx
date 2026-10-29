import type { Metadata } from "next";
import { Calculadora } from "@/components/app/Calculadora";
import { Encabezado } from "@/components/app/Encabezado";

export const metadata: Metadata = {
  title: "Calculadora de cubicaje · CubiCarga",
};

export default function Page() {
  return (
    <>
      <Encabezado />
      <main className="flex-1">
        <Calculadora />
      </main>
    </>
  );
}
