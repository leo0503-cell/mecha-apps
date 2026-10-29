import { afterEach, describe, expect, it, vi } from "vitest";
import { celdaCsv } from "../csv";
import { leerCsv } from "../planes/packing";
import { CuerpoExcedido, leerJsonLimitado, esMismoOrigen } from "../http";
import { seleccionCatalogo } from "../seleccion-catalogo";
import { crearSincronizador } from "../sincronizador";
afterEach(() => vi.useRealTimers());
describe("Fronteras de datos", () => {
  it.each(["http://otra.invalid", "null"])(
    "rechaza mutación web con Origin %s",
    (origen) =>
      expect(
        esMismoOrigen(
          new Request("http://localhost/api", { headers: { origin: origen } }),
        ),
      ).toBe(false),
  );
  it("permite el origen de la app y clientes sin contexto web", () => {
    expect(
      esMismoOrigen(
        new Request("http://localhost/api", {
          headers: { origin: "http://localhost" },
        }),
      ),
    ).toBe(true);
    expect(esMismoOrigen(new Request("http://localhost/api"))).toBe(true);
  });
  it("rechaza un request same-site que omite Origin", () =>
    expect(
      esMismoOrigen(
        new Request("http://localhost/api", {
          headers: { "sec-fetch-site": "same-site" },
        }),
      ),
    ).toBe(false));
  it.each([
    '=HYPERLINK("https://ejemplo.invalid","abrir")',
    "+SUM(A1:A2)",
    "\t@SUM(A1:A2)",
    "-nombre",
  ])("CSV neutraliza texto activo %s", (v) => {
    expect(leerCsv(celdaCsv(v))).toEqual([["'" + v]]);
  });
  it("CSV conserva números negativos y comillas/saltos", () => {
    expect(celdaCsv(-15)).toBe("-15");
    expect(leerCsv(celdaCsv('Caja, "A"\r\nB'))).toEqual([['Caja, "A"\r\nB']]);
  });
  it("selecciona UUID del catálogo remoto sin exigir el ID de fixtures", () => {
    expect(
      seleccionCatalogo(
        [
          { id: "00000000-0000-4000-8000-000000000010", codigo: "20DV" },
          { id: "00000000-0000-4000-8000-000000000040", codigo: "40HC" },
        ],
        "eq-40hc",
        "40HC",
      ),
    ).toBe("00000000-0000-4000-8000-000000000040");
  });
  it("conserva la selección existente del usuario", () =>
    expect(
      seleccionCatalogo(
        [
          { id: "elegido", codigo: "CS53" },
          { id: "otro", codigo: "40HC" },
        ],
        "elegido",
        "40HC",
      ),
    ).toBe("elegido"));
  it("lee JSON válido", async () =>
    expect(
      await leerJsonLimitado(
        new Request("http://localhost/api", {
          method: "POST",
          body: '{"a":1}',
        }),
        20,
      ),
    ).toEqual({ a: 1 }));
  it("rechaza Content-Length excesivo", async () =>
    expect(
      leerJsonLimitado(
        new Request("http://localhost/api", {
          method: "POST",
          body: "{}",
          headers: { "content-length": "100" },
        }),
        20,
      ),
    ).rejects.toBeInstanceOf(CuerpoExcedido));
  it("limita y cancela un stream sin Content-Length", async () => {
    let cancelado = false;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(50));
        c.enqueue(new Uint8Array(50));
      },
      cancel() {
        cancelado = true;
      },
    });
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      body: stream,
      duplex: "half",
    };
    await expect(
      leerJsonLimitado(new Request("http://localhost/api", init), 20),
    ).rejects.toBeInstanceOf(CuerpoExcedido);
    expect(cancelado).toBe(true);
  });
});
describe("Sincronización de cuenta", () => {
  it("una respuesta vieja de A no reemplaza B y el callback no consulta Auth dentro del lock", async () => {
    vi.useFakeTimers();
    let resolver!: (s: string) => void;
    const vieja = new Promise<string>((r) => {
      resolver = r;
    });
    const cargar = vi
      .fn()
      .mockReturnValueOnce(vieja)
      .mockResolvedValueOnce("B");
    const publicar = vi.fn(),
      sync = crearSincronizador(cargar, publicar, vi.fn());
    const primera = sync.iniciar();
    sync.cambio();
    expect(cargar).toHaveBeenCalledTimes(1);
    await vi.runAllTimersAsync();
    resolver("A");
    await primera;
    expect(publicar.mock.calls).toEqual([["B"]]);
    sync.detener();
  });
  it("desmontar descarta respuestas tardías", async () => {
    let resolver!: (s: string) => void;
    const publicar = vi.fn(),
      sync = crearSincronizador(
        () =>
          new Promise<string>((r) => {
            resolver = r;
          }),
        publicar,
        vi.fn(),
      );
    const pendiente = sync.iniciar();
    sync.detener();
    resolver("A");
    await pendiente;
    expect(publicar).not.toHaveBeenCalled();
  });
  it("una falla antigua tampoco borra la cuenta nueva", async () => {
    vi.useFakeTimers();
    let rechazar!: (e: Error) => void;
    const vieja = new Promise<string>((_, r) => {
      rechazar = r;
    });
    const fallar = vi.fn(),
      sync = crearSincronizador(
        vi.fn().mockReturnValueOnce(vieja).mockResolvedValueOnce("B"),
        vi.fn(),
        fallar,
      );
    const primera = sync.iniciar();
    sync.cambio();
    await vi.runAllTimersAsync();
    rechazar(new Error("vieja"));
    await primera;
    expect(fallar).not.toHaveBeenCalled();
    sync.detener();
  });
});
