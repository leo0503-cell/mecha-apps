export const roles = {
  dueno: "Dueño(a)",
  ventas: "Ventas",
  admin: "Administración",
  marketing: "Marketing",
};
export const fields = [
  {
    key: "negocio",
    question: "¿Cómo se llama tu negocio?",
    hint: "Empecemos por lo tuyo.",
    placeholder: "El nombre de tu negocio",
  },
  {
    key: "giro",
    question: "¿A qué se dedica?",
    hint: "Elige uno o escríbelo como tú lo cuentas.",
    choices: [
      "Restaurante",
      "Taller",
      "Consultorio",
      "Tienda",
      "Despacho",
      "Constructora",
      "Escuela",
      "Otro",
    ],
  },
  {
    key: "ciudad",
    question: "¿En qué ciudad estás?",
    hint: "Para que las recetas también sepan dónde estás.",
    placeholder: "Tu ciudad",
  },
  {
    key: "vende",
    question: "¿Qué vendes?",
    hint: "Dilo sin complicarte.",
    placeholder: "Por ejemplo: pasteles por encargo",
  },
  {
    key: "cliente",
    question: "¿Quién te compra?",
    hint: "Piensa en la persona que más te busca.",
    placeholder: "Por ejemplo: mamás que organizan fiestas",
  },
  {
    key: "tono",
    question: "¿Cómo le hablas a tu cliente?",
    hint: "Queremos que la IA suene a tu negocio.",
    choices: [
      "Cercano y de tú",
      "Profesional de usted",
      "Divertido",
      "Serio y técnico",
    ],
  },
  {
    key: "rol",
    question: "¿Qué haces tú en el negocio?",
    hint: "Así te recomendamos por dónde empezar.",
    choices: Object.keys(roles),
  },
];
export const missing = {
  negocio: "tu negocio",
  giro: "tu giro",
  ciudad: "tu ciudad",
  vende: "lo que vendes",
  cliente: "quién te compra",
  tono: "tu tono",
  rol: "tu rol",
};
export const numericQuestions = {
  whatsapp: [
    {
      key: "cantidad",
      label: "¿Cuántos mensajes de clientes contestas al día?",
    },
    {
      key: "minutos",
      label: "¿Cuántos minutos te toma cada uno, en promedio?",
    },
  ],
  cotizar: [
    { key: "cantidad", label: "¿Cuántas cotizaciones haces a la semana?" },
    { key: "minutos", label: "¿Minutos por cotización?" },
  ],
  agenda: [
    { key: "cantidad", label: "¿Cuántas citas agendas a la semana?" },
    { key: "minutos", label: "¿Minutos de mensajes por cita?" },
  ],
  redes: [
    { key: "horas", label: "¿Cuántas horas a la semana le dedicas a redes?" },
  ],
  competencia: [
    {
      key: "horas",
      label: "¿Cuántas horas al mes revisas a tu competencia? (puede ser 0)",
    },
  ],
  admin: [
    {
      key: "horas",
      label:
        "¿Cuántas horas a la semana se te van en correos, juntas y papeleo?",
    },
  ],
};
export function monthlyHours(id, values = {}) {
  const needed = numericQuestions[id]?.map((q) => q.key) || [];
  if (
    !needed.length ||
    needed.some(
      (k) =>
        values[k] === "" ||
        values[k] == null ||
        !Number.isFinite(Number(values[k])) ||
        Number(values[k]) <= 0,
    )
  )
    return null;
  const multiplier = id === "whatsapp" ? 30 : id === "competencia" ? 1 : 4.33;
  const result = needed.includes("minutos")
    ? (Number(values.cantidad) * Number(values.minutos) * multiplier) / 60
    : Number(values.horas) * multiplier;
  return Number.isFinite(result) ? result : null;
}
export function diagnosis(data, symptoms) {
  return symptoms
    .filter((s) => data.sintomas?.includes(s.id))
    .map((s) => ({ ...s, horas: monthlyHours(s.id, data.numeros?.[s.id]) }))
    .sort((a, b) => (b.horas || 0) - (a.horas || 0));
}
export function personalize(prompt, profile = {}) {
  return prompt.replace(
    /\{(\w+)\}/g,
    (_, key) => profile?.[key] || `[${missing[key] || key}]`,
  );
}
export function levelFor(route, count) {
  return (
    [...route.niveles].reverse().find((n) => count >= n.desde) ||
    route.niveles[0]
  );
}
export function nextChallenge(route, done) {
  return route.semanas
    .flatMap((s) => s.retos)
    .find((r) => !done.includes(r.dia));
}
const words = (value) =>
  (
    String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .match(/[a-z0-9]{4,}/g) || []
  ).filter(
    (w) =>
      !["para", "como", "necesito", "quiero", "negocio", "cliente"].includes(w),
  );
export function closestRecipe(request, recipes) {
  // Compara por raíz (5 letras) para que "reclamo" encuentre "reclamos" y "cobrarle" a "cobranza".
  const stem = (w) => w.slice(0, 5);
  const query = new Set(words(request).map(stem));
  const best = recipes
    .map((r) => {
      const clave = words(r.claves || "").filter((w) =>
        query.has(stem(w)),
      ).length;
      const texto = words(`${r.titulo} ${r.resuelve}`).filter((w) =>
        query.has(stem(w)),
      ).length;
      return { recipe: r, score: clave * 3 + texto };
    })
    .sort((a, b) => b.score - a.score)[0];
  return best && best.score > 0 ? best.recipe : null;
}
export function offlinePrompt(profile, request) {
  return `Ayúdame a resolver este pedido con un resultado listo para usar.\n\nPerfil del negocio:\n${fields.map((f) => `${f.key}: ${(f.key === "rol" ? roles[profile?.rol] : profile?.[f.key]) || `[${missing[f.key]}]`}`).join("\n")}\n\nPedido:\n${request}\n\nReglas: escribe en español de México, directo y con el tono del negocio. No inventes precios, fechas, cifras, testimonios ni datos. Lo que falta déjalo en [corchetes]. No prometas resultados ni tiempos que no te di. No repitas contraseñas, tarjetas ni datos personales; avisa si el pedido los contiene. Entrega texto listo para revisar y usar. Si algo requiere automatización, explica el límite con honestidad.`;
}
