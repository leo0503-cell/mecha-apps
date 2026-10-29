-- Generado por scripts/generar-seed.ts. No editar a mano.
-- Catálogo global sin usuarios ni credenciales.

insert into equipos (id, empresa_id, categoria, codigo, nombre, largo_int_mm, ancho_int_mm, alto_int_mm, altura_util_mm, puerta_ancho_mm, puerta_alto_mm, carga_util_kg, tara_kg, tiene_techo, tiene_paredes, nota_validacion) values
  ('e0000000-0000-4000-8000-000000000001', null, 'contenedor', '20DV', 'Contenedor 20'' DV', 5898, 2352, 2393, 2393, 2340, 2280, 28000, null, true, true, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('e0000000-0000-4000-8000-000000000002', null, 'contenedor', '40DV', 'Contenedor 40'' DV', 12032, 2352, 2393, 2393, 2340, 2280, 26700, null, true, true, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('e0000000-0000-4000-8000-000000000003', null, 'contenedor', '40HC', 'Contenedor 40'' HC', 12032, 2352, 2698, 2698, 2340, 2585, 26500, null, true, true, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('e0000000-0000-4000-8000-000000000004', null, 'contenedor', '45HC', 'Contenedor 45'' HC', 13544, 2352, 2698, 2698, 2340, 2585, 25680, null, true, true, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('e0000000-0000-4000-8000-000000000005', null, 'reefer', '20RF', 'Reefer 20''', 5450, 2290, 2276, 2176, 2290, 2276, 27400, null, true, true, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('e0000000-0000-4000-8000-000000000006', null, 'reefer', '40HCRF', 'Reefer 40'' HC', 11590, 2290, 2547, 2447, 2290, 2502, 29000, null, true, true, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('e0000000-0000-4000-8000-000000000007', null, 'caja_seca', 'CS53', 'Caja seca 53''', 16002, 2515, 2743, 2743, 2388, 2667, 20000, null, true, true, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('e0000000-0000-4000-8000-000000000008', null, 'caja_seca', 'CS48', 'Caja seca 48''', 14453, 2515, 2743, 2743, 2388, 2667, 20000, null, true, true, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('e0000000-0000-4000-8000-000000000009', null, 'camion', 'TORTON', 'Torton C3 caja seca (típico)', 7800, 2400, 2400, 2400, 2400, 2400, 14000, null, true, true, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('e0000000-0000-4000-8000-000000000010', null, 'camion', 'RABON', 'Rabón C2 caja seca (típico)', 6500, 2400, 2300, 2300, 2400, 2300, 8000, null, true, true, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('e0000000-0000-4000-8000-000000000011', null, 'camion', 'CAM35', 'Camioneta 3.5 t caja seca (típico)', 4200, 2100, 2000, 2000, 2100, 2000, 3500, null, true, true, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('e0000000-0000-4000-8000-000000000012', null, 'uld', 'PMC', 'PMC / P6P (cubierta principal)', 3175, 2438, 2440, 2440, 2438, 2440, null, 95, false, false, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('e0000000-0000-4000-8000-000000000013', null, 'uld', 'PAG', 'PAG / P1P (cubierta principal)', 3175, 2235, 2440, 2440, 2235, 2440, null, 90, false, false, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('e0000000-0000-4000-8000-000000000014', null, 'uld', 'LD3', 'LD3 / AKE', 1562, 1534, 1626, 1626, 1534, 1626, null, null, true, true, 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.');

insert into tarimas (id, empresa_id, nombre, codigo_iso, largo_mm, ancho_mm, alto_mm, tara_kg, carga_max_kg, altura_max_armada_mm, voladizo_max_mm, material, nota_validacion) values
  ('70000000-0000-4000-8000-000000000001', null, 'GMA / americana', 'ISO 3', 1219, 1016, 150, 20, 1000, 1800, 0, 'madera', 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('70000000-0000-4000-8000-000000000002', null, 'Europea EUR1', 'ISO 1', 1200, 800, 144, 25, 1000, 1800, 0, 'madera', 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('70000000-0000-4000-8000-000000000003', null, 'Industrial ISO 2', 'ISO 2', 1200, 1000, 144, 30, 1000, 1800, 0, 'madera', 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('70000000-0000-4000-8000-000000000004', null, 'Asiática T11', 'T11', 1100, 1100, 144, 25, 1000, 1800, 0, 'madera', 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('70000000-0000-4000-8000-000000000005', null, 'ISO 4', 'ISO 4', 1067, 1067, 144, 25, 1000, 1800, 0, 'madera', 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('70000000-0000-4000-8000-000000000006', null, 'ISO 6', 'ISO 6', 1140, 1140, 144, 25, 1000, 1800, 0, 'madera', 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('70000000-0000-4000-8000-000000000007', null, 'Australiana', 'AUS', 1165, 1165, 150, 30, 1000, 1800, 0, 'madera', 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.'),
  ('70000000-0000-4000-8000-000000000008', null, 'Media europea', 'EUR6', 800, 600, 144, 12, 500, 1800, 0, 'madera', 'Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.');

