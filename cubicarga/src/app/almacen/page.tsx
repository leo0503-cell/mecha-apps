import { Encabezado } from "@/components/app/Encabezado";
import { Almacen } from "@/components/app/Almacen";
export default function Page() {
  return (
    <>
      <Encabezado />
      <main className="mx-auto w-full max-w-7xl px-4 py-8">
        <Almacen />
      </main>
    </>
  );
}
