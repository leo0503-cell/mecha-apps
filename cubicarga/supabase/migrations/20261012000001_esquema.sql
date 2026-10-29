-- CubiCarga — esquema base (sección 6). Unidades: mm enteros y kg.
create extension if not exists pgcrypto;

-- 6.1 Cuentas -----------------------------------------------------------------
create type plan_suscripcion as enum ('gratis', 'pro', 'empresa');
create type sistema_unidades as enum ('metrico', 'imperial');
create type rol_usuario as enum ('visor', 'planeador', 'admin', 'superadmin');

create table empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rfc text,
  logo_url text,
  plan plan_suscripcion not null default 'gratis',
  moneda_default text not null default 'MXN' check (moneda_default in ('MXN', 'USD')),
  tipo_cambio_usd numeric(10, 4),
  unidades_default sistema_unidades not null default 'metrico',
  created_at timestamptz not null default now()
);

create table perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid references empresas (id) on delete set null,
  nombre text not null default '',
  rol rol_usuario not null default 'planeador',
  unidades_preferidas sistema_unidades not null default 'metrico',
  idioma text not null default 'es-MX' check (idioma in ('es-MX', 'en-US')),
  created_at timestamptz not null default now()
);

-- 6.2 Catálogos -----------------------------------------------------------------
create type tipo_material as enum ('caja', 'tablero', 'costal', 'tambo', 'cubeta', 'ibc', 'rollo', 'pieza', 'otro');
create type preset_orientacion as enum ('libre', 'este_lado_arriba', 'plano');

create table materiales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas (id) on delete cascade, -- null = demo global
  sku text,
  nombre text not null,
  tipo tipo_material not null default 'caja',
  largo_mm integer not null check (largo_mm between 1 and 20000),
  ancho_mm integer not null check (ancho_mm between 1 and 20000),
  alto_mm integer not null check (alto_mm between 1 and 20000),
  peso_kg numeric(12, 3) not null check (peso_kg between 0.01 and 40000),
  densidad_kg_m3 numeric(10, 3),
  orientaciones_permitidas jsonb not null default '{"LAH":true,"LHA":true,"ALH":true,"AHL":true,"HLA":true,"HAL":true}',
  preset_orientacion preset_orientacion not null default 'libre',
  apilable boolean not null default true,
  max_peso_encima_kg numeric(12, 3),
  max_capas integer check (max_capas is null or max_capas >= 1),
  fragil boolean not null default false,
  ect_lb_in numeric(8, 2),
  calibre_in numeric(6, 3),
  unidades_por_bulto integer not null default 1,
  color_hex text,
  hs_code text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, sku)
);

create table tarimas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas (id) on delete cascade, -- null = global
  nombre text not null,
  codigo_iso text,
  largo_mm integer not null check (largo_mm between 1 and 20000),
  ancho_mm integer not null check (ancho_mm between 1 and 20000),
  alto_mm integer not null check (alto_mm between 1 and 2000),
  tara_kg numeric(10, 3) not null,
  carga_max_kg numeric(10, 3) not null,
  altura_max_armada_mm integer not null default 1800,
  voladizo_max_mm integer not null default 0,
  material text not null default 'madera' check (material in ('madera', 'plastico', 'metal')),
  region text,
  activo boolean not null default true,
  nota_validacion text,
  created_at timestamptz not null default now()
);

create type categoria_equipo as enum ('contenedor', 'reefer', 'caja_seca', 'camion', 'uld', 'personalizado');

create table equipos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references empresas (id) on delete cascade, -- null = global
  categoria categoria_equipo not null,
  codigo text not null,
  nombre text not null,
  largo_int_mm integer not null,
  ancho_int_mm integer not null,
  alto_int_mm integer not null,
  altura_util_mm integer not null,
  puerta_ancho_mm integer not null,
  puerta_alto_mm integer not null,
  carga_util_kg numeric(12, 3), -- null = sin dato
  tara_kg numeric(12, 3),
  contorno jsonb,
  tiene_techo boolean not null default true,
  tiene_paredes boolean not null default true,
  costo_referencia numeric(14, 2),
  moneda text default 'MXN' check (moneda in ('MXN', 'USD')),
  nota_validacion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  check (altura_util_mm <= alto_int_mm)
);

create type modo_transportista as enum ('aereo', 'lcl', 'fcl', 'ltl', 'ftl', 'paqueteria');

create table transportistas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  nombre text not null,
  modo modo_transportista not null,
  divisor_volumetrico numeric(10, 2),
  factor_kg_m3 numeric(10, 2),
  redondeo numeric(6, 3),
  minimo_cobrable numeric(10, 3),
  tarifa_por_kg numeric(12, 4),
  tarifa_por_m3 numeric(12, 4),
  tarifa_por_equipo jsonb,
  moneda text not null default 'MXN' check (moneda in ('MXN', 'USD')),
  created_at timestamptz not null default now()
);

-- 6.3 Almacén -------------------------------------------------------------------
create table almacenes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  nombre text not null,
  largo_mm integer not null,
  ancho_mm integer not null,
  altura_libre_mm integer not null,
  holgura_rociadores_mm integer not null default 457,
  created_at timestamptz not null default now()
);

create type tipo_rack as enum ('selectivo', 'doble_fondo', 'drive_in', 'cantilever');

create table racks (
  id uuid primary key default gen_random_uuid(),
  almacen_id uuid not null references almacenes (id) on delete cascade,
  tipo tipo_rack not null default 'selectivo',
  frente_viga_mm integer not null default 2438,
  fondo_mm integer not null default 1067,
  niveles integer not null default 4,
  alturas_niveles jsonb,
  carga_max_nivel_kg numeric(12, 3),
  peralte_viga_mm integer not null default 125,
  holgura_lateral_mm integer not null default 100,
  holgura_vertical_mm integer not null default 150,
  num_bahias integer not null default 1,
  pasillo_mm integer not null default 3500,
  pos_x_mm integer not null default 0,
  pos_y_mm integer not null default 0,
  rotacion integer not null default 0
);

-- 6.4 Proyectos y cálculos ------------------------------------------------------
create type operacion as enum ('importacion', 'exportacion', 'nacional');
create type modo_transporte as enum ('maritimo', 'terrestre', 'aereo', 'almacen');
create type estado_proyecto as enum ('borrador', 'calculado', 'aprobado');

create table proyectos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas (id) on delete cascade,
  creado_por uuid references auth.users (id) on delete set null,
  nombre text not null,
  operacion operacion not null default 'nacional',
  modo modo_transporte not null default 'terrestre',
  origen text,
  destino text,
  incoterm text,
  estado estado_proyecto not null default 'borrador',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table proyecto_items (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos (id) on delete cascade,
  material_id uuid not null references materiales (id),
  cantidad integer check (cantidad is null or cantidad > 0),
  llenar_al_maximo boolean not null default false,
  parada_descarga integer not null default 1,
  prioridad integer not null default 0,
  override_orientaciones jsonb,
  check (cantidad is not null or llenar_al_maximo)
);

create type modo_carga as enum ('suelta', 'paletizada');

create table calculos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references proyectos (id) on delete cascade,
  nombre_escenario text not null default 'Escenario 1',
  modo_carga modo_carga not null default 'suelta',
  tarima_id uuid references tarimas (id),
  equipos_permitidos uuid[] not null default '{}',
  parametros jsonb not null default '{"soporte_min_pct":80,"tiempo_max_s":3,"holgura_entre_bultos_mm":0,"permitir_doble_estiba":false,"semilla":1}',
  resumen jsonb,
  costo_estimado numeric(14, 2),
  moneda text default 'MXN',
  plan_url text,
  version_motor text,
  duracion_ms integer,
  created_at timestamptz not null default now()
);

create table links_compartidos (
  id uuid primary key default gen_random_uuid(),
  calculo_id uuid not null references calculos (id) on delete cascade,
  token text not null unique check (length(token) = 32),
  expira_at timestamptz not null default now() + interval '30 days',
  vistas integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table auditoria (
  id bigint generated always as identity primary key,
  empresa_id uuid references empresas (id) on delete cascade,
  usuario_id uuid references auth.users (id) on delete set null,
  accion text not null,
  entidad text not null,
  entidad_id uuid,
  datos jsonb,
  created_at timestamptz not null default now()
);

create index on materiales (empresa_id);
create index on tarimas (empresa_id);
create index on equipos (empresa_id);
create index on proyectos (empresa_id, updated_at desc);
create index on calculos (proyecto_id, created_at desc);
create index on auditoria (empresa_id, created_at desc);

-- Token de 32 caracteres URL-safe para links compartidos.
create or replace function token_link() returns text language sql volatile as $$
  select substr(translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_'), 1, 32)
$$;
alter table links_compartidos alter column token set default token_link();

-- updated_at automático
create or replace function tocar_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_materiales_upd before update on materiales for each row execute function tocar_updated_at();
create trigger t_proyectos_upd before update on proyectos for each row execute function tocar_updated_at();

-- Perfil automático al registrarse
create or replace function crear_perfil() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into perfiles (id, nombre) values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger t_crear_perfil after insert on auth.users for each row execute function crear_perfil();
