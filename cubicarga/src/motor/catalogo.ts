/**
 * Catálogo global de referencia (sección 5). Medidas INTERIORES en mm, carga
 * útil en kg. Fuente única: de aquí se genera supabase/seed.sql.
 */
import type { Equipo, Material, Tarima } from "./tipos";
import { NOTA_VALIDACION } from "./tipos";
import { orientacionesDePreset } from "./orientaciones";

type EquipoBase = Omit<
  Equipo,
  "alturaUtil" | "notaValidacion" | "tieneTecho" | "tieneParedes"
> &
  Partial<Pick<Equipo, "alturaUtil" | "tieneTecho" | "tieneParedes">>;

function eq(e: EquipoBase): Equipo {
  return {
    tieneTecho: true,
    tieneParedes: true,
    ...e,
    alturaUtil: e.alturaUtil ?? e.alto,
    notaValidacion: NOTA_VALIDACION,
  };
}

export const EQUIPOS_GLOBALES: Equipo[] = [
  // 5.1 Contenedores dry
  eq({
    id: "eq-20dv",
    codigo: "20DV",
    nombre: "Contenedor 20' DV",
    categoria: "contenedor",
    largo: 5898,
    ancho: 2352,
    alto: 2393,
    puertaAncho: 2340,
    puertaAlto: 2280,
    cargaUtil: 28000,
  }),
  eq({
    id: "eq-40dv",
    codigo: "40DV",
    nombre: "Contenedor 40' DV",
    categoria: "contenedor",
    largo: 12032,
    ancho: 2352,
    alto: 2393,
    puertaAncho: 2340,
    puertaAlto: 2280,
    cargaUtil: 26700,
  }),
  eq({
    id: "eq-40hc",
    codigo: "40HC",
    nombre: "Contenedor 40' HC",
    categoria: "contenedor",
    largo: 12032,
    ancho: 2352,
    alto: 2698,
    puertaAncho: 2340,
    puertaAlto: 2585,
    cargaUtil: 26500,
  }),
  eq({
    id: "eq-45hc",
    codigo: "45HC",
    nombre: "Contenedor 45' HC",
    categoria: "contenedor",
    largo: 13544,
    ancho: 2352,
    alto: 2698,
    puertaAncho: 2340,
    puertaAlto: 2585,
    cargaUtil: 25680,
  }),
  // 5.2 Reefer: altura útil = interior − 100 mm
  eq({
    id: "eq-20rf",
    codigo: "20RF",
    nombre: "Reefer 20'",
    categoria: "reefer",
    largo: 5450,
    ancho: 2290,
    alto: 2276,
    alturaUtil: 2176,
    puertaAncho: 2290,
    puertaAlto: 2276,
    cargaUtil: 27400,
  }),
  eq({
    id: "eq-40hcrf",
    codigo: "40HCRF",
    nombre: "Reefer 40' HC",
    categoria: "reefer",
    largo: 11590,
    ancho: 2290,
    alto: 2547,
    alturaUtil: 2447,
    puertaAncho: 2290,
    puertaAlto: 2502,
    cargaUtil: 29000,
  }),
  // 5.4 Terrestre
  eq({
    id: "eq-cs53",
    codigo: "CS53",
    nombre: "Caja seca 53'",
    categoria: "caja_seca",
    largo: 16002,
    ancho: 2515,
    alto: 2743,
    puertaAncho: 2388,
    puertaAlto: 2667,
    cargaUtil: 20000,
  }),
  eq({
    id: "eq-cs48",
    codigo: "CS48",
    nombre: "Caja seca 48'",
    categoria: "caja_seca",
    largo: 14453,
    ancho: 2515,
    alto: 2743,
    puertaAncho: 2388,
    puertaAlto: 2667,
    cargaUtil: 20000,
  }),
  eq({
    id: "eq-torton",
    codigo: "TORTON",
    nombre: "Torton C3 caja seca (típico)",
    categoria: "camion",
    largo: 7800,
    ancho: 2400,
    alto: 2400,
    puertaAncho: 2400,
    puertaAlto: 2400,
    cargaUtil: 14000,
  }),
  eq({
    id: "eq-rabon",
    codigo: "RABON",
    nombre: "Rabón C2 caja seca (típico)",
    categoria: "camion",
    largo: 6500,
    ancho: 2400,
    alto: 2300,
    puertaAncho: 2400,
    puertaAlto: 2300,
    cargaUtil: 8000,
  }),
  eq({
    id: "eq-cam35",
    codigo: "CAM35",
    nombre: "Camioneta 3.5 t caja seca (típico)",
    categoria: "camion",
    largo: 4200,
    ancho: 2100,
    alto: 2000,
    puertaAncho: 2100,
    puertaAlto: 2000,
    cargaUtil: 3500,
  }),
  // 5.5 ULD (paletas sin techo; la altura depende de la posición). La carga útil no viene
  // en la referencia: queda en null (<por confirmar con la aerolínea>) y el motor avisa.
  eq({
    id: "eq-pmc",
    codigo: "PMC",
    nombre: "PMC / P6P (cubierta principal)",
    categoria: "uld",
    largo: 3175,
    ancho: 2438,
    alto: 2440,
    puertaAncho: 2438,
    puertaAlto: 2440,
    cargaUtil: null,
    tara: 95,
    tieneTecho: false,
    tieneParedes: false,
  }),
  eq({
    id: "eq-pag",
    codigo: "PAG",
    nombre: "PAG / P1P (cubierta principal)",
    categoria: "uld",
    largo: 3175,
    ancho: 2235,
    alto: 2440,
    puertaAncho: 2235,
    puertaAlto: 2440,
    cargaUtil: null,
    tara: 90,
    tieneTecho: false,
    tieneParedes: false,
  }),
  eq({
    id: "eq-ld3",
    codigo: "LD3",
    nombre: "LD3 / AKE",
    categoria: "uld",
    largo: 1562,
    ancho: 1534,
    alto: 1626,
    puertaAncho: 1534,
    puertaAlto: 1626,
    cargaUtil: null,
  }),
];

/** Alturas de ULD paleta por posición (5.5). */
export const ALTURAS_ULD = {
  bodega_inferior: 1600,
  cubierta_principal: 2440,
  carguero: 3000,
} as const;

function tar(
  t: Omit<Tarima, "alturaMaxArmada" | "voladizoMax" | "material">,
): Tarima {
  return { alturaMaxArmada: 1800, voladizoMax: 0, material: "madera", ...t };
}

export const TARIMAS_GLOBALES: Tarima[] = [
  tar({
    id: "ta-gma",
    codigo: "ISO 3",
    nombre: "GMA / americana",
    largo: 1219,
    ancho: 1016,
    alto: 150,
    tara: 20,
    cargaMax: 1000,
  }),
  tar({
    id: "ta-eur1",
    codigo: "ISO 1",
    nombre: "Europea EUR1",
    largo: 1200,
    ancho: 800,
    alto: 144,
    tara: 25,
    cargaMax: 1000,
  }),
  tar({
    id: "ta-iso2",
    codigo: "ISO 2",
    nombre: "Industrial ISO 2",
    largo: 1200,
    ancho: 1000,
    alto: 144,
    tara: 30,
    cargaMax: 1000,
  }),
  tar({
    id: "ta-t11",
    codigo: "T11",
    nombre: "Asiática T11",
    largo: 1100,
    ancho: 1100,
    alto: 144,
    tara: 25,
    cargaMax: 1000,
  }),
  tar({
    id: "ta-iso4",
    codigo: "ISO 4",
    nombre: "ISO 4",
    largo: 1067,
    ancho: 1067,
    alto: 144,
    tara: 25,
    cargaMax: 1000,
  }),
  tar({
    id: "ta-iso6",
    codigo: "ISO 6",
    nombre: "ISO 6",
    largo: 1140,
    ancho: 1140,
    alto: 144,
    tara: 25,
    cargaMax: 1000,
  }),
  tar({
    id: "ta-aus",
    codigo: "AUS",
    nombre: "Australiana",
    largo: 1165,
    ancho: 1165,
    alto: 150,
    tara: 30,
    cargaMax: 1000,
  }),
  tar({
    id: "ta-media",
    codigo: "EUR6",
    nombre: "Media europea",
    largo: 800,
    ancho: 600,
    alto: 144,
    tara: 12,
    cargaMax: 500,
  }),
];

/** Factores de cobro por defecto (5.7). */
export const FACTORES_COBRO = {
  aereoDivisor: 6000,
  expressDivisor: 5000,
  lclKgPorM3: 1000,
} as const;

/** Valores por defecto de almacén (5.8). */
export const ALMACEN_DEFAULT = {
  holguraRociadores: 457,
  holguraLateral: 100,
  holguraVertical: 150,
  peralteViga: 125,
  fondoBastidor: 1067,
  vigaDosGma: 2438,
  pasillo: { contrabalanceado: 3500, retractil: 2800, vna: 1700 },
} as const;

const PALETA = [
  "#0072B2",
  "#E69F00",
  "#009E73",
  "#CC79A7",
  "#56B4E9",
  "#D55E00",
  "#F0E442",
  "#7F7F7F",
  "#882255",
  "#44AA99",
  "#332288",
  "#999933",
];

function mat(
  id: string,
  sku: string,
  nombre: string,
  tipo: Material["tipo"],
  [largo, ancho, alto]: [number, number, number],
  peso: number,
  preset: "libre" | "este_lado_arriba" | "plano",
  extra: Partial<Material> = {},
  i = 0,
): Material {
  return {
    id,
    sku,
    nombre,
    tipo,
    largo,
    ancho,
    alto,
    peso,
    orientaciones: orientacionesDePreset(preset, largo, ancho, alto),
    apilable: true,
    fragil: false,
    color: PALETA[i % PALETA.length],
    ...extra,
  };
}

/** 12 materiales demo (sección 13). */
export const MATERIALES_DEMO: Material[] = [
  mat(
    "m-caja-chica",
    "CJ-CH",
    "Caja chica",
    "caja",
    [400, 300, 250],
    8,
    "libre",
    {},
    0,
  ),
  mat(
    "m-caja-mediana",
    "CJ-MD",
    "Caja mediana",
    "caja",
    [600, 400, 400],
    15,
    "libre",
    {},
    1,
  ),
  mat(
    "m-caja-grande",
    "CJ-GR",
    "Caja grande",
    "caja",
    [800, 600, 600],
    25,
    "libre",
    {},
    2,
  ),
  mat(
    "m-mdf15",
    "MDF-15",
    "Tablero MDF 15 mm",
    "tablero",
    [2440, 1220, 15],
    32.6,
    "plano",
    {},
    3,
  ),
  mat(
    "m-mdf18",
    "MDF-18",
    "Tablero MDF 18 mm",
    "tablero",
    [2440, 1220, 18],
    39,
    "plano",
    {},
    4,
  ),
  mat(
    "m-atado-mdf",
    "AT-MDF15",
    "Atado 50 tableros MDF 15 mm",
    "tablero",
    [2440, 1220, 850],
    1630,
    "plano",
    { apilable: false },
    5,
  ),
  mat(
    "m-costal",
    "COS-25",
    "Costal 25 kg",
    "costal",
    [600, 400, 120],
    25,
    "plano",
    {},
    6,
  ),
  mat(
    "m-tambo",
    "TAM-200",
    "Tambo 200 L",
    "tambo",
    [585, 585, 880],
    200,
    "este_lado_arriba",
    {},
    7,
  ),
  mat(
    "m-cubeta",
    "CUB-19",
    "Cubeta 19 L",
    "cubeta",
    [300, 300, 370],
    22,
    "este_lado_arriba",
    {},
    8,
  ),
  mat(
    "m-ibc",
    "IBC-1000",
    "IBC 1,000 L",
    "ibc",
    [1200, 1000, 1160],
    1100,
    "este_lado_arriba",
    { apilable: false },
    9,
  ),
  mat(
    "m-electronicos",
    "CJ-ELEC",
    "Caja de electrónicos",
    "caja",
    [500, 400, 300],
    6,
    "este_lado_arriba",
    { fragil: true },
    10,
  ),
  mat(
    "m-refacciones",
    "CJ-REF",
    "Caja de refacciones",
    "caja",
    [450, 350, 300],
    18,
    "libre",
    {},
    11,
  ),
];

export function equipoPorCodigo(codigo: string): Equipo {
  const e = EQUIPOS_GLOBALES.find((x) => x.codigo === codigo);
  if (!e) throw new Error(`Equipo desconocido: ${codigo}`);
  return e;
}

export function tarimaPorId(id: string): Tarima {
  const t = TARIMAS_GLOBALES.find((x) => x.id === id);
  if (!t) throw new Error(`Tarima desconocida: ${id}`);
  return t;
}
