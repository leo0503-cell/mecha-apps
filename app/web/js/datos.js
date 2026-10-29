// Carga de datos por cliente. Cada cliente es una carpeta en datos/<id>/ que
// escriben el generador del radar (app/radar) y el resto de las automatizaciones.

import { guardar } from "./util.js";

const ID_VALIDO = /^[a-z0-9-]{2,64}$/;

/** El cliente sale de ?c=<id> (liga que se le manda) y se recuerda en el teléfono. */
export function clienteActual() {
  const url = new URL(location.href);
  const delUrl = url.searchParams.get("c");
  if (delUrl && ID_VALIDO.test(delUrl)) {
    guardar.escribir("mecha-cliente", delUrl);
    return delUrl;
  }
  const guardado = guardar.leer("mecha-cliente");
  return guardado && ID_VALIDO.test(guardado) ? guardado : "demo";
}

// Memoria corta: evita pedir el mismo JSON varias veces en una pantalla, pero
// la edición nueva del día aparece aunque la app se haya quedado abierta.
const memoria = new Map();
const VIGENCIA_MS = 5 * 60 * 1000;

export function olvidarDatos() {
  memoria.clear();
}

export async function cargar(ruta) {
  const url = `datos/${clienteActual()}/${ruta}`;
  const guardado = memoria.get(url);
  if (guardado && Date.now() - guardado.cuando < VIGENCIA_MS) return guardado.promesa;
  const promesa = fetch(url, { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} al cargar ${ruta}`);
    return r.json();
  });
  memoria.set(url, { promesa, cuando: Date.now() });
  promesa.catch(() => memoria.delete(url));
  return promesa;
}

/** Ruta a un archivo del cliente (imágenes, video) con la carpeta correcta. */
export function archivo(ruta) {
  const limpia = String(ruta ?? "").replace(/^\/+/, "");
  if (!limpia || /^[a-z]+:/i.test(limpia)) return "";
  // Se resuelve la URL completa (incluye %2e%2e) y tiene que quedar dentro de la carpeta del cliente.
  const base = new URL(`datos/${clienteActual()}/`, location.href);
  const final = new URL(limpia, base);
  if (final.origin !== base.origin || !final.pathname.startsWith(base.pathname)) return "";
  return final.pathname + final.search;
}
