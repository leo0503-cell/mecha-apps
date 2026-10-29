import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  resultado: { data: null as { id: string } | null, error: null as unknown },
}));
vi.mock("@/lib/supabase/servidor", () => ({
  supabaseServidor: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => mock.resultado }),
      }),
    }),
  }),
}));
import { GET } from "@/app/api/calculos/[id]/route";
import { POST } from "@/app/api/calculos/route";
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  mock.resultado = { data: null, error: null };
});
it("API no procesa una mutación de origen ajeno", async () =>
  expect(
    (
      await POST(
        new Request("http://localhost/api/calculos", {
          method: "POST",
          headers: { origin: "http://otra.invalid" },
          body: "{}",
        }),
      )
    ).status,
  ).toBe(403));
it("API devuelve 404 cuando RLS oculta el cálculo de B", async () => {
  const r = await GET(new Request(`http://localhost/api/calculos/${id}`), {
    params: Promise.resolve({ id }),
  });
  expect(r.status).toBe(404);
  expect(await r.json()).toEqual({ error: "Cálculo no encontrado" });
});
it("API no cachea un cálculo permitido", async () => {
  mock.resultado.data = { id };
  const r = await GET(new Request(`http://localhost/api/calculos/${id}`), {
    params: Promise.resolve({ id }),
  });
  expect(r.status).toBe(200);
  expect(r.headers.get("cache-control")).toBe("private, no-store");
});
it("API rechaza IDs manipulados", async () =>
  expect(
    (
      await GET(new Request("http://localhost/api/calculos/x"), {
        params: Promise.resolve({ id: "x" }),
      })
    ).status,
  ).toBe(404));
