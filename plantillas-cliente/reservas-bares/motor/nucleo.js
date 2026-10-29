"use strict";
// Reglas del sistema de reservas (motor de Mecha para bares). La marca, el plano y los
// horarios de cada lugar viven en datos.js. Lo usan la app del personal (app.js) y las
// páginas del cliente (reservar.html, mi-mesa.html). En el demo todo vive en localStorage;
// en producción esto va contra una base compartida y el WhatsApp sale por la API oficial.
const { MARCA, ZONAS, RPS, NOCHES, AJUSTES_BASE, MENU, SEMILLA, HISTORIAL } = window.NAB;
// Sucursales: cada una con su plano y sus mesas. Un bar de un solo local no declara SUCURSALES y
// queda con una sola, armada con el PLANO, MESAS y JUNTAS de siempre.
const SUCURSALES = window.NAB.SUCURSALES || [{ id: "principal", nombre: MARCA.sucursal || "", PLANO: window.NAB.PLANO, MESAS: window.NAB.MESAS, JUNTAS: window.NAB.JUNTAS || [], terminales: window.NAB.TERMINALES }];
const multiSucursal = SUCURSALES.length > 1;
const LLAVE = MARCA.archivo + "-demo-v4";
const METODOS = ["Efectivo", "Tarjeta", "Transferencia"];
const OCASIONES = MARCA.ocasiones;

let S;

// ---------- utilidades ----------
const $ = (sel, el = document) => el.querySelector(sel);
const dinero = (n) => "$" + Math.round(n || 0).toLocaleString("es-MX");
const kilo = (n) => "$" + (n >= 1000 ? +(n / 1000).toFixed(1) + "k" : n);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Minutos desde medianoche, contando la madrugada como continuación de la noche.
const aMin = (t) => { const [h, m] = t.split(":").map(Number); return (h < 12 ? h + 24 : h) * 60 + m; };
const aHora = (min) => String(Math.floor(min / 60) % 24).padStart(2, "0") + ":" + String(((min % 60) + 60) % 60).padStart(2, "0");
const HORAS = (() => { const out = []; for (let m = aMin(MARCA.horas.desde); m <= aMin(MARCA.horas.hasta); m += 15) out.push(aHora(m)); return out; })();
const zonaDe = (id) => ZONAS.find((z) => z.id === id);
const sucDe = (id) => SUCURSALES.find((s) => s.id === id) || SUCURSALES[0];
const mesasSuc = (suc = S.suc) => sucDe(suc).MESAS;
const mesaDe = (id, suc = S.suc) => mesasSuc(suc).find((m) => m.id === id);
const nombreSuc = (suc) => (multiSucursal ? sucDe(suc).nombre : "");
// Terminales de tarjeta: cada sucursal puede declarar las suyas; si no, una de barra y una de salón.
const terminalesDe = (suc) => sucDe(suc).terminales || [{ id: suc + "-barra", nombre: "Terminal barra" }, { id: suc + "-salon", nombre: "Terminal salón" }];
const rpDe = (id) => RPS.find((r) => r.id === id) || { id, nombre: id };
const nocheDe = (f) => NOCHES.find((n) => n.fecha === f);
const fechaCorta = (f) => new Date(f + "T12:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });
const chip = ([t, c]) => `<span class="chip ${c}">${t}</span>`;
const opciones = (lista, actual) => lista.map((v) => { const [val, txt] = Array.isArray(v) ? v : [v, v]; return `<option value="${esc(val)}"${val === actual ? " selected" : ""}>${esc(txt)}</option>`; }).join("");
const url = (ruta) => new URL(ruta, location.href).href;

// Lo que comparten todas las pantallas (localStorage) va aparte de lo que es de cada pestaña
// (sessionStorage: qué vista, sucursal, rol…). Así una pestaña no le pisa la pantalla a otra, y sólo
// se escribe cuando los datos cambian de verdad: escribir en cada repintado hacía que dos pestañas
// se avisaran una a la otra sin fin y la página se trababa.
const CLAVES_DATOS = ["ajustes", "menu", "reservas", "comandas", "seqComanda", "mesasEstado", "hora"];
const LLAVE_UI = LLAVE + "-pantalla";
let ultimoGuardado = null;
const datosDe = (st) => Object.fromEntries(CLAVES_DATOS.map((k) => [k, st[k]]));
const pantallaDe = (st) => Object.fromEntries(Object.keys(st).filter((k) => !CLAVES_DATOS.includes(k)).map((k) => [k, st[k]]));
function guardar() {
  try {
    const txt = JSON.stringify(datosDe(S));
    if (txt !== ultimoGuardado) { localStorage.setItem(LLAVE, txt); ultimoGuardado = txt; }
    sessionStorage.setItem(LLAVE_UI, JSON.stringify(pantallaDe(S)));
  } catch {}
}
function cargar() {
  try {
    const t = localStorage.getItem(LLAVE);
    if (!t) return null;
    ultimoGuardado = t;
    const pantalla = JSON.parse(sessionStorage.getItem(LLAVE_UI) || "null");
    return { ...pantallaInicial(), ...(pantalla || {}), ...JSON.parse(t) };
  } catch { return null; }
}
// Llegó un cambio de otra pestaña: se toman sus datos y se recuerda para no reescribirlos de vuelta.
function recibirDatos(txt) {
  ultimoGuardado = txt;
  Object.assign(S, JSON.parse(txt));
}
function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.innerHTML = msg;
  t.classList.add("ver");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove("ver"), 3600);
}
// QR como SVG (librería qrcode-generator cargada desde CDN).
function qrSvg(texto) {
  if (typeof qrcode !== "function") return `<div class="qr-falta mono">${esc(texto)}</div>`;
  const q = qrcode(0, "M");
  q.addData(texto);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

// ---------- marca en la página ----------
// Logo: la imagen sola si ya trae el nombre (MARCA.logoConTexto); si es sólo símbolo, va con el nombre.
// logoSobreFondo: versión para el fondo de la página cuando el logo normal va sobre el encabezado de color.
function logoMarca(clase = "") {
  const src = clase === "pago-logo" && MARCA.logoSobreFondo ? MARCA.logoSobreFondo : MARCA.logo;
  const img = `<img class="${clase}" src="${src}" alt="${MARCA.logoConTexto ? esc(MARCA.nombre) : ""}">`;
  if (MARCA.logoConTexto) return img;
  const nombre = `${esc(MARCA.nombre)}${MARCA.sucursal ? `<i>${esc(MARCA.sucursal)}</i>` : ""}`;
  return img + (clase ? `<p class="wordmark grande">${nombre}</p>` : `<span class="wordmark">${nombre}</span>`);
}
function aplicarMarca(titulo) {
  document.title = `${titulo} · ${MARCA.nombre}${MARCA.sucursal ? " " + MARCA.sucursal : ""}`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", MARCA.colorTema);
  const icono = document.querySelector('link[rel="icon"]');
  if (icono) icono.href = MARCA.icono;
}

// ---------- mínimos y anticipo ----------
// El mínimo por zona ya no decide el acomodo: sólo avisa al cerrar la cuenta si no se llegó.
const esEvento = (noche) => !!nocheDe(noche)?.evento;
function minimo(zonaId, noche = S.noche) {
  const base = Number(S.ajustes.minimos[zonaId]) || 0;
  return esEvento(noche) ? Math.ceil((base * S.ajustes.factorEvento) / 100) * 100 : base;
}
const minimoMesas = (ids, noche, suc = S.suc) => ids.reduce((a, id) => a + minimo(mesaDe(id, suc).zona, noche), 0);
const pagadoAnticipo = (r) => r.pagos.filter((p) => p.tipo === "Anticipo").reduce((a, p) => a + p.monto, 0);
const apartada = (r) => !r.anticipo || pagadoAnticipo(r) >= r.anticipo;
// Anticipo opcional: "nunca", sólo a clientes con 2+ no-shows ("riesgo") o "siempre"; sale del mínimo de su mesa.
function calcAnticipo(ids, tel, noche, suc = S.suc) {
  const modo = S.ajustes.anticipo;
  if (!ids.length || modo === "nunca" || (modo === "riesgo" && !riesgoAlto(perfil(tel)))) return 0;
  return Math.ceil((minimoMesas(ids, noche, suc) * S.ajustes.anticipoPct) / 100 / 100) * 100;
}
const ligaCliente = (r) => url("mi-mesa.html?c=" + r.codigo);
const ligaRP = (rpId) => url("reservar.html?rp=" + rpId);
const ligaSucursal = (suc, extra = "") => url(`reservar.html?${multiSucursal ? "suc=" + suc + "&" : ""}${extra}`);

// ---------- menú y comandas ----------
const productoDe = (id) => S.menu.find((p) => p.id === id);
const comandasDe = (r) => S.comandas.filter((c) => c.reservaId === r.id && c.estado !== "cancelada");
const totalComanda = (c) => c.items.reduce((a, i) => a + i.precio * i.cant, 0);
const cuenta = (r) => comandasDe(r).reduce((a, c) => a + totalComanda(c), 0);
// Una orden del mesero se parte en una comanda por área (barra / cocina) y llega sola a su pantalla.
function crearComandas(r, items, quien, estado = "nueva") {
  const porArea = {};
  items.forEach((i) => {
    const p = productoDe(i.id);
    (porArea[p.area] ??= []).push({ id: p.id, nombre: p.nombre, precio: p.precio, cant: i.cant, nota: i.nota || "" });
  });
  return Object.entries(porArea).map(([area, its]) => {
    const c = { id: "c" + S.seqComanda, numero: S.seqComanda++, reservaId: r.id, suc: r.suc, noche: r.noche, mesa: etiquetaMesa(r), cliente: r.cliente, area, items: its, estado, hora: S.hora, quien, creada: Date.now() };
    S.comandas.push(c);
    return c;
  });
}

// ---------- estado de reservaciones y mesas ----------
const deNoche = (noche = S.noche, suc = S.suc) => S.reservas.filter((r) => r.noche === noche && r.suc === suc);
const activa = (r) => r.estado === "reservada" || r.estado === "llego";
const vino = (r) => r.estado === "llego" || r.estado === "cerrada";
const pagado = (r) => r.pagos.reduce((a, p) => a + p.monto, 0);
const propinas = (r) => r.pagos.reduce((a, p) => a + (p.propina || 0), 0);
// Lo que se cobra es lo que pidieron (comandas), no lo que el RP dijo que iban a gastar.
const objetivo = (r) => cuenta(r);
const falta = (r) => Math.max(0, cuenta(r) - pagado(r));
function estadoPago(r) {
  const c = cuenta(r), p = pagado(r);
  if (!c) return p > 0 ? "anticipo" : "sinconsumo";
  if (p >= c) return "pagada";
  return p > 0 ? "parcial" : "pendiente";
}
const tarde = (r) => r.estado === "reservada" && aMin(S.hora) > aMin(r.hora) + Number(S.ajustes.tolerancia);
const mesasDe = (r) => (r.mesa ? [r.mesa, ...(r.mesasExtra || [])] : []);
const etiquetaMesa = (r) => mesasDe(r).join("+") || r.mesaOriginal || "—";
// Las mesas se repiten de nombre entre sucursales (M1 en cada una): todo se busca con su sucursal.
const reservaEnMesa = (mesaId, noche = S.noche, suc = S.suc) => S.reservas.find((r) => r.noche === noche && r.suc === suc && activa(r) && mesasDe(r).includes(mesaId));
const limpiezaDe = (noche = S.noche, suc = S.suc) => S.mesasEstado?.[suc]?.[noche] || {};
const estadoLimpieza = (mesaId, noche = S.noche, suc = S.suc) => limpiezaDe(noche, suc)[mesaId] || null;
function ocupadas(noche, excluirId, suc = S.suc) {
  const set = new Set(Object.keys(limpiezaDe(noche, suc)));
  S.reservas.filter((r) => r.noche === noche && r.suc === suc && r.id !== excluirId && activa(r)).forEach((r) => mesasDe(r).forEach((m) => set.add(m)));
  return set;
}
function estadoMesa(mesaId, noche = S.noche, suc = S.suc) {
  const r = reservaEnMesa(mesaId, noche, suc);
  if (!r) return estadoLimpieza(mesaId, noche, suc) ? "limpiar" : "libre";
  if (r.estado === "llego") return !cuenta(r) ? "enmesa" : falta(r) ? "debe" : "pagada";
  return tarde(r) ? "tarde" : "reservada";
}

// Opciones de mesa sin presupuesto: la mesa más chica donde caben, en la zona que pidieron.
// Sin zona pedida no se usa la zona reservada de la marca (p. ej. VIP: ésa la da el gerente o la piden).
// Si nadie cabe solo, se juntan mesas.
const ordenZona = (z) => ZONAS.findIndex((x) => x.id === z);
function candidatas(res) {
  const suc = res.suc || S.suc;
  const oc = ocupadas(res.noche, res.id, suc);
  const m0 = (ids) => mesaDe(ids[0], suc);
  const buscar = (zonaOk) => {
    const solas = mesasSuc(suc).filter((m) => !oc.has(m.id) && m.cap >= res.personas && zonaOk(m.zona))
      .map((m) => ({ ids: [m.id], zona: m.zona, cap: m.cap, orden: m.orden }));
    const juntas = sucDe(suc).JUNTAS.filter((ids) => ids.every((id) => !oc.has(id)) && zonaOk(m0(ids).zona))
      .map((ids) => ({ ids, zona: m0(ids).zona, cap: ids.reduce((a, id) => a + mesaDe(id, suc).cap, 0), orden: m0(ids).orden }))
      .filter((c) => c.cap >= res.personas);
    const orden = (a, b) => a.cap - b.cap || ordenZona(a.zona) - ordenZona(b.zona) || a.orden - b.orden;
    return solas.length ? solas.sort(orden) : juntas.sort(orden);
  };
  const libre = (z) => z !== MARCA.zonaReservada;
  const enZona = buscar(res.zona ? (z) => z === res.zona : libre);
  return enZona.length || !res.zona ? enZona : buscar(libre);
}

function sinLugar(res) {
  return `Ya no hay mesas libres para ${res.personas} personas${res.zona ? " en " + zonaDe(res.zona).nombre + " ni en otra zona" : ""} esta noche. El gerente la puede acomodar a mano.`;
}

function razon(r) {
  const ids = mesasDe(r);
  const z = zonaDe(mesaDe(ids[0], r.suc).zona).nombre;
  if (r.forzada === "gerente") return `La acomodó el gerente a mano.`;
  if (r.forzada === "cliente") return `El cliente eligió la mesa en el mapa.`;
  const pedida = r.zona && r.zona !== mesaDe(ids[0], r.suc).zona ? ` No había lugar en ${zonaDe(r.zona).nombre}.` : "";
  return ids.length > 1
    ? `Ninguna mesa sola es para ${r.personas}: se juntaron ${ids.join(" y ")} (${z}).${pedida}`
    : `La mesa más chica de ${z} donde caben ${r.personas}.${pedida}`;
}

function codigo() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c;
  do c = MARCA.prefijo + "-" + Array.from({ length: 4 }, () => abc[Math.floor(Math.random() * abc.length)]).join("");
  while (S.reservas.some((r) => r.codigo === c));
  return c;
}

// d.mesas: mesa elegida a mano (cliente en el mapa o gerente). d.forzada: "cliente" | "gerente".
// d.origen: "rp" | "liga" | "web". No hay presupuesto: la cuenta sale de las comandas.
function altaReserva(d) {
  const res = {
    id: "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    codigo: codigo(), origen: d.origen || "rp", suc: d.suc || S.suc,
    noche: d.noche, rp: d.rp, cliente: d.cliente.trim(), tel: d.tel.trim(),
    personas: Number(d.personas), zona: d.zona || "", hora: d.hora,
    ocasion: d.ocasion || "Normal", nota: (d.nota || "").trim(),
    mesa: null, mesasExtra: [], estado: "espera", pagos: [], llegada: null, salida: null, mesaOriginal: null,
    confirmacion: null, recordatorios: [], anticipo: 0, creada: Date.now(),
  };
  if (d.mesas?.length && d.mesas.every((id) => !ocupadas(res.noche, undefined, res.suc).has(id))) {
    [res.mesa, ...res.mesasExtra] = d.mesas;
    res.forzada = d.forzada || "cliente";
    res.estado = "reservada";
  } else {
    const c = candidatas(res);
    if (c.length) { [res.mesa, ...res.mesasExtra] = c[0].ids; res.estado = "reservada"; }
  }
  // El anticipo se fija al dar de alta: si después cambia el historial, no se le mueve al cliente.
  res.anticipo = calcAnticipo(mesasDe(res), res.tel, res.noche, res.suc);
  S.reservas.push(res);
  return res;
}

// Cuando se libera una mesa, la lista de espera se acomoda sola.
function reacomodarEspera(noche, suc = S.suc) {
  const acomodadas = [];
  S.reservas.filter((r) => r.noche === noche && r.suc === suc && r.estado === "espera").sort((a, b) => a.creada - b.creada).forEach((r) => {
    const c = candidatas(r);
    if (c.length) { [r.mesa, ...r.mesasExtra] = c[0].ids; r.estado = "reservada"; r.anticipo = calcAnticipo(mesasDe(r), r.tel, r.noche, r.suc); acomodadas.push(r); }
  });
  return acomodadas;
}
const avisoEspera = (acomodadas) => acomodadas.length ? ` · De la lista de espera entró ${acomodadas.map((a) => `<b>${esc(a.cliente)}</b> a ${etiquetaMesa(a)}`).join(", ")}` : "";

function liberar(r, estado) {
  r.mesaOriginal = etiquetaMesa(r);
  r.mesa = null;
  r.mesasExtra = [];
  r.estado = estado;
  return avisoEspera(reacomodarEspera(r.noche, r.suc));
}

// Se fueron: la reservación se cierra y sus mesas quedan "por limpiar" hasta que alguien las reactive.
function desocupar(r) {
  r.estado = "cerrada";
  r.salida = S.hora;
  const porNoche = ((S.mesasEstado[r.suc] ??= {})[r.noche] ??= {});
  mesasDe(r).forEach((id) => { porNoche[id] = { desde: S.hora, cliente: r.cliente }; });
}
function reactivar(mesaId, noche, suc = S.suc) {
  delete S.mesasEstado[suc]?.[noche]?.[mesaId];
  return avisoEspera(reacomodarEspera(noche, suc));
}

// ---------- recordatorios por WhatsApp ----------
// En producción salen solos por la API de WhatsApp; aquí se marcan según la hora simulada.
function correrRecordatorios() {
  const enviados = [];
  S.reservas.filter((r) => r.noche === S.noche && r.estado === "reservada").forEach((r) => {
    if (!r.recordatorios.some((x) => x.tipo === "Día antes")) r.recordatorios.push({ tipo: "Día antes", hora: "19:00" });
    const dos = aMin(r.hora) - 120;
    if (aMin(S.hora) >= dos && !r.recordatorios.some((x) => x.tipo === "2 h antes")) {
      r.recordatorios.push({ tipo: "2 h antes", hora: aHora(dos) });
      enviados.push(r);
    }
  });
  return enviados;
}

// ---------- historial de clientes (llave: WhatsApp a 10 dígitos) ----------
const telKey = (t) => String(t || "").replace(/\D/g, "").slice(-10);
function registros() {
  const actuales = S.reservas.filter((r) => ["llego", "cerrada", "noshow", "cancelada"].includes(r.estado))
    .map((r) => ({ tel: r.tel, cliente: r.cliente, noche: r.noche, estado: vino(r) ? "llego" : r.estado, consumo: vino(r) ? cuenta(r) : 0, rp: r.rp, ocasion: r.ocasion }));
  return [...HISTORIAL, ...actuales];
}
function perfil(tel) {
  const k = telKey(tel);
  if (k.length < 10) return null;
  const regs = registros().filter((x) => telKey(x.tel) === k).sort((a, b) => b.noche.localeCompare(a.noche));
  const proximas = S.reservas.filter((r) => telKey(r.tel) === k && (r.estado === "reservada" || r.estado === "espera"));
  if (!regs.length && !proximas.length) return null;
  const visitas = regs.filter((x) => x.estado === "llego");
  const gasto = visitas.reduce((a, x) => a + x.consumo, 0);
  const base = regs[0] || proximas[0];
  return {
    tel: k, telVisible: base.tel, cliente: base.cliente, regs, proximas,
    visitas: visitas.length, noshows: regs.filter((x) => x.estado === "noshow").length,
    cancelaciones: regs.filter((x) => x.estado === "cancelada").length,
    gasto, ticket: visitas.length ? gasto / visitas.length : 0, ultima: visitas[0]?.noche,
  };
}
function clientes() {
  const llaves = new Set([...registros().map((x) => telKey(x.tel)), ...S.reservas.map((r) => telKey(r.tel))]);
  return [...llaves].map(perfil).filter(Boolean);
}
const riesgoAlto = (p) => !!p && p.noshows >= 2;
function etiquetas(p) {
  const e = [];
  if (p.noshows >= 2) e.push(["Riesgo alto", "c-rojo"]);
  else if (p.noshows === 1) e.push(["1 no-show", "c-ambar"]);
  if (p.gasto >= 30000) e.push(["VIP", "c-cian"]);
  if (p.visitas >= 3) e.push(["Frecuente", "c-verde"]);
  if (!p.visitas && !p.noshows) e.push(["Nuevo", "c-gris"]);
  return e;
}

// ---------- estado inicial ----------
function pantallaInicial() {
  return {
    noche: NOCHES[0].fecha, suc: SUCURSALES[0].id,
    sesion: { rol: "gerente", rp: RPS[0].id, suc: SUCURSALES[0].id }, vista: "mapa", rp: RPS[0].id, sel: null, selRes: null, acomodando: null,
    filtro: "faltan", ultimo: null, prefill: null, cliSel: null, cliFiltro: "todos", cliBusca: "", area: "todas", ultimaTerminal: null,
  };
}
function estadoInicial() {
  S = {
    ...pantallaInicial(),
    ajustes: structuredClone(AJUSTES_BASE), menu: structuredClone(MENU), reservas: [], comandas: [], seqComanda: 101,
    mesasEstado: {}, hora: MARCA.horaInicial,
  };
  const items = (lista) => lista.map(([id, cant]) => ({ id, cant }));
  SEMILLA.forEach((d, i) => {
    const r = altaReserva(d);
    r.creada = i;
    if (d.confirmo) r.confirmacion = "si";
    if (d.llego && r.mesa) {
      r.estado = "llego";
      r.llegada = d.llego;
      if (d.pedido) crearComandas(r, items(d.pedido), "Mesero", d.enPreparacion ? "preparando" : "entregada").forEach((c) => (c.hora = d.llego));
      if (d.comandaNueva) crearComandas(r, items(d.comandaNueva), "Mesero");
      // Pagos de ejemplo: d.abono = pagos parciales; d.pago = liquida lo que falta.
      // Con tarjeta: por terminal (con folio) o, si aMano, registrado a mano (con o sin folio).
      const pagoEjemplo = (x, monto, n) => {
        const p = { monto, metodo: x.metodo, tipo: "Cuenta", hora: x.hora, recibio: "mesero" };
        if (x.propina) p.propina = Math.round((monto * x.propina) / 100);
        if (p.metodo === "Tarjeta" && x.aMano) Object.assign(p, { via: "manual" }, x.folio ? { folio: x.folio } : {});
        else if (p.metodo === "Tarjeta") Object.assign(p, { via: "terminal", terminal: terminalesDe(r.suc)[x.terminal || 0].nombre, aut: String(300000 + (i * 10 + n) * 7919), ultimos4: String(1000 + (((i * 10 + n) * 373) % 8999)) });
        r.pagos.push(p);
      };
      (d.abono || []).forEach((x, n) => pagoEjemplo(x, x.monto, n));
      if (d.pago) pagoEjemplo(d.pago, Math.max(0, cuenta(r) - pagado(r)), 9);
    }
    if (d.salio && r.mesa) { desocupar(r); r.salida = d.salio; S.mesasEstado[r.suc][r.noche][r.mesa].desde = d.salio; }
    if (d.noshow) liberar(r, "noshow");
  });
  correrRecordatorios();
  return S;
}

// ---------- plano ----------
// publico: para la página del cliente (sin nombres; muestra mínimos y lo ocupado en gris).
function plano({ publico = false, noche = S.noche, sel = null, suc = S.suc } = {}) {
  const attr = publico ? "data-pub" : "data-accion";
  const centro = (m) => (m.forma === "c" ? [m.x, m.y] : [m.x + m.w / 2, m.y + m.h / 2]);
  const uniones = publico ? "" : S.reservas.filter((r) => r.noche === noche && r.suc === suc && activa(r) && r.mesasExtra?.length).map((r) => {
    const ids = mesasDe(r);
    return ids.slice(1).map((id) => { const [x1, y1] = centro(mesaDe(ids[0], suc)), [x2, y2] = centro(mesaDe(id, suc)); return `<line class="union" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`; }).join("");
  }).join("");
  const mesas = mesasSuc(suc).map((m) => {
    const r = reservaEnMesa(m.id, noche, suc);
    let e = estadoMesa(m.id, noche, suc);
    if (publico) e = e === "libre" ? "libre-pub" : "ocupada";
    const esSel = sel === m.id ? " sel" : "";
    const ant = !publico && r && r.estado === "reservada" && pagadoAnticipo(r) > 0 ? `<circle class="dot-ant" cx="${m.forma === "c" ? m.x + 20 : m.x + m.w - 8}" cy="${m.forma === "c" ? m.y - 20 : m.y + 8}" r="5"/>` : "";
    const conf = !publico && r && r.estado === "reservada" && r.confirmacion === "si" ? `<text class="dot-conf" x="${m.forma === "c" ? m.x - 20 : m.x + 9}" y="${m.forma === "c" ? m.y - 15 : m.y + 13}">✓</text>` : "";
    let etiqueta;
    if (publico) etiqueta = e === "ocupada" ? "ocupada" : `${m.cap} pers`;
    else etiqueta = r ? esc(r.cliente.split(" ")[0]) : e === "limpiar" ? "limpiar" : `${m.cap}p`;
    const forma = m.forma === "c"
      ? `<circle class="mesa-forma" cx="${m.x}" cy="${m.y}" r="${m.r}"/>`
      : `<rect class="mesa-forma" x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="${m.h && m.h < 32 ? 5 : 10}"/>`;
    const [cx, cy] = centro(m);
    // Mesas muy bajitas (lugares de barra) llevan el texto en una sola línea.
    const textos = m.h && m.h < 32
      ? `<text class="mesa-id barra-txt" x="${cx}" y="${cy + 4}">${m.id} · ${etiqueta.slice(0, 7)}</text>`
      : `<text class="mesa-id" x="${cx}" y="${cy - 3}">${m.id}</text><text class="mesa-sub" x="${cx}" y="${cy + 12}">${etiqueta}</text>`;
    const clic = publico && e === "ocupada" ? "" : ` ${attr}="sel-mesa" data-mesa="${m.id}" tabindex="0" role="button"`;
    return `<g class="mesa e-${e}${esSel}"${clic} aria-label="Mesa ${m.id} ${e}">${forma}${textos}${ant}${conf}</g>`;
  }).join("");
  return `<svg class="plano" viewBox="0 0 1000 680" role="img" aria-label="Plano de ${esc(MARCA.nombre)}">
    <defs>
      <filter id="neon" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="g-pista" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#19F6EB" stop-opacity=".14"/><stop offset="1" stop-color="#19F6EB" stop-opacity="0"/></radialGradient>
      <pattern id="laser" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><line x1="0" y1="0" x2="0" y2="26" stroke="#2BFF9A" stroke-opacity=".05" stroke-width="1"/></pattern>
      <pattern id="rayas" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#9aa1a6" stroke-opacity=".35" stroke-width="2"/></pattern>
    </defs>
    ${sucDe(suc).PLANO}
    ${uniones}
    ${mesas}
  </svg>`;
}
