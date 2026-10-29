// Una respuesta local es seguimiento del usuario, nunca confirmación del servidor.
import { clienteActual } from "./datos.js";
import { guardar } from "./util.js";

const clave = () => `mecha-respuestas-contenido:${clienteActual()}`;
export const idRespuesta = (pieza) => `${pieza.id}@${pieza.version ?? 1}`;
export function respuestasContenido() {
  const datos = guardar.leer(clave(), {});
  return datos && typeof datos === "object" && !Array.isArray(datos)
    ? datos
    : {};
}
export function guardarRespuesta(pieza, estado) {
  const respuestas = respuestasContenido();
  respuestas[idRespuesta(pieza)] = { estado, enviado: true };
  guardar.escribir(clave(), respuestas);
  window.dispatchEvent(new Event("mecha:respuestas"));
}
export function respuestaEnviada(respuesta) {
  // Las cadenas de la versión anterior se guardaban al abrir WhatsApp: no prueban envío.
  return (
    respuesta?.enviado === true &&
    ["aprobado", "cambios"].includes(respuesta.estado)
  );
}
export function requiereRespuesta(pieza, respuestas = respuestasContenido()) {
  return (
    pieza.estado === "para aprobar" &&
    !respuestaEnviada(respuestas[idRespuesta(pieza)])
  );
}
