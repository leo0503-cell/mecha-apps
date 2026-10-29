import {
  Boxes,
  GraduationCap,
  Box,
  ReceiptText,
  BrainCircuit,
  Sparkles,
} from "lucide-react";
export const projects = [
  {
    id: "inventario",
    name: "Inventario vivo",
    subtitle: "El almacén, en una sola vista.",
    category: "Operación",
    origin: "Flujo de Inventario TMM",
    icon: Boxes,
    color: "lime",
    description:
      "Consulta existencias, localiza materiales y registra movimientos sin perder el control.",
  },
  {
    id: "cubicarga",
    name: "CubiCarga",
    subtitle: "Cada espacio cuenta.",
    category: "Logística",
    origin: "Proyecto Mecha",
    icon: Box,
    color: "blue",
    description:
      "Calcula volúmenes y explora cómo aprovechar mejor el espacio de tu próxima carga.",
  },
  {
    id: "academy",
    name: "Universidad TMM",
    subtitle: "Conocimiento que mueve equipos.",
    category: "Talento",
    origin: "Flujo de Universidad TMM",
    icon: GraduationCap,
    color: "purple",
    description:
      "Organiza la capacitación, prueba una evaluación y da seguimiento al aprendizaje.",
  },
  {
    id: "traba",
    name: "Traba",
    subtitle: "Destraba el siguiente paso.",
    category: "Finanzas",
    origin: "Proyecto Mecha",
    icon: ReceiptText,
    color: "orange",
    description:
      "Explora una bandeja de facturas con su motivo de bloqueo y siguiente responsable.",
  },
  {
    id: "relevo",
    name: "Relevo",
    subtitle: "Que el conocimiento se quede.",
    category: "Talento",
    origin: "Proyecto Mecha",
    icon: BrainCircuit,
    color: "pink",
    description:
      "Convierte experiencia operativa en fichas que el siguiente responsable puede practicar.",
  },
  {
    id: "prende",
    name: "Prende",
    subtitle: "IA con los pies en tu negocio.",
    category: "IA",
    origin: "Proyecto Mecha",
    icon: Sparkles,
    color: "teal",
    description:
      "Prueba una receta de trabajo y prepara instrucciones útiles para usar con tu IA.",
  },
] as const;
export type Project = (typeof projects)[number];
export const plans = [
  {
    name: "Starter",
    label: "DE LA IDEA AL PRIMER PASO",
    description: "Digitaliza ese proceso que hoy te quita tiempo.",
    features: [
      "Un proceso clave de tu operación",
      "Prototipo funcional y diseño a medida",
      "Capacitación para tu equipo",
      "Alcance definido antes de construir",
    ],
    cta: "Empezar mi proyecto",
  },
  {
    name: "Business",
    label: "CONECTA TU OPERACIÓN",
    description: "Haz que tus herramientas trabajen en equipo.",
    features: [
      "Flujos y automatizaciones conectadas",
      "Dashboard con indicadores acordados",
      "Integración de herramientas y APIs",
      "Marketing conectado con seguimiento",
    ],
    cta: "Impulsar mi empresa",
  },
  {
    name: "Enterprise",
    label: "TU OPERACIÓN, A TU MEDIDA",
    description: "Construyamos la plataforma que tu empresa necesita.",
    features: [
      "Desarrollo integral personalizado",
      "Arquitectura y permisos por rol",
      "Integraciones y adopción del equipo",
      "Acompañamiento técnico acordado",
    ],
    cta: "Diseñar mi solución",
  },
];
