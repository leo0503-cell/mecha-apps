/** Definición de campos de cada catálogo: tabla, formulario y validación salen de aquí. */
import { z } from "zod";
import { RANGO_MEDIDA_MM, RANGO_PESO_KG, TODAS_ORIENTACIONES } from "@/motor";
import type { Entidad } from "@/lib/datos/tipos";

export type TipoCampo =
  | "texto"
  | "entero"
  | "decimal"
  | "medida"
  | "peso"
  | "bool"
  | "opcion"
  | "color"
  | "orientaciones";

export interface Campo {
  k: string;
  t: string;
  tipo: TipoCampo;
  opciones?: [string, string][];
  req?: boolean;
  min?: number;
  max?: number;
  ayuda?: string;
  /** Mostrar como columna en la tabla. */
  tabla?: boolean;
}

export interface ConfigCatalogo {
  titulo: string;
  singular: string;
  descripcion: string;
  campos: Campo[];
  nuevo: () => Record<string, unknown>;
}

const medida = (k: string, t: string, tabla = true, req = true): Campo => ({
  k,
  t,
  tipo: "medida",
  req,
  min: RANGO_MEDIDA_MM.min,
  max: RANGO_MEDIDA_MM.max,
  tabla,
});
const kg = (k: string, t: string, req = true, tabla = true): Campo => ({
  k,
  t,
  tipo: "peso",
  req,
  min: 0,
  max: RANGO_PESO_KG.max,
  tabla,
});

export const CATALOGOS: Record<Entidad, ConfigCatalogo> = {
  materiales: {
    titulo: "Materiales",
    singular: "material",
    descripcion:
      "Medidas EXTERIORES con empaque. Lo que capturas aquí es lo que el motor acomoda.",
    campos: [
      { k: "sku", t: "SKU", tipo: "texto", tabla: true },
      { k: "nombre", t: "Nombre", tipo: "texto", req: true, tabla: true },
      {
        k: "tipo",
        t: "Tipo",
        tipo: "opcion",
        opciones: [
          "caja",
          "tablero",
          "costal",
          "tambo",
          "cubeta",
          "ibc",
          "rollo",
          "pieza",
          "otro",
        ].map((x) => [x, x]),
        req: true,
      },
      medida("largo", "Largo"),
      medida("ancho", "Ancho"),
      medida("alto", "Alto"),
      { ...kg("peso", "Peso"), min: RANGO_PESO_KG.min },
      {
        k: "preset",
        t: "Orientación",
        tipo: "opcion",
        opciones: [
          ["libre", "Libre"],
          ["este_lado_arriba", "Este lado arriba"],
          ["plano", "Plano"],
        ],
        req: true,
        tabla: true,
      },
      {
        k: "orientaciones",
        t: "Rotaciones permitidas",
        tipo: "orientaciones",
        ayuda:
          "L = largo, A = ancho, H = alto; el orden dice qué va a lo largo, a lo ancho y hacia arriba.",
      },
      { k: "apilable", t: "Apilable", tipo: "bool", tabla: true },
      kg("maxPesoEncima", "Peso máx. encima", false, false),
      { k: "maxCapas", t: "Capas máx.", tipo: "entero", min: 1, max: 200 },
      { k: "fragil", t: "Frágil", tipo: "bool", tabla: true },
      {
        k: "ectLbIn",
        t: "ECT (lb/in)",
        tipo: "decimal",
        min: 0,
        max: 200,
        ayuda: "Con ECT y calibre se calcula la resistencia BCT (McKee).",
      },
      { k: "calibreIn", t: "Calibre (in)", tipo: "decimal", min: 0, max: 2 },
      {
        k: "densidad",
        t: "Densidad (kg/m³)",
        tipo: "decimal",
        min: 0,
        max: 30000,
      },
      {
        k: "unidadesPorBulto",
        t: "Unidades por bulto",
        tipo: "entero",
        min: 1,
        max: 100000,
      },
      { k: "color", t: "Color", tipo: "color" },
      { k: "hsCode", t: "Fracción arancelaria (HS)", tipo: "texto" },
      { k: "notas", t: "Notas", tipo: "texto" },
    ],
    nuevo: () => ({
      tipo: "caja",
      preset: "libre",
      orientaciones: [...TODAS_ORIENTACIONES],
      apilable: true,
      fragil: false,
      unidadesPorBulto: 1,
      color: "#0072B2",
      activo: true,
    }),
  },
  tarimas: {
    titulo: "Tarimas",
    singular: "tarima",
    descripcion:
      "ISO 6780 y regionales. Edita tara, carga y altura máxima armada según tu operación.",
    campos: [
      { k: "nombre", t: "Nombre", tipo: "texto", req: true, tabla: true },
      { k: "codigo", t: "Código ISO", tipo: "texto", tabla: true },
      medida("largo", "Largo"),
      medida("ancho", "Ancho"),
      medida("alto", "Alto"),
      kg("tara", "Tara"),
      kg("cargaMax", "Carga máxima"),
      medida("alturaMaxArmada", "Altura máx. armada", false),
      {
        k: "voladizoMax",
        t: "Voladizo máx. (mm)",
        tipo: "entero",
        min: 0,
        max: 300,
      },
      {
        k: "material",
        t: "Material",
        tipo: "opcion",
        opciones: [
          ["madera", "Madera"],
          ["plastico", "Plástico"],
          ["metal", "Metal"],
        ],
        req: true,
        tabla: true,
      },
      { k: "region", t: "Región", tipo: "texto" },
    ],
    nuevo: () => ({
      alturaMaxArmada: 1800,
      voladizoMax: 0,
      material: "madera",
      activo: true,
    }),
  },
  equipos: {
    titulo: "Equipos",
    singular: "equipo",
    descripcion:
      "Medidas INTERIORES. Valores referenciales: valida con tu naviera o transportista.",
    campos: [
      { k: "codigo", t: "Código", tipo: "texto", req: true, tabla: true },
      { k: "nombre", t: "Nombre", tipo: "texto", req: true, tabla: true },
      {
        k: "categoria",
        t: "Categoría",
        tipo: "opcion",
        opciones: [
          ["contenedor", "Contenedor"],
          ["reefer", "Reefer"],
          ["caja_seca", "Caja seca"],
          ["camion", "Camión"],
          ["uld", "ULD aéreo"],
          ["personalizado", "Personalizado"],
        ],
        req: true,
        tabla: true,
      },
      medida("largo", "Largo int."),
      medida("ancho", "Ancho int."),
      medida("alto", "Alto int."),
      {
        ...medida("alturaUtil", "Altura útil", false),
        ayuda: "Línea roja en reefer; altura por posición en ULD.",
      },
      medida("puertaAncho", "Puerta ancho", false),
      medida("puertaAlto", "Puerta alto", false),
      {
        ...kg("cargaUtil", "Carga útil", false),
        ayuda: "Vacío = sin dato: el cálculo no limita por peso y avisa.",
      },
      kg("tara", "Tara", false, false),
      { k: "tieneTecho", t: "Tiene techo", tipo: "bool" },
      { k: "tieneParedes", t: "Tiene paredes", tipo: "bool" },
      {
        k: "costoReferencia",
        t: "Costo de referencia",
        tipo: "decimal",
        min: 0,
        max: 1e9,
      },
      {
        k: "moneda",
        t: "Moneda",
        tipo: "opcion",
        opciones: [
          ["MXN", "MXN"],
          ["USD", "USD"],
        ],
      },
    ],
    nuevo: () => ({
      categoria: "personalizado",
      tieneTecho: true,
      tieneParedes: true,
      moneda: "MXN",
      activo: true,
    }),
  },
  transportistas: {
    titulo: "Transportistas",
    singular: "transportista",
    descripcion:
      "Divisores, mínimos y tarifas para calcular peso cobrable y costo.",
    campos: [
      { k: "nombre", t: "Nombre", tipo: "texto", req: true, tabla: true },
      {
        k: "modo",
        t: "Modo",
        tipo: "opcion",
        opciones: [
          ["aereo", "Aéreo"],
          ["lcl", "Marítimo LCL"],
          ["fcl", "Marítimo FCL"],
          ["ltl", "Terrestre LTL"],
          ["ftl", "Terrestre FTL"],
          ["paqueteria", "Paquetería"],
        ],
        req: true,
        tabla: true,
      },
      {
        k: "divisorVolumetrico",
        t: "Divisor volumétrico (cm³/kg)",
        tipo: "decimal",
        min: 1,
        max: 100000,
        tabla: true,
      },
      {
        k: "factorKgM3",
        t: "Factor (kg/m³)",
        tipo: "decimal",
        min: 1,
        max: 100000,
      },
      { k: "redondeo", t: "Redondeo", tipo: "decimal", min: 0, max: 100 },
      {
        k: "minimoCobrable",
        t: "Mínimo cobrable",
        tipo: "decimal",
        min: 0,
        max: 1e6,
      },
      {
        k: "tarifaPorKg",
        t: "Tarifa por kg",
        tipo: "decimal",
        min: 0,
        max: 1e6,
      },
      {
        k: "tarifaPorM3",
        t: "Tarifa por m³",
        tipo: "decimal",
        min: 0,
        max: 1e6,
      },
      {
        k: "moneda",
        t: "Moneda",
        tipo: "opcion",
        opciones: [
          ["MXN", "MXN"],
          ["USD", "USD"],
        ],
        req: true,
        tabla: true,
      },
    ],
    nuevo: () => ({ modo: "aereo", moneda: "MXN" }),
  },
  almacenes: {
    titulo: "Almacenes",
    singular: "almacén",
    descripcion:
      "Naves de tu empresa. Los racks se configuran en la fase de almacén.",
    campos: [
      { k: "nombre", t: "Nombre", tipo: "texto", req: true, tabla: true },
      medida("largo", "Largo"),
      medida("ancho", "Ancho"),
      { ...medida("alturaLibre", "Altura libre"), max: 40000 },
      {
        k: "holguraRociadores",
        t: "Holgura bajo rociadores (mm)",
        tipo: "entero",
        min: 0,
        max: 3000,
        req: true,
      },
    ],
    nuevo: () => ({ holguraRociadores: 457 }),
  },
};

/** Esquema Zod a partir de los campos (cliente; el servidor valida con CHECKs y RLS). */
export function esquemaDe(campos: Campo[]) {
  const forma: Record<string, z.ZodType> = {};
  for (const c of campos) {
    let s: z.ZodType;
    switch (c.tipo) {
      case "texto":
      case "color":
      case "opcion":
        s = c.req
          ? z.string({ error: "Requerido" }).trim().min(1, "Requerido")
          : z.string().nullish();
        break;
      case "bool":
        s = z.boolean().optional();
        break;
      case "orientaciones":
        s = z
          .array(z.enum(TODAS_ORIENTACIONES as [string, ...string[]]))
          .min(1, "Al menos una rotación");
        break;
      default: {
        const error = (i: { input?: unknown }) =>
          i.input == null ? "Requerido" : "Escribe un número";
        let n =
          c.tipo === "entero" || c.tipo === "medida"
            ? z.number({ error }).int("Sin decimales")
            : z.number({ error });
        if (c.min != null) n = n.min(c.min, `Mínimo ${c.min}`);
        if (c.max != null) n = n.max(c.max, `Máximo ${c.max}`);
        s = c.req ? n : n.nullish();
      }
    }
    forma[c.k] = s;
  }
  return z.object(forma).passthrough();
}
