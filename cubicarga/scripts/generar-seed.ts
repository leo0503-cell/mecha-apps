/**
 * Genera supabase/seed.sql desde el catálogo del motor (fuente única).
 * Uso: bun scripts/generar-seed.ts
 */
import { writeFileSync } from "node:fs";
import {
  EQUIPOS_GLOBALES,
  MATERIALES_DEMO,
  NOTA_VALIDACION,
  TARIMAS_GLOBALES,
  TODAS_ORIENTACIONES,
} from "../src/motor";

const q = (v: unknown): string =>
  v == null
    ? "null"
    : typeof v === "number" || typeof v === "boolean"
      ? String(v)
      : `'${String(v).replace(/'/g, "''")}'`;

const uuid = (pref: string, n: number) =>
  `${pref}-0000-4000-8000-${String(n).padStart(12, "0")}`;
const EMPRESA = "00000000-0000-4000-8000-000000000001";
const id = new Map<string, string>();
EQUIPOS_GLOBALES.forEach((e, i) => id.set(e.id, uuid("e0000000", i + 1)));
TARIMAS_GLOBALES.forEach((t, i) => id.set(t.id, uuid("70000000", i + 1)));
MATERIALES_DEMO.forEach((m, i) => id.set(m.id, uuid("a0000000", i + 1)));

const L: string[] = [
  "-- Generado por scripts/generar-seed.ts. No editar a mano.",
  "-- Catálogo global sin usuarios ni credenciales.",
  "",
];

L.push(
  "insert into equipos (id, empresa_id, categoria, codigo, nombre, largo_int_mm, ancho_int_mm, alto_int_mm, altura_util_mm, puerta_ancho_mm, puerta_alto_mm, carga_util_kg, tara_kg, tiene_techo, tiene_paredes, nota_validacion) values",
);
L.push(
  EQUIPOS_GLOBALES.map(
    (e) =>
      `  (${q(id.get(e.id))}, null, ${q(e.categoria)}, ${q(e.codigo)}, ${q(e.nombre)}, ${e.largo}, ${e.ancho}, ${e.alto}, ${e.alturaUtil}, ${e.puertaAncho}, ${e.puertaAlto}, ${q(e.cargaUtil)}, ${q(e.tara)}, ${e.tieneTecho !== false}, ${e.tieneParedes !== false}, ${q(NOTA_VALIDACION)})`,
  ).join(",\n") + ";",
  "",
);

L.push(
  "insert into tarimas (id, empresa_id, nombre, codigo_iso, largo_mm, ancho_mm, alto_mm, tara_kg, carga_max_kg, altura_max_armada_mm, voladizo_max_mm, material, nota_validacion) values",
);
L.push(
  TARIMAS_GLOBALES.map(
    (t) =>
      `  (${q(id.get(t.id))}, null, ${q(t.nombre)}, ${q(t.codigo)}, ${t.largo}, ${t.ancho}, ${t.alto}, ${t.tara}, ${t.cargaMax}, ${t.alturaMaxArmada}, ${t.voladizoMax}, ${q(t.material)}, ${q(NOTA_VALIDACION)})`,
  ).join(",\n") + ";",
  "",
);

// La semilla pública contiene únicamente catálogos globales.
const catalogo = L.join("\n") + "\n";
L.length = 0;
L.push("-- Fixtures solo para PGlite. No aplicar en Supabase real.");
// Fixture aislada para PGlite: IDs/roles sintéticos, sin contraseña de acceso.
const usuarios: [string, string, string | null][] = [
  ["superadmin@example.invalid", "superadmin", null],
  ["admin@example.invalid", "admin", EMPRESA],
  ["planeador@example.invalid", "planeador", EMPRESA],
  ["visor@example.invalid", "visor", EMPRESA],
];
L.push(
  `insert into empresas (id,nombre,plan) values (${q(EMPRESA)}, 'Empresa de prueba', 'pro');`,
);
usuarios.forEach(([email, rol, emp], i) => {
  const uid = uuid("50000000", i + 1);
  L.push(`insert into auth.users (id,email) values (${q(uid)}, ${q(email)});`);
  L.push(
    `update perfiles set rol=${q(rol)}, empresa_id=${q(emp)} where id=${q(uid)};`,
  );
});

const presetDe = (o: string[]) =>
  o.length === 6
    ? "libre"
    : o.every((x) => ["LAH", "ALH"].includes(x))
      ? "este_lado_arriba"
      : "plano";
L.push(
  "insert into materiales (id, empresa_id, sku, nombre, tipo, largo_mm, ancho_mm, alto_mm, peso_kg, orientaciones_permitidas, preset_orientacion, apilable, fragil, color_hex) values",
);
L.push(
  MATERIALES_DEMO.map((m) => {
    const ors = Object.fromEntries(
      TODAS_ORIENTACIONES.map((o) => [o, m.orientaciones.includes(o)]),
    );
    const preset =
      m.tipo === "tablero" || m.tipo === "costal"
        ? "plano"
        : presetDe(m.orientaciones);
    return `  (${q(id.get(m.id))}, ${q(EMPRESA)}, ${q(m.sku)}, ${q(m.nombre)}, ${q(m.tipo)}, ${m.largo}, ${m.ancho}, ${m.alto}, ${m.peso}, ${q(JSON.stringify(ors))}, ${q(preset)}, ${m.apilable}, ${!!m.fragil}, ${q(m.color)})`;
  }).join(",\n") + ";",
  "",
);

// Proyectos demo (sección 13).
const P1 = uuid("b0000000", 1);
const P2 = uuid("b0000000", 2);
const P3 = uuid("b0000000", 3);
const planeador = q(uuid("50000000", 3));
L.push(
  "insert into proyectos (id, empresa_id, creado_por, nombre, operacion, modo, origen, destino) values",
  `  (${q(P1)}, ${q(EMPRESA)}, ${planeador}, 'Atados de MDF a Laredo, TX', 'exportacion', 'terrestre', 'Aguascalientes, Ags.', 'Laredo, TX'),`,
  `  (${q(P2)}, ${q(EMPRESA)}, ${planeador}, 'Importación Shanghái — 1,200 cajas mixtas', 'importacion', 'maritimo', 'Shanghái, CN', 'Manzanillo, Col.'),`,
  `  (${q(P3)}, ${q(EMPRESA)}, ${planeador}, 'Muestras por avión', 'exportacion', 'aereo', 'Ciudad de México', '<destino por definir>');`,
  "",
  "insert into proyecto_items (proyecto_id, material_id, cantidad, llenar_al_maximo, parada_descarga) values",
  `  (${q(P1)}, ${q(id.get("m-atado-mdf"))}, null, true, 1),`,
  // 1,200 cajas repartidas por partes iguales entre 5 SKUs (240 c/u).
  ...[
    "m-caja-chica",
    "m-caja-mediana",
    "m-caja-grande",
    "m-electronicos",
    "m-refacciones",
  ].map((m) => `  (${q(P2)}, ${q(id.get(m))}, 240, false, 1),`),
  `  (${q(P3)}, ${q(id.get("m-caja-chica"))}, 6, false, 1);`,
  "",
  "insert into calculos (proyecto_id, nombre_escenario, modo_carga, equipos_permitidos) values",
  `  (${q(P1)}, 'Caja seca 53''', 'suelta', array[${q(id.get("eq-cs53"))}]::uuid[]),`,
  `  (${q(P2)}, '1×40'' HC', 'suelta', array[${q(id.get("eq-40hc"))}]::uuid[]),`,
  `  (${q(P2)}, '2×20'' DV', 'suelta', array[${q(id.get("eq-20dv"))}]::uuid[]);`,
  "",
  `insert into almacenes (empresa_id, nombre, largo_mm, ancho_mm, altura_libre_mm) values (${q(EMPRESA)}, 'Nave demo', 40000, 25000, 9000);`,
  "-- Las 4 líneas de rack selectivo se siembran en la fase 7 (configurador de almacén).",
);

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), catalogo);
writeFileSync(new URL("./fixtures.sql", import.meta.url), L.join("\n") + "\n");
console.log("supabase/seed.sql generado");
