/**
 * Tipos del motor de cubicaje. Unidades internas: mm (enteros) y kg.
 * Sistema de coordenadas: origen en la esquina fondo-izquierda-piso (pared
 * opuesta a la puerta). X = largo hacia la puerta, Y = ancho, Z = alto.
 */

/** Qué dimensión original va a X, Y y Z (L = largo, A = ancho, H = alto). */
export type CodigoOrientacion = "LAH" | "LHA" | "ALH" | "AHL" | "HLA" | "HAL";

export const TODAS_ORIENTACIONES: CodigoOrientacion[] = [
  "LAH",
  "LHA",
  "ALH",
  "AHL",
  "HLA",
  "HAL",
];

export type PresetOrientacion = "libre" | "este_lado_arriba" | "plano";

export type TipoMaterial =
  | "caja"
  | "tablero"
  | "costal"
  | "tambo"
  | "cubeta"
  | "ibc"
  | "rollo"
  | "pieza"
  | "otro";

export interface Material {
  id: string;
  sku?: string;
  nombre: string;
  tipo?: TipoMaterial;
  /** Medidas EXTERIORES con empaque, mm. */
  largo: number;
  ancho: number;
  alto: number;
  peso: number;
  orientaciones: CodigoOrientacion[];
  apilable: boolean;
  maxPesoEncima?: number | null;
  maxCapas?: number | null;
  fragil?: boolean;
  /** Resistencia ECT (lb/in) y calibre (in) para la fórmula de McKee. */
  ectLbIn?: number | null;
  calibreIn?: number | null;
  /** Factor de seguridad para BCT (3–5, por defecto 4). */
  factorSeguridad?: number | null;
  color?: string;
  paradaDescarga?: number;
}

export type CategoriaEquipo =
  "contenedor" | "reefer" | "caja_seca" | "camion" | "uld" | "personalizado";

export interface Equipo {
  id: string;
  codigo: string;
  nombre: string;
  categoria: CategoriaEquipo;
  largo: number;
  ancho: number;
  alto: number;
  /** Altura útil (línea roja en reefer, posición en ULD). */
  alturaUtil: number;
  puertaAncho: number;
  puertaAlto: number;
  /** null = sin dato; el motor no limita por peso y avisa. */
  cargaUtil: number | null;
  tara?: number | null;
  tieneTecho?: boolean;
  tieneParedes?: boolean;
  costoReferencia?: number | null;
  moneda?: "MXN" | "USD";
  notaValidacion?: string;
}

export interface Tarima {
  id: string;
  codigo?: string;
  nombre: string;
  largo: number;
  ancho: number;
  alto: number;
  tara: number;
  cargaMax: number;
  alturaMaxArmada: number;
  voladizoMax: number;
  material?: "madera" | "plastico" | "metal";
}

export interface Dims {
  l: number;
  a: number;
  h: number;
}

export interface Colocacion {
  equipoIdx: number;
  materialId: string;
  /** Índice en `tarimasArmadas` si la caja va sobre tarima. */
  tarimaIdx: number | null;
  x: number;
  y: number;
  z: number;
  l: number;
  a: number;
  h: number;
  orientacion: CodigoOrientacion;
  paso: number;
  capa: number;
}

export interface TarimaArmada {
  equipoIdx: number;
  tarimaId: string;
  x: number;
  y: number;
  z: number;
  l: number;
  a: number;
  /** Alto total armada (incluye la tarima). */
  h: number;
  /** Alto solo de la tarima. */
  hTarima: number;
  peso: number;
  cajas: number;
  paso: number;
  /** Voladizo: la cubierta de la tarima empieza en (x+offset, y+offset). */
  offset: number;
}

export type MotivoNoCargado =
  | "peso"
  | "volumen"
  | "puerta"
  | "apilado"
  | "altura_tarima"
  | "limite_equipos"
  | "limite_busqueda"
  | "orden_descarga";

export interface NoCargado {
  materialId: string;
  cantidad: number;
  motivo: MotivoNoCargado;
}

export type FactorLimitante =
  | "peso"
  | "volumen"
  | "altura"
  | "puerta"
  | "apilado"
  | "ninguno"
  | "busqueda"
  | "restricciones";

export interface Cog {
  x: number;
  y: number;
  z: number;
  /** Desviación respecto al centro del piso, fracción (0.1 = 10%). */
  desvLongitudinal: number;
  desvLateral: number;
  fueraDeTolerancia: boolean;
}

export interface KpisEquipo {
  equipoIdx: number;
  unidades: number;
  pesoKg: number;
  volumenM3: number;
  pctVolumen: number;
  pctPeso: number;
  cog: Cog | null;
}

export interface Kpis {
  unidadesCargadas: number;
  unidadesNoCargadas: number;
  equiposUsados: number;
  cbm: number;
  pesoRealKg: number;
  pctVolumen: number;
  pctPeso: number;
  factorLimitante: FactorLimitante;
  porEquipo: KpisEquipo[];
  /** Solo en homogéneo. */
  unidadesPorCapa?: number;
  capas?: number;
  unidadesPorEquipo?: number;
  cajasPorTarima?: number;
  tarimasPorEquipo?: number;
  cog: Cog | null;
}

export interface PlanCarga {
  versionMotor: string;
  semilla: number;
  equipos: Equipo[];
  materiales: Material[];
  tarimas: Tarima[];
  colocaciones: Colocacion[];
  tarimasArmadas: TarimaArmada[];
  noCargados: NoCargado[];
  kpis: Kpis;
  avisos: Aviso[];
  parametros: ParametrosCalculo;
}

export type NivelAviso = "info" | "advertencia" | "error";

export interface Aviso {
  nivel: NivelAviso;
  codigo: string;
  mensaje: string;
}

export interface ParametrosCalculo {
  /** Soporte mínimo de la base, fracción 0.6–1.0. */
  soporteMin: number;
  tiempoMaxS: number;
  holguraEntreBultos: number;
  permitirDobleEstiba: boolean;
  /** Tolerancia COG longitudinal y lateral (fracción). */
  toleranciaCogLong: number;
  toleranciaCogLat: number;
  semilla: number;
  /** Capas alternas rotadas en tarima (amarre). */
  amarre: boolean;
  operacion?: "importacion" | "exportacion" | "nacional";
}

export const PARAMETROS_DEFAULT: ParametrosCalculo = {
  soporteMin: 0.8,
  tiempoMaxS: 3,
  holguraEntreBultos: 0,
  permitirDobleEstiba: false,
  toleranciaCogLong: 0.1,
  toleranciaCogLat: 0.05,
  semilla: 1,
  amarre: false,
};

export const VERSION_MOTOR = "0.2.0";

export const NOTA_VALIDACION =
  "Valor referencial, varía por fabricante/naviera/carrocería; valida con tu proveedor.";

export const AVISO_FIJO =
  "Medidas y cargas útiles referenciales. Valida con tu naviera/transportista y con la NOM-012-SCT-2 para carretera.";
