/**
 * Prueba migraciones + semilla + RLS en PGlite (Postgres en WASM), sin Docker.
 * Simula lo mínimo de Supabase: esquema auth, auth.uid(), storage y roles.
 * Uso: bun scripts/probar-sql.ts
 */
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";

const db = new PGlite({ extensions: { pgcrypto } });
const raiz = new URL("../supabase/", import.meta.url);

await db.exec(`
  create role authenticated; create role anon;
  create schema auth; create schema storage; create schema extensions;
  create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text, encrypted_password text,
    email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
    confirmation_token text, recovery_token text, email_change text, email_change_token_new text);
  create table auth.identities (id uuid, user_id uuid, provider_id text, identity_data jsonb, provider text, created_at timestamptz, updated_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('prueba.uid', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
`);

for (const f of readdirSync(new URL("migrations/", raiz)).sort()) {
  await db.exec(readFileSync(new URL(`migrations/${f}`, raiz), "utf8"));
  console.log("✓ migración", f);
}
await db.exec(readFileSync(new URL("seed.sql", raiz), "utf8"));
await db.exec(readFileSync(new URL("./fixtures.sql", import.meta.url), "utf8"));
console.log("✓ seed.sql y fixtures aisladas");
await db.exec(`grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated;
  grant execute on all functions in schema public, auth to authenticated;`);

const uid = (n: number) => `50000000-0000-4000-8000-00000000000${n}`;
async function como<T>(n: number, sql: string): Promise<T[]> {
  await db.exec(
    `reset role; select set_config('prueba.uid', '${uid(n)}', false); set role authenticated;`,
  );
  try {
    return (await db.query<T>(sql)).rows;
  } finally {
    await db.exec("reset role; select set_config('prueba.uid','',false);");
  }
}
const contar = async (n: number, t: string) =>
  (await como<{ c: number }>(n, `select count(*)::int c from ${t}`))[0].c;
let fallas = 0;
const esperar = (nombre: string, ok: boolean) => {
  console.log(ok ? "✓" : "✗", nombre);
  if (!ok) fallas++;
};

// Otra empresa con un material propio.
await db.exec(`insert into empresas (id, nombre) values ('00000000-0000-4000-8000-000000000099', 'Otra SA');
  insert into materiales (empresa_id, nombre, largo_mm, ancho_mm, alto_mm, peso_kg) values ('00000000-0000-4000-8000-000000000099', 'Ajeno', 100, 100, 100, 1);`);

esperar(
  "planeador ve 14 equipos globales",
  (await contar(3, "equipos")) === 14,
);
esperar("planeador ve 8 tarimas globales", (await contar(3, "tarimas")) === 8);
esperar(
  "planeador ve solo los 12 materiales de su empresa",
  (await contar(3, "materiales")) === 12,
);
esperar(
  "planeador ve los 3 proyectos demo",
  (await contar(3, "proyectos")) === 3,
);

const intentar = async (n: number, sql: string) => {
  try {
    await como(n, sql);
    return true;
  } catch {
    return false;
  }
};
esperar(
  "planeador NO edita el catálogo global",
  (
    await como<{ id: string }>(
      3,
      "update equipos set nombre = 'x' where codigo = '20DV' returning id",
    )
  ).length === 0,
);
esperar(
  "superadmin SÍ edita el catálogo global",
  (
    await como<{ id: string }>(
      1,
      "update equipos set nombre = 'Contenedor 20'' DV' where codigo = '20DV' returning id",
    )
  ).length === 1,
);
esperar(
  "planeador crea materiales en su empresa",
  await intentar(
    3,
    "insert into materiales (empresa_id, nombre, largo_mm, ancho_mm, alto_mm, peso_kg) values (mi_empresa(), 'Nuevo', 10, 10, 10, 1)",
  ),
);
esperar(
  "planeador NO crea materiales en otra empresa",
  !(await intentar(
    3,
    "insert into materiales (empresa_id, nombre, largo_mm, ancho_mm, alto_mm, peso_kg) values ('00000000-0000-4000-8000-000000000099', 'X', 10, 10, 10, 1)",
  )),
);
esperar(
  "visor NO crea materiales",
  !(await intentar(
    4,
    "insert into materiales (empresa_id, nombre, largo_mm, ancho_mm, alto_mm, peso_kg) values (mi_empresa(), 'X', 10, 10, 10, 1)",
  )),
);
esperar(
  "planeador NO crea equipos de empresa (solo admin)",
  !(await intentar(
    3,
    "insert into equipos (empresa_id, categoria, codigo, nombre, largo_int_mm, ancho_int_mm, alto_int_mm, altura_util_mm, puerta_ancho_mm, puerta_alto_mm) values (mi_empresa(), 'personalizado', 'X', 'X', 1, 1, 1, 1, 1, 1)",
  )),
);
esperar(
  "admin SÍ crea equipos de empresa",
  await intentar(
    2,
    "insert into equipos (empresa_id, categoria, codigo, nombre, largo_int_mm, ancho_int_mm, alto_int_mm, altura_util_mm, puerta_ancho_mm, puerta_alto_mm) values (mi_empresa(), 'personalizado', 'X', 'X', 1, 1, 1, 1, 1, 1)",
  ),
);
esperar(
  "medidas fuera de rango se rechazan",
  !(await intentar(
    3,
    "insert into materiales (empresa_id, nombre, largo_mm, ancho_mm, alto_mm, peso_kg) values (mi_empresa(), 'X', 0, 10, 10, 1)",
  )),
);
esperar(
  "planeador no se sube de rol",
  (
    await como<{ id: string }>(
      3,
      "update perfiles set rol = 'admin' where id = auth.uid() returning id",
    ).catch(() => [])
  ).length === 0,
);
const link = await como<{ token: string }>(
  3,
  "insert into links_compartidos (calculo_id) select id from calculos limit 1 returning token",
);
esperar("token de link de 32 caracteres", link[0]?.token.length === 32);
const aud = (
  await db.query<{ c: number }>("select count(*)::int c from auditoria")
).rows[0].c;
esperar("auditoría registra cambios de catálogo", aud >= 3);

// Regresiones de autorización: cada intento revierte sus cambios.
async function ataque(n: number, sql: string): Promise<boolean> {
  await db.exec("begin");
  try {
    return await intentar(n, sql);
  } finally {
    await db.exec("rollback");
  }
}
esperar(
  "admin NO se asciende a superadmin",
  !(await ataque(
    2,
    "update perfiles set rol = 'superadmin' where id = auth.uid()",
  )),
);
esperar(
  "admin NO mueve su perfil a otra empresa",
  !(await ataque(
    2,
    "update perfiles set empresa_id = '00000000-0000-4000-8000-000000000099' where id = auth.uid()",
  )),
);
esperar(
  "admin NO promueve otro usuario a superadmin",
  !(await ataque(
    2,
    "update perfiles set rol = 'superadmin' where id = '50000000-0000-4000-8000-000000000003'",
  )),
);
esperar(
  "planeador NO crea un proyecto aprobado",
  !(await ataque(
    3,
    "insert into proyectos (empresa_id,nombre,estado) values (mi_empresa(),'Intento','aprobado')",
  )),
);
const perfilPropio = await como<{ nombre: string }>(
  3,
  "update perfiles set nombre='Planeador de prueba' where id=auth.uid() returning nombre",
);
esperar(
  "planeador conserva edición de nombre propio",
  perfilPropio[0]?.nombre === "Planeador de prueba",
);
esperar(
  "planeador NO aprueba un proyecto",
  !(await ataque(
    3,
    "update proyectos set estado = 'aprobado' where id = 'b0000000-0000-4000-8000-000000000001'",
  )),
);
// SELECT bajo RLS oculta el material ajeno: se toma su id desde el dueño de la fixture.
const ajeno = (
  await db.query<{ id: string }>(
    "select id from materiales where nombre = 'Ajeno'",
  )
).rows[0].id;
esperar(
  "FK conocida de material ajeno se rechaza",
  !(await ataque(
    3,
    `insert into proyecto_items (proyecto_id, material_id, cantidad) values ('b0000000-0000-4000-8000-000000000001', '${ajeno}', 1)`,
  )),
);
await db.exec(
  "insert into equipos (id,empresa_id,categoria,codigo,nombre,largo_int_mm,ancho_int_mm,alto_int_mm,altura_util_mm,puerta_ancho_mm,puerta_alto_mm) values ('e0000000-0000-4000-8000-000000000099','00000000-0000-4000-8000-000000000099','personalizado','AJENO','Ajeno',1000,1000,1000,1000,1000,1000)",
);
esperar(
  "cálculo NO usa equipo de otra empresa",
  !(await ataque(
    3,
    "insert into calculos (proyecto_id,equipos_permitidos) values ('b0000000-0000-4000-8000-000000000001',array['e0000000-0000-4000-8000-000000000099']::uuid[])",
  )),
);
await como(
  2,
  "update proyectos set estado = 'aprobado' where id = 'b0000000-0000-4000-8000-000000000001'",
);
esperar(
  "planeador NO modifica items de aprobado",
  !(await ataque(
    3,
    "update proyecto_items set cantidad=2, llenar_al_maximo=false where proyecto_id='b0000000-0000-4000-8000-000000000001'",
  )),
);
esperar(
  "admin puede mantener items de aprobado",
  await ataque(
    2,
    "update proyecto_items set cantidad=2, llenar_al_maximo=false where proyecto_id='b0000000-0000-4000-8000-000000000001'",
  ),
);
const calculoId = (
  await db.query<{ id: string }>("select id from calculos limit 1")
).rows[0].id;
await db.query("update calculos set plan_json=$1::jsonb where id=$2", [
  JSON.stringify({
    versionMotor: "test",
    semilla: 1,
    empresaId: "secreto",
    materiales: [
      { id: "m", nombre: "Caja", empresaId: "privado", email: "privado" },
    ],
    equipos: [{ id: "e", costoReferencia: 123, empresaId: "privado" }],
    tarimas: [],
    colocaciones: [],
    tarimasArmadas: [],
    kpis: {},
    avisos: [],
    parametros: {},
    noCargados: [],
  }),
  calculoId,
]);
await db.exec("grant usage on schema public to anon");
const publicLink = (
  await como<{ token: string }>(
    3,
    `insert into links_compartidos(calculo_id) values ('${calculoId}') returning token`,
  )
)[0].token;
async function leerAnon(token: string) {
  await db.exec("set role anon");
  try {
    return (
      await db.query<{ p: unknown }>("select obtener_plan_compartido($1) p", [
        token,
      ])
    ).rows[0].p;
  } finally {
    await db.exec("reset role");
  }
}
const publicPlan = JSON.stringify(await leerAnon(publicLink));
esperar(
  "RPC público omite empresa, email y costos",
  !publicPlan.includes("empresaId") &&
    !publicPlan.includes("email") &&
    !publicPlan.includes("costoReferencia"),
);
await db.exec(
  `update links_compartidos set activo=false where token='${publicLink}'`,
);
esperar(
  "enlace revocado no devuelve plan",
  (await leerAnon(publicLink)) === null,
);
await db.exec(
  `update links_compartidos set activo=true,expira_at=now()-interval '1 second' where token='${publicLink}'`,
);
esperar(
  "enlace vencido no devuelve plan",
  (await leerAnon(publicLink)) === null,
);
esperar(
  "token desconocido no devuelve plan",
  (await leerAnon("a".repeat(32))) === null,
);
const raizVersion = (
  await como<{ id: string }>(
    3,
    "select id from calculos where proyecto_id='b0000000-0000-4000-8000-000000000002' limit 1",
  )
)[0].id;
const versionNueva = await como<{ id: string }>(
  3,
  `select guardar_version('${raizVersion}','Versión prueba','{"versionMotor":"prueba","kpis":{}}'::jsonb,'{}'::jsonb) id`,
);
esperar(
  "restaurar crea versión sin sobrescribir original",
  versionNueva[0]?.id !== raizVersion,
);
esperar(
  "snapshot no admite UPDATE de plan",
  !(await ataque(
    3,
    `update calculos set plan_json='{}' where id='${versionNueva[0].id}'`,
  )),
);
esperar(
  "planeador guarda plantilla de su empresa",
  await ataque(
    3,
    "insert into plantillas_carga(empresa_id,nombre,entrada_json) values(mi_empresa(),'Carga de prueba','{}')",
  ),
);
esperar(
  "plantilla ajena se rechaza",
  !(await ataque(
    3,
    "insert into plantillas_carga(empresa_id,nombre,entrada_json) values('00000000-0000-4000-8000-000000000099','Ajena','{}')",
  )),
);
// Identidades estables: un perfil huérfano de prueba no autoriza a reasignar un admin.
await db.exec(`insert into auth.users(id,email) values('${uid(8)}','identidad@example.invalid');
 delete from perfiles where id='${uid(8)}';
 insert into proyectos(id,empresa_id,nombre) values('d0000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Identidad de prueba');
 insert into proyectos(id,empresa_id,nombre) values('d0000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Snapshot de prueba');
 insert into calculos(id,proyecto_id) values('d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000002');`);
esperar(
  "admin NO reasigna su perfil a otra identidad Auth",
  !(await ataque(2, `update perfiles set id='${uid(8)}' where id=auth.uid()`)),
);
esperar(
  "planeador NO cambia el ID de un proyecto",
  !(await ataque(
    3,
    "update proyectos set id='d0000000-0000-4000-8000-000000000009' where id='d0000000-0000-4000-8000-000000000001'",
  )),
);
esperar(
  "snapshot conserva su ID",
  !(await ataque(
    3,
    "update calculos set id='d0000000-0000-4000-8000-000000000009' where id='d0000000-0000-4000-8000-000000000003'",
  )),
);
esperar(
  "snapshot NO se mueve a otro proyecto propio",
  !(await ataque(
    3,
    "update calculos set proyecto_id='d0000000-0000-4000-8000-000000000001' where id='d0000000-0000-4000-8000-000000000003'",
  )),
);
console.log(fallas ? `\n${fallas} prueba(s) fallaron` : "\nTodo bien");
process.exit(fallas ? 1 : 0);
