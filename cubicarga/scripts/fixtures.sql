-- Fixtures solo para PGlite. No aplicar en Supabase real.
insert into empresas (id,nombre,plan) values ('00000000-0000-4000-8000-000000000001', 'Empresa de prueba', 'pro');
insert into auth.users (id,email) values ('50000000-0000-4000-8000-000000000001', 'superadmin@example.invalid');
update perfiles set rol='superadmin', empresa_id=null where id='50000000-0000-4000-8000-000000000001';
insert into auth.users (id,email) values ('50000000-0000-4000-8000-000000000002', 'admin@example.invalid');
update perfiles set rol='admin', empresa_id='00000000-0000-4000-8000-000000000001' where id='50000000-0000-4000-8000-000000000002';
insert into auth.users (id,email) values ('50000000-0000-4000-8000-000000000003', 'planeador@example.invalid');
update perfiles set rol='planeador', empresa_id='00000000-0000-4000-8000-000000000001' where id='50000000-0000-4000-8000-000000000003';
insert into auth.users (id,email) values ('50000000-0000-4000-8000-000000000004', 'visor@example.invalid');
update perfiles set rol='visor', empresa_id='00000000-0000-4000-8000-000000000001' where id='50000000-0000-4000-8000-000000000004';
insert into materiales (id, empresa_id, sku, nombre, tipo, largo_mm, ancho_mm, alto_mm, peso_kg, orientaciones_permitidas, preset_orientacion, apilable, fragil, color_hex) values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'CJ-CH', 'Caja chica', 'caja', 400, 300, 250, 8, '{"LAH":true,"LHA":true,"ALH":true,"AHL":true,"HLA":true,"HAL":true}', 'libre', true, false, '#0072B2'),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'CJ-MD', 'Caja mediana', 'caja', 600, 400, 400, 15, '{"LAH":true,"LHA":true,"ALH":true,"AHL":true,"HLA":true,"HAL":true}', 'libre', true, false, '#E69F00'),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'CJ-GR', 'Caja grande', 'caja', 800, 600, 600, 25, '{"LAH":true,"LHA":true,"ALH":true,"AHL":true,"HLA":true,"HAL":true}', 'libre', true, false, '#009E73'),
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'MDF-15', 'Tablero MDF 15 mm', 'tablero', 2440, 1220, 15, 32.6, '{"LAH":true,"LHA":false,"ALH":true,"AHL":false,"HLA":false,"HAL":false}', 'plano', true, false, '#CC79A7'),
  ('a0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'MDF-18', 'Tablero MDF 18 mm', 'tablero', 2440, 1220, 18, 39, '{"LAH":true,"LHA":false,"ALH":true,"AHL":false,"HLA":false,"HAL":false}', 'plano', true, false, '#56B4E9'),
  ('a0000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'AT-MDF15', 'Atado 50 tableros MDF 15 mm', 'tablero', 2440, 1220, 850, 1630, '{"LAH":true,"LHA":false,"ALH":true,"AHL":false,"HLA":false,"HAL":false}', 'plano', false, false, '#D55E00'),
  ('a0000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', 'COS-25', 'Costal 25 kg', 'costal', 600, 400, 120, 25, '{"LAH":true,"LHA":false,"ALH":true,"AHL":false,"HLA":false,"HAL":false}', 'plano', true, false, '#F0E442'),
  ('a0000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', 'TAM-200', 'Tambo 200 L', 'tambo', 585, 585, 880, 200, '{"LAH":true,"LHA":false,"ALH":true,"AHL":false,"HLA":false,"HAL":false}', 'este_lado_arriba', true, false, '#7F7F7F'),
  ('a0000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 'CUB-19', 'Cubeta 19 L', 'cubeta', 300, 300, 370, 22, '{"LAH":true,"LHA":false,"ALH":true,"AHL":false,"HLA":false,"HAL":false}', 'este_lado_arriba', true, false, '#882255'),
  ('a0000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', 'IBC-1000', 'IBC 1,000 L', 'ibc', 1200, 1000, 1160, 1100, '{"LAH":true,"LHA":false,"ALH":true,"AHL":false,"HLA":false,"HAL":false}', 'este_lado_arriba', false, false, '#44AA99'),
  ('a0000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000001', 'CJ-ELEC', 'Caja de electrónicos', 'caja', 500, 400, 300, 6, '{"LAH":true,"LHA":false,"ALH":true,"AHL":false,"HLA":false,"HAL":false}', 'este_lado_arriba', true, true, '#332288'),
  ('a0000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000001', 'CJ-REF', 'Caja de refacciones', 'caja', 450, 350, 300, 18, '{"LAH":true,"LHA":true,"ALH":true,"AHL":true,"HLA":true,"HAL":true}', 'libre', true, false, '#999933');

insert into proyectos (id, empresa_id, creado_por, nombre, operacion, modo, origen, destino) values
  ('b0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'Atados de MDF a Laredo, TX', 'exportacion', 'terrestre', 'Aguascalientes, Ags.', 'Laredo, TX'),
  ('b0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'Importación Shanghái — 1,200 cajas mixtas', 'importacion', 'maritimo', 'Shanghái, CN', 'Manzanillo, Col.'),
  ('b0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'Muestras por avión', 'exportacion', 'aereo', 'Ciudad de México', '<destino por definir>');

insert into proyecto_items (proyecto_id, material_id, cantidad, llenar_al_maximo, parada_descarga) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', null, true, 1),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 240, false, 1),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 240, false, 1),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 240, false, 1),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000011', 240, false, 1),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000012', 240, false, 1),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 6, false, 1);

insert into calculos (proyecto_id, nombre_escenario, modo_carga, equipos_permitidos) values
  ('b0000000-0000-4000-8000-000000000001', 'Caja seca 53''', 'suelta', array['e0000000-0000-4000-8000-000000000007']::uuid[]),
  ('b0000000-0000-4000-8000-000000000002', '1×40'' HC', 'suelta', array['e0000000-0000-4000-8000-000000000003']::uuid[]),
  ('b0000000-0000-4000-8000-000000000002', '2×20'' DV', 'suelta', array['e0000000-0000-4000-8000-000000000001']::uuid[]);

insert into almacenes (empresa_id, nombre, largo_mm, ancho_mm, altura_libre_mm) values ('00000000-0000-4000-8000-000000000001', 'Nave demo', 40000, 25000, 9000);
-- Las 4 líneas de rack selectivo se siembran en la fase 7 (configurador de almacén).
