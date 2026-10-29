export const STORAGE_KEY = "prende.v1";
const empty = () => ({
  perfil: null,
  radiografia: {},
  ruta: { hechos: [], ultimo: null, recetas: [] },
  favoritas: [],
  mesa: [],
  preferencias: { tema: "sistema", responsable: "" },
});
export let storageAvailable = true;
const object = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const strings = (value) =>
  Array.isArray(value)
    ? [...new Set(value.filter((v) => typeof v === "string"))]
    : [];
function read() {
  const initial = empty();
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!object(value)) return initial;
    return {
      ...initial,
      perfil: object(value.perfil)
        ? Object.fromEntries(
            Object.entries(value.perfil).filter(
              ([, v]) => typeof v === "string",
            ),
          )
        : null,
      radiografia: object(value.radiografia)
        ? {
            fecha:
              typeof value.radiografia.fecha === "string"
                ? value.radiografia.fecha
                : null,
            sintomas: strings(value.radiografia.sintomas),
            numeros: object(value.radiografia.numeros)
              ? value.radiografia.numeros
              : {},
          }
        : {},
      ruta: {
        hechos: Array.isArray(value.ruta?.hechos)
          ? [
              ...new Set(
                value.ruta.hechos.filter(
                  (d) => Number.isInteger(d) && d >= 1 && d <= 30,
                ),
              ),
            ]
          : [],
        ultimo: value.ruta?.ultimo || null,
        recetas: strings(value.ruta?.recetas),
      },
      favoritas: strings(value.favoritas),
      mesa: Array.isArray(value.mesa)
        ? value.mesa
            .filter(
              (entry) =>
                object(entry) &&
                typeof entry.pedido === "string" &&
                typeof entry.fecha === "string" &&
                object(entry.resultado) &&
                typeof entry.resultado.respuesta === "string",
            )
            .slice(0, 10)
        : [],
      preferencias: {
        tema: ["light", "dark", "sistema"].includes(value.preferencias?.tema)
          ? value.preferencias.tema
          : "sistema",
        responsable:
          typeof value.preferencias?.responsable === "string"
            ? value.preferencias.responsable
            : "",
      },
    };
  } catch {
    storageAvailable = false;
    return initial;
  }
}
export let state = read();
export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    storageAvailable = false;
    return false;
  }
}
export function clear() {
  state = empty();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    storageAvailable = false;
  }
}
export function applyTheme() {
  const theme = state.preferencias.tema;
  if (theme === "light" || theme === "dark")
    document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
