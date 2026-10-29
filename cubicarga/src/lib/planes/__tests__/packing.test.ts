import { describe, expect, it } from "vitest";
import {
  leerCsv,
  validarPacking,
  importarPacking,
  CABECERAS,
} from "../packing";
import { htmlInforme, planParaExportar } from "../exportar";
import { calcularHomogeneo, equipoPorCodigo } from "@/motor";
import { capacidadRack } from "@/motor/racks";
const fila = ["A", "Caja", 600, 400, 400, 15, 2, 1];
describe("Importación segura", () => {
  it("lee comas, comillas y saltos dentro de campos", () =>
    expect(leerCsv('sku,nombre\r\nA,"Caja, \"\"grande\"\"\nfrágil"')).toEqual([
      ["sku", "nombre"],
      ["A", 'Caja, "grande"\nfrágil'],
    ]));
  it("detecta cierre de comillas ausente", () =>
    expect(() => leerCsv('a,"b')).toThrow());
  it("convierte mm/kg y preserva parada", () => {
    const p = validarPacking([CABECERAS, fila]);
    expect(p.errores).toEqual([]);
    expect(p.items[0].material.largo).toBe(600);
    expect(p.items[0].cantidad).toBe(2);
  });
  it("marca filas inválidas y duplicadas sin aplicarlas", () => {
    const p = validarPacking([
      CABECERAS,
      fila,
      fila,
      ["B", "B", 0, 400, 400, 15, 2, 1],
    ]);
    expect(p.errores).toHaveLength(2);
    expect(p.items).toHaveLength(1);
  });
  it("rechaza más de 5000 filas y más de 5 MB", async () => {
    expect(() =>
      validarPacking([CABECERAS, ...Array(5001).fill(fila)]),
    ).toThrow();
    await expect(
      importarPacking(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "x.csv")),
    ).rejects.toThrow("5 MB");
  });
  it("importa XLSX y rechaza fórmulas", async () => {
    const { default: Excel } = await import("exceljs");
    const w = new Excel.Workbook();
    const s = w.addWorksheet("Carga");
    s.addRows([CABECERAS, fila]);
    let b = await w.xlsx.writeBuffer();
    const p = await importarPacking(
      new File([new Uint8Array(b)], "carga.xlsx"),
    );
    expect(p.items).toHaveLength(1);
    s.getCell("D2").value = { formula: "1+1", result: 2 };
    b = await w.xlsx.writeBuffer();
    await expect(
      importarPacking(new File([new Uint8Array(b)], "carga.xlsx")),
    ).rejects.toThrow("fórmulas");
  });
});
describe("Exportación", () => {
  const p = () =>
    calcularHomogeneo({
      material: {
        id: "a",
        nombre: '<script>alert("x")</script>',
        largo: 600,
        ancho: 400,
        alto: 400,
        peso: 15,
        orientaciones: ["LAH"],
        apilable: false,
      },
      equipo: equipoPorCodigo("40HC"),
      cantidad: 2,
      modoCarga: "suelta",
    });
  it("bloquea planes inválidos antes de exportar", () => {
    const plan = p();
    plan.colocaciones[0].l = 0;
    expect(() => planParaExportar(plan)).toThrow();
  });
  it("recalcula peso y escapa contenido del informe", () => {
    const plan = p();
    plan.kpis.pesoRealKg = 0;
    expect(planParaExportar(plan).kpis.pesoRealKg).toBe(30);
    const html = htmlInforme(plan);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });
});
describe("Rack", () => {
  const p = {
    frente: 2438,
    fondo: 1200,
    niveles: 4,
    bahias: 2,
    alturaNivel: 2200,
    peralte: 125,
    holguraLateral: 100,
    holguraVertical: 150,
    tarimaLargo: 1200,
    tarimaAncho: 800,
    alturaArmada: 1800,
    cargaNivel: 2000,
  };
  it("calcula posiciones, m³ y kg sin inventar carga faltante", () => {
    expect(capacidadRack(p).posiciones).toBe(16);
    expect(capacidadRack(p).m3).toBeCloseTo(27.648);
    expect(capacidadRack(p).kg).toBe(16000);
    expect(capacidadRack({ ...p, cargaNivel: null }).kg).toBeNull();
  });
  it("altura o fondo insuficientes producen cero posiciones", () => {
    expect(capacidadRack({ ...p, alturaNivel: 1900 }).posiciones).toBe(0);
    expect(capacidadRack({ ...p, fondo: 1000 }).posiciones).toBe(0);
  });
});
