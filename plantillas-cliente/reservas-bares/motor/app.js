"use strict";
// App del personal del bar: RP, hostess, mesero, barra/cocina y gerente. Las reglas viven en nucleo.js.

// ---------- roles y permisos ----------
// En producción cada quien entra con su teléfono y PIN; en el demo se cambia de rol arriba a la derecha.
const ROLES = {
  rp: { nombre: "RP", tabs: ["rp", "misnumeros"], desc: "Da de alta, comparte su liga, ve su comisión" },
  hostess: { nombre: "Hostess", tabs: ["mapa", "cobranza", "clientes"], desc: "Mapa, acomodo, check-in QR, cobros" },
  mesero: { nombre: "Mesero", tabs: ["mapa", "comandas", "cobranza"], desc: "Toma órdenes, cobra, libera y reactiva mesas" },
  barra: { nombre: "Barra / cocina", tabs: ["comandas"], desc: "Recibe las comandas y las marca listas" },
  gerente: { nombre: "Gerente", tabs: ["rp", "mapa", "comandas", "cobranza", "clientes", "menu", "gerente"], desc: "Todo: acomoda a mano, menú, ajustes" },
};
const TABS = {
  rp: ["Alta", "Reservar"], misnumeros: ["Mis números", "Semana"], mapa: ["Mapa", "Noche"], comandas: ["Comandas", "Barra · cocina"],
  cobranza: ["Cobranza", "Pagos"], clientes: ["Clientes", "Historial"], menu: ["Menú", "Catálogo"], gerente: ["Gerente", "Ajustes"],
};
const PERMISOS = {
  checkin: ["hostess", "mesero", "gerente"], cobrar: ["hostess", "mesero", "gerente"], ordenar: ["hostess", "mesero", "gerente"],
  desocupar: ["hostess", "mesero", "gerente"], reactivar: ["hostess", "mesero", "gerente"], escanear: ["hostess", "mesero", "gerente"],
  cancelar: ["hostess", "gerente"], noshow: ["hostess", "gerente"], mover: ["hostess", "gerente"], juntar: ["hostess", "gerente"],
  acomodar: ["hostess", "gerente"], cualquierMesa: ["gerente"], caja: ["hostess", "gerente"], preparar: ["barra", "mesero", "gerente"],
};
const rol = () => S.sesion.rol;
const puede = (accion) => PERMISOS[accion].includes(rol());
const quienSoy = () => (rol() === "rp" ? S.sesion.rp : rol());
const nombreQuien = (q) => (ROLES[q] ? ROLES[q].nombre : rpDe(q).nombre + " (RP)");
const RPS_REALES = RPS.filter((r) => !r.casa);
const AREAS = { barra: "Barra", cocina: "Cocina" };

// ---------- piezas comunes ----------
const CHIP_PAGO = {
  sinconsumo: ["Sin orden", "c-gris"], anticipo: ["Anticipo", "c-ambar"], pendiente: ["Debe", "c-rojo"],
  parcial: ["Pago parcial", "c-ambar"], pagada: ["Pagada", "c-cian"],
};
const CHIP_ESTADO = { reservada: ["Por llegar", "c-gris"], llego: ["En mesa", "c-verde"], cerrada: ["Se fue", "c-gris"], noshow: ["No llegó", "c-rojo"], cancelada: ["Cancelada", "c-gris"], espera: ["En espera", "c-ambar"] };
function chipEstado(r) {
  if (tarde(r)) return chip(["Tarde", "c-ambar"]);
  if (r.estado === "reservada" && r.confirmacion === "si") return chip(["Confirmó ✓", "c-verde"]);
  return chip(CHIP_ESTADO[r.estado]);
}
// Antes de llegar sólo importa el anticipo (si se pide); ya en mesa, la cuenta.
function chipPago(r) {
  if (r.estado === "reservada" || r.estado === "espera") {
    if (!r.anticipo) return "";
    if (apartada(r)) return chip(["Anticipo ✓", "c-cian"]);
    return r.efectivoPendiente ? chip(["Pagará en efectivo", "c-ambar"]) : chip(["Anticipo pendiente", "c-rojo"]);
  }
  if (r.estado === "noshow" || r.estado === "cancelada") return pagado(r) ? chip(["Anticipo retenido", "c-gris"]) : "";
  return chip(CHIP_PAGO[estadoPago(r)]);
}
const chipOrigen = (r) => (r.origen === "liga" ? chip(["Liga RP", "c-cian"]) : r.origen === "web" ? chip(["Web", "c-gris"]) : "");

function waLink(r) {
  const n = nocheDe(r.noche);
  const m = r.mesa ? `${etiquetaMesa(r)} (${zonaDe(mesaDe(r.mesa, r.suc).zona).nombre})` : "en lista de espera";
  const suc = multiSucursal ? `\nSucursal: ${sucDe(r.suc).nombre}${sucDe(r.suc).direccion ? " · " + sucDe(r.suc).direccion : ""}` : "";
  const liga = r.estado === "reservada" ? `\n\n${apartada(r) ? "Tu pase de entrada, confirmar o cancelar" : `Para apartar tu mesa paga el anticipo de ${dinero(r.anticipo - pagadoAnticipo(r))} aquí`}:\n${ligaCliente(r)}` : "";
  const txt = `Hola ${r.cliente}, tu reservación en ${MARCA.nombre}${MARCA.sucursal ? " " + MARCA.sucursal : ""} está lista ${MARCA.emoji}\n${suc}\nNoche: ${n.larga}\nMesa: ${m}\nPersonas: ${r.personas} · Llegada: ${r.hora}\nCódigo: ${r.codigo}${liga}\n\nTolerancia de ${S.ajustes.tolerancia} min. ${MARCA.lema}`;
  return `https://wa.me/52${telKey(r.tel)}?text=${encodeURIComponent(txt)}`;
}
function waRecordatorio(r) {
  const txt = `Hola ${r.cliente} ${MARCA.emoji} hoy te esperamos en ${MARCA.nombre}${multiSucursal ? " " + sucDe(r.suc).nombre : ""} a las ${r.hora} (mesa ${etiquetaMesa(r)}).\n¿Sigues en pie? Confirma o cancela aquí:\n${ligaCliente(r)}`;
  return `https://wa.me/52${telKey(r.tel)}?text=${encodeURIComponent(txt)}`;
}

const chipSuc = (r) => (multiSucursal && r.suc !== S.suc ? chip([esc(sucDe(r.suc).nombre), "c-gris"]) : "");
function filaReserva(r) {
  const m = r.mesa ? mesaDe(r.mesa, r.suc) : null;
  const c = cuenta(r);
  return `<div class="fila-res" data-accion="abrir" data-id="${r.id}">
    <div class="mesa-tag ${m ? "z-" + m.zona : "z-none"}">${etiquetaMesa(r)}</div>
    <div class="fr-cuerpo">
      <div class="fr-nombre">${esc(r.cliente)}</div>
      <div class="fr-meta">${r.hora} · ${r.personas} pers · ${esc(rpDe(r.rp).nombre)} · <span class="mono">${r.codigo}</span></div>
    </div>
    <div class="fr-chips">${chipSuc(r)}${chipEstado(r)}${chipPago(r)}${chipOrigen(r)}</div>
    ${c ? `<div class="fr-monto"><b>${dinero(pagado(r))}</b><small>de ${dinero(c)}</small></div>` : `<div class="fr-monto"></div>`}
  </div>`;
}

// ---------- vista alta (RP y gerente) ----------
function opcionesMesas(noche, suc = S.suc) {
  const oc = ocupadas(noche, undefined, suc);
  return `<option value="">Que la acomode el sistema</option>` + mesasSuc(suc).filter((m) => !oc.has(m.id))
    .map((m) => `<option value="${m.id}">${m.id} · ${zonaDe(m.zona).nombre} · ${m.cap} lugares</option>`).join("");
}
function vistaRP() {
  const esRP = rol() === "rp";
  if (esRP) S.rp = S.sesion.rp;
  // El RP ve lo suyo en todas las sucursales; el gerente, lo de la sucursal que tiene abierta.
  const mias = S.reservas.filter((r) => r.noche === S.noche && r.rp === S.rp && (esRP || r.suc === S.suc)).sort((a, b) => aMin(a.hora) - aMin(b.hora));
  const u = S.ultimo && S.reservas.find((r) => r.id === S.ultimo);
  const pre = S.prefill || {};
  S.prefill = null;
  return `<section class="grid-rp">
    <form class="panel" id="form-rp" autocomplete="off">
      <div class="panel-cab"><h2>Nueva reservación</h2><span class="serif">${MARCA.lema}</span></div>
      <div class="campos">
        ${esRP ? `<input type="hidden" name="rp" value="${S.rp}">` : `<label class="campo">RP <select name="rp" data-cambia="rp">${opciones(RPS.map((r) => [r.id, r.nombre]), S.rp)}</select></label>`}
        <label class="campo${esRP ? " ancho" : ""}">Noche <select name="noche" data-pista>${opciones(NOCHES.map((n) => [n.fecha, n.corta + (n.evento ? " · " + n.evento : "")]), S.noche)}</select></label>
        ${multiSucursal ? `<label class="campo ancho">Sucursal <select name="suc" data-pista>${opciones(SUCURSALES.map((x) => [x.id, x.nombre]), S.suc)}</select></label>` : ""}
        <label class="campo ancho">WhatsApp <input name="tel" required inputmode="tel" placeholder="449 123 4567" data-tel value="${esc(pre.tel || "")}"></label>
        <div class="ancho" id="perfil-rp">${tarjetaPerfilRP(pre.tel)}</div>
        <label class="campo ancho">Cliente <input name="cliente" required placeholder="Nombre de quien reserva" value="${esc(pre.cliente || "")}"></label>
        <label class="campo">Personas <input name="personas" type="number" min="1" max="40" value="${MARCA.personas || 4}" required data-pista></label>
        <label class="campo">Zona que prefieren <select name="zona" data-pista>${opciones([["", "Cualquiera"], ...ZONAS.map((z) => [z.id, z.nombre])], "")}</select></label>
        ${puede("cualquierMesa") ? `<label class="campo ancho">Mesa <select name="mesa" data-pista id="sel-mesa-alta">${opcionesMesas(S.noche)}</select></label>` : ""}
        <label class="campo">Llega <select name="hora">${opciones(HORAS, MARCA.horaReserva)}</select></label>
        <label class="campo">Ocasión <select name="ocasion">${opciones(OCASIONES)}</select></label>
        <label class="campo ancho">Nota <input name="nota" placeholder="Botella, pastel, bengalas, alguien VIP…"></label>
      </div>
      <div class="pista" id="pista">Escribe cuántas personas van: aquí ves qué mesa les toca antes de darla de alta.</div>
      <button class="btn primario grande" type="submit">Dar de alta y acomodar</button>
    </form>
    <div class="col">
      ${u ? tarjetaConfirmacion(u) : `<div class="panel vacio"><img src="${MARCA.logoTenue || "img/logo-blanco.png"}" alt=""><p>Da de alta una reservación y el sistema le busca mesa solo.${puede("cualquierMesa") ? "<br>Como gerente también puedes escoger tú la mesa." : ""}</p></div>`}
      <div class="panel">
        <div class="panel-cab"><h3>${esRP ? "Mis" : esc(rpDe(S.rp).nombre) + " ·"} reservaciones · ${nocheDe(S.noche).corta}</h3><span class="mono tenue">${mias.length}</span></div>
        <div class="lista">${mias.map((r) => filaRPConAcciones(r)).join("") || `<p class="tenue">Sin reservaciones esta noche.</p>`}</div>
      </div>
    </div>
  </section>`;
}

// En la app del RP cada reservación trae lo que él puede hacer: reenviar la liga o registrar efectivo del anticipo.
function filaRPConAcciones(r) {
  const acciones = r.estado === "reservada" && !apartada(r)
    ? `<div class="fila-acc"><a class="btn chico" href="${waLink(r)}" target="_blank" rel="noopener">Reenviar liga</a><button class="btn chico" data-accion="efectivo-rp" data-id="${r.id}">Recibí efectivo</button></div>` : "";
  return filaReserva(r) + acciones;
}

function tarjetaConfirmacion(r) {
  if (r.estado === "espera") {
    return `<div class="panel confirmacion espera">
      <span class="eyebrow">Lista de espera</span>
      <div class="conf-mesa">—</div>
      <p>${esc(r.cliente)} · ${r.personas} personas</p>
      <p class="nota-ambar">${esc(sinLugar(r))}</p>
      <p class="tenue">Si se libera una mesa donde quepan, se acomoda sola y te avisa.</p>
    </div>`;
  }
  const m = mesaDe(r.mesa, r.suc);
  return `<div class="panel confirmacion">
    <span class="eyebrow">Acomodada · ${multiSucursal ? esc(sucDe(r.suc).nombre) + " · " : ""}${nocheDe(r.noche).corta}</span>
    <div class="conf-fila">
      <div class="conf-mesa${r.mesasExtra.length ? " doble" : ""}">${etiquetaMesa(r)}</div>
      <div>
        <div class="conf-zona">${zonaDe(m.zona).nombre}${r.mesasExtra.length ? " · juntas" : ""}</div>
        <div class="tenue">${esc(r.cliente)} · ${r.personas} pers · llega ${r.hora}</div>
        <div class="mono cian">${r.codigo}</div>
      </div>
    </div>
    <p class="tenue">${esc(razon(r))}</p>
    ${bloqueAnticipo(r)}
    <div class="botones">
      <a class="btn primario" href="${waLink(r)}" target="_blank" rel="noopener">Mandar por WhatsApp</a>
      ${rol() !== "rp" ? `<button class="btn" type="button" data-accion="ver-mapa" data-mesa="${m.id}" data-noche="${r.noche}" data-suc="${r.suc}">Ver en mapa</button>` : ""}
      <a class="btn" href="${ligaCliente(r)}" target="_blank" rel="noopener">Ver como cliente</a>
    </div>
  </div>`;
}

function bloqueAnticipo(r) {
  if (r.estado !== "reservada" || !r.anticipo) return "";
  if (apartada(r)) {
    const p = r.pagos.filter((x) => x.tipo === "Anticipo").at(-1);
    return `<div class="anticipo ok"><span class="eyebrow">Anticipo pagado</span><div><b>${dinero(pagadoAnticipo(r))}</b>${p ? ` · ${p.metodo} · ${p.hora}` : ""} · se descuenta de su cuenta</div></div>`;
  }
  return `<div class="anticipo">
    <div class="ant-cab"><span class="eyebrow">Anticipo para apartar</span><b>${dinero(r.anticipo - pagadoAnticipo(r))}</b></div>
    ${r.efectivoPendiente ? `<p class="nota-ambar">El cliente eligió pagar en efectivo con su RP.</p>` : ""}
    <div class="liga"><span class="mono">${esc(ligaCliente(r).replace(/^https?:\/\//, ""))}</span>
      <button class="btn chico" type="button" data-accion="copiar" data-texto="${esc(ligaCliente(r))}">Copiar</button>
      <a class="btn chico" href="${ligaCliente(r)}" target="_blank" rel="noopener">Abrir como cliente</a>
    </div>
  </div>`;
}

// Lo que el RP ve al escribir el WhatsApp: si ya vino, cuánto gasta y si ha dejado plantado.
function tarjetaPerfilRP(tel) {
  const p = perfil(tel);
  if (!p) return "";
  const conAnticipo = S.ajustes.anticipo !== "nunca";
  const alerta = riesgoAlto(p)
    ? `<p class="nota-roja">Dejó plantadas ${p.noshows} mesas.${conAnticipo ? " Se le pide anticipo para apartar." : " Confírmale antes de la noche."}</p>`
    : p.noshows === 1 ? `<p class="nota-ambar">Tiene 1 no-show. Confirma con él antes de la noche.</p>` : "";
  return `<div class="perfil-rp ${riesgoAlto(p) ? "riesgo" : ""}">
    <div class="pr-cab"><b>${esc(p.cliente)}</b><span class="fr-chips">${etiquetas(p).map(chip).join("")}</span></div>
    <div class="pr-datos"><span><b>${p.visitas}</b> visitas</span><span><b class="${p.noshows ? "rojo" : ""}">${p.noshows}</b> no-shows</span><span>ticket <b>${dinero(p.ticket)}</b></span>${p.ultima ? `<span>última ${fechaCorta(p.ultima)}</span>` : ""}</div>
    ${alerta}
  </div>`;
}

function pista(form) {
  const personas = Number(form.personas.value), noche = form.noche.value, zona = form.zona.value;
  const suc = form.suc?.value || S.suc;
  const elegida = form.mesa?.value;
  const el = $("#pista");
  if (!personas) { el.className = "pista"; el.textContent = "Escribe cuántas personas van: aquí ves qué mesa les toca antes de darla de alta."; return; }
  if (elegida) {
    const m = mesaDe(elegida, suc);
    el.className = m.cap < personas ? "pista mal" : "pista bien";
    el.innerHTML = `La acomodas tú en <b>${m.id}</b> · ${zonaDe(m.zona).nombre} (${m.cap} lugares).` + (m.cap < personas ? ` Van ${personas}: júntale otra mesa desde el mapa.` : "");
    return;
  }
  const prueba = { id: "_", noche, personas, zona, suc };
  const c = candidatas(prueba);
  if (!c.length) { el.className = "pista mal"; el.textContent = sinLugar(prueba); return; }
  const o = c[0];
  const ant = calcAnticipo(o.ids, form.tel.value, noche, suc);
  el.className = "pista bien";
  el.innerHTML = `Les toca <b>${zonaDe(o.zona).nombre}</b> · ${o.ids.length > 1 ? "mesas juntas" : "mesa"} <b>${o.ids.join("+")}</b> (${o.cap} lugares)` +
    (zona && o.zona !== zona ? `<br><span class="ambar">No queda lugar en ${zonaDe(zona).nombre}.</span>` : "") +
    (ant ? `<br><span class="tenue">Anticipo para apartar: ${dinero(ant)}.</span>` : "");
}

// ---------- vista RP: mis números (semana) ----------
const lunes = (f) => { const d = new Date(f + "T12:00"); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
function numerosRP(rpId, noches) {
  const suyas = S.reservas.filter((r) => r.rp === rpId && noches.includes(r.noche) && r.estado !== "cancelada" && r.estado !== "espera");
  const cobrado = suyas.reduce((a, r) => a + pagado(r), 0);
  return { suyas, total: suyas.length, vinieron: suyas.filter(vino).length, consumo: suyas.reduce((a, r) => a + cuenta(r), 0), cobrado, comision: (cobrado * S.ajustes.comision) / 100, porLiga: suyas.filter((r) => r.origen === "liga").length };
}
function efectivoEnMano(rpId) {
  return S.reservas.flatMap((r) => r.pagos.filter((p) => p.metodo === "Efectivo" && p.recibio === rpId && !p.entregado).map((p) => ({ p, r })));
}
function vistaMisNumeros() {
  const rpId = S.sesion.rp;
  const noches = NOCHES.filter((n) => lunes(n.fecha) === lunes(S.noche)).map((n) => n.fecha);
  const yo = numerosRP(rpId, noches);
  const meta = S.ajustes.metaSemanal;
  const ranking = RPS_REALES.map((rp) => ({ rp, ...numerosRP(rp.id, noches) })).sort((a, b) => b.cobrado - a.cobrado || b.total - a.total);
  const lugar = ranking.findIndex((x) => x.rp.id === rpId) + 1;
  const mano = efectivoEnMano(rpId);
  const liga = ligaRP(rpId);
  const msj = `Aparta tu mesa en ${MARCA.nombre}${MARCA.sucursal ? " " + MARCA.sucursal : ""} ${MARCA.emoji} escoge tu lugar en el mapa aquí: ${liga}`;
  return `<section class="grid-numeros">
    <div class="hola"><span class="eyebrow">Semana del ${fechaCorta(noches[0])} al ${fechaCorta(noches.at(-1))}</span><h2>Hola, ${esc(rpDe(rpId).nombre)} <span class="serif">vas #${lugar}</span></h2></div>
    <div class="kpis">
      <div class="kpi"><small>Reservaciones</small><b>${yo.total}<span class="tenue"> / ${meta}</span></b><div class="meta"><i style="width:${Math.min(100, (yo.total / meta) * 100)}%"></i></div></div>
      <div class="kpi"><small>Llegaron</small><b>${yo.vinieron}<span class="tenue"> ${yo.total ? Math.round((yo.vinieron / yo.total) * 100) : 0}%</span></b></div>
      <div class="kpi"><small>Consumieron (cobrado)</small><b class="cian">${dinero(yo.cobrado)}</b></div>
      <div class="kpi"><small>Tu comisión ${S.ajustes.comision}%</small><b class="verde">${dinero(yo.comision)}</b></div>
    </div>
    <div class="grid-rp">
      <div class="col">
        <div class="panel liga-rp">
          <div class="panel-cab"><h3>Tu liga para historias</h3><span class="chip c-cian">${yo.porLiga} por liga</span></div>
          <div class="liga-qr">${qrSvg(liga)}</div>
          <div class="liga"><span class="mono">${esc(liga.replace(/^https?:\/\//, ""))}</span><button class="btn chico" data-accion="copiar" data-texto="${esc(liga)}">Copiar</button></div>
          <div class="botones">
            <a class="btn primario" href="https://wa.me/?text=${encodeURIComponent(msj)}" target="_blank" rel="noopener">Compartir por WhatsApp</a>
            <a class="btn" href="${liga}" target="_blank" rel="noopener">Ver como cliente</a>
          </div>
          <p class="tenue chico">Quien reserve desde tu liga escoge su mesa en el mapa y queda a tu nombre. Tu comisión sale de lo que de verdad consumen.</p>
        </div>
        ${mano.length ? `<div class="panel efectivo-mano">
          <div class="panel-cab"><h3>Efectivo que traes</h3><b class="ambar mono">${dinero(mano.reduce((a, x) => a + x.p.monto, 0))}</b></div>
          <ul class="pagos">${mano.map(({ p, r }) => `<li><span>${esc(r.cliente)} · ${p.tipo}</span><span class="mono">${fechaCorta(r.noche)}</span><b>${dinero(p.monto)}</b></li>`).join("")}</ul>
          <p class="tenue chico">Entrégalo en caja; el gerente o la hostess lo marcan como recibido.</p>
        </div>` : ""}
      </div>
      <div class="col">
        <div class="panel">
          <div class="panel-cab"><h3>Ranking de la semana</h3><span class="tenue chico">por lo cobrado</span></div>
          ${ranking.map((x, i) => `<div class="rank${x.rp.id === rpId ? " yo" : ""}"><span class="mono">${i + 1}</span><b>${esc(x.rp.nombre)}</b><span class="tenue">${x.total} reservas</span><span class="mono cian">${dinero(x.cobrado)}</span></div>`).join("")}
        </div>
        <div class="panel">
          <div class="panel-cab"><h3>Tus reservaciones de la semana</h3></div>
          ${noches.map((f) => { const l = S.reservas.filter((r) => r.rp === rpId && r.noche === f && r.estado !== "cancelada"); return l.length ? `<h4>${nocheDe(f).corta}${nocheDe(f).evento ? " · " + nocheDe(f).evento : ""}</h4><div class="lista">${l.map((r) => filaRPConAcciones(r)).join("")}</div>` : ""; }).join("") || `<p class="tenue">Aún nada esta semana. Comparte tu liga.</p>`}
        </div>
      </div>
    </div>
  </section>`;
}

// ---------- vista mapa ----------
function detalleMesa(id) {
  const m = mesaDe(id);
  const r = reservaEnMesa(id);
  const cab = `<div class="panel-cab"><h3>Mesa ${m.id} <span class="tenue">· ${zonaDe(m.zona).nombre}</span></h3><button class="x" data-accion="cerrar-sel" aria-label="Cerrar">×</button></div>
    <p class="tenue">${m.cap} lugares · consumo mínimo ${dinero(minimo(m.zona))}${esEvento(S.noche) ? " (evento)" : ""}</p>`;
  if (r) return cab + detalleReserva(r);
  const limpia = estadoLimpieza(id);
  if (limpia) {
    return cab + `<div class="anticipo limpiar">
        <span class="eyebrow">Por limpiar</span>
        <p>Se desocupó a las <b>${limpia.desde}</b>${limpia.cliente ? ` (${esc(limpia.cliente)})` : ""}. Nadie la puede ocupar hasta que se reactive.</p>
      </div>
      ${puede("reactivar") ? `<div class="botones"><button class="btn primario grande" data-accion="reactivar" data-mesa="${id}">Mesa lista · reactivar</button></div>` : ""}`;
  }
  // Reservaciones que el gerente o la hostess pueden pasar a esta mesa.
  const candidatasAqui = deNoche().filter((x) => x.estado === "espera" || (x.estado === "reservada" && (puede("cualquierMesa") || x.personas <= m.cap)));
  return cab + `<p class="chip c-gris">Libre</p>
    ${puede("acomodar") && candidatasAqui.length ? `<h4>Acomodar aquí</h4><div class="lista">${candidatasAqui.map((x) => `<button class="btn fila-btn" data-accion="asignar-aqui" data-id="${x.id}" data-mesa="${id}"><span class="mesa-tag z-${x.mesa ? mesaDe(x.mesa).zona : "none"}">${etiquetaMesa(x)}</span>${esc(x.cliente)} · ${x.personas}p${x.personas > m.cap ? ' <span class="ambar">no caben</span>' : ""}</button>`).join("")}</div>` : `<p class="tenue">Llega alguien sin reservación: dalo de alta desde Alta.</p>`}`;
}

function lineaRecordatorios(r) {
  if (r.estado !== "reservada") return "";
  const env = r.recordatorios.map((x) => `${x.tipo} ✓`).join(" · ") || "Aún no se envían";
  const resp = r.confirmacion === "si" ? `<b class="verde">Confirmó</b>` : `<span class="ambar">Sin respuesta</span>`;
  return `<div class="recordatorio"><span class="tenue">WhatsApp: ${env}</span>${resp}
    <a class="btn chico" href="${waRecordatorio(r)}" target="_blank" rel="noopener">Recordar</a></div>`;
}

// Resumen de lo pedido por la mesa (todas sus comandas juntas).
function resumenPedido(r) {
  const comandas = comandasDe(r);
  if (!comandas.length) return "";
  const pendientes = comandas.filter((c) => c.estado !== "entregada");
  const agrupado = {};
  comandas.flatMap((c) => c.items).forEach((i) => { (agrupado[i.nombre] ??= { cant: 0, total: 0 }); agrupado[i.nombre].cant += i.cant; agrupado[i.nombre].total += i.cant * i.precio; });
  return `<div class="pedido">
    <div class="panel-cab"><h4>Pedido · ${comandas.length} comanda${comandas.length > 1 ? "s" : ""}</h4>${pendientes.length ? `<span class="chip c-ambar">${pendientes.length} en barra/cocina</span>` : `<span class="chip c-verde">Todo entregado</span>`}</div>
    <ul class="pagos">${Object.entries(agrupado).map(([n, x]) => `<li><span>${x.cant}× ${esc(n)}</span><span></span><b>${dinero(x.total)}</b></li>`).join("")}</ul>
  </div>`;
}

function detalleReserva(r) {
  const c = cuenta(r);
  const oc = ocupadas(r.noche, r.id, r.suc);
  const libres = activa(r) ? mesasSuc(r.suc).filter((m) => !oc.has(m.id) && !mesasDe(r).includes(m.id)) : [];
  const paraMover = puede("cualquierMesa") ? libres : libres.filter((m) => m.cap >= r.personas);
  const paraJuntar = libres.filter((m) => puede("cualquierMesa") || m.zona === mesaDe(r.mesa, r.suc)?.zona);
  const minimoMesa = r.mesa ? minimoMesas(mesasDe(r), r.noche) : 0;
  return `<div class="det-cliente">
      <div class="fr-nombre grande">${esc(r.cliente)}</div>
      <div class="fr-meta">${r.personas} personas · llega ${r.hora} · RP ${esc(rpDe(r.rp).nombre)} · <span class="mono cian">${r.codigo}</span></div>
      <div class="fr-chips">${chipEstado(r)}${chipPago(r)}${chipOrigen(r)}${r.ocasion !== "Normal" ? chip([esc(r.ocasion), "c-gris"]) : ""}${r.mesasExtra.length ? chip([`Juntas ${etiquetaMesa(r)}`, "c-cian"]) : ""}</div>
      ${r.nota ? `<p class="nota">${esc(r.nota)}</p>` : ""}
      ${lineaRecordatorios(r)}
      ${resumenCliente(r)}
    </div>
    ${bloqueAnticipo(r)}
    ${vino(r) ? `<div class="cuentas">
      <div><small>Consumo</small><b>${dinero(c)}</b></div>
      <div><small>Pagado</small><b class="cian">${dinero(pagado(r))}</b></div>
      <div><small>Falta</small><b class="${falta(r) ? "rojo" : ""}">${dinero(falta(r))}</b></div>
    </div>
    ${c && minimoMesa > c ? `<p class="nota-ambar chico">Van ${dinero(c)} de un mínimo de ${dinero(minimoMesa)} en esta zona.</p>` : ""}
    ${resumenPedido(r)}` : ""}
    <div class="botones">
      ${r.estado === "reservada" && puede("checkin") ? `<button class="btn primario" data-accion="llego" data-id="${r.id}">Llegó · check-in</button>` : ""}
      ${r.estado === "llego" && puede("ordenar") ? `<button class="btn primario" data-accion="ordenar" data-id="${r.id}">Tomar orden</button>` : ""}
      ${vino(r) && c ? `<button class="btn" data-accion="ver-cuenta" data-id="${r.id}">Ver cuenta</button>` : ""}
      ${vino(r) && falta(r) && puede("cobrar") ? `<button class="btn" data-accion="cobrar" data-id="${r.id}">Cobrar ${dinero(falta(r))}</button>` : ""}
      ${r.estado === "reservada" && r.anticipo && !apartada(r) && puede("cobrar") ? `<button class="btn" data-accion="cobrar" data-id="${r.id}">Registrar anticipo</button>` : ""}
      ${r.estado === "llego" && puede("desocupar") ? `<button class="btn" data-accion="desocupar" data-id="${r.id}">Se fueron · liberar mesa</button>` : ""}
      ${(r.estado === "reservada" || r.estado === "espera") && puede("acomodar") ? `<button class="btn" data-accion="acomodar" data-id="${r.id}">Acomodar en el mapa</button>` : ""}
      <a class="btn" href="${waLink(r)}" target="_blank" rel="noopener">WhatsApp</a>
      ${r.estado === "reservada" && puede("noshow") ? `<button class="btn peligro" data-accion="noshow" data-id="${r.id}">No llegó</button>` : ""}
      ${(r.estado === "reservada" || r.estado === "espera") && puede("cancelar") ? `<button class="btn peligro" data-accion="cancelar" data-id="${r.id}">Cancelar</button>` : ""}
    </div>
    ${paraMover.length && puede("mover") ? `<label class="campo">Mover a otra mesa <select data-accion-cambio="mover" data-id="${r.id}"><option value="">Elegir mesa libre…</option>${paraMover.map((m) => `<option value="${m.id}">${m.id} · ${zonaDe(m.zona).nombre} · ${m.cap}p${m.cap < r.personas ? " (no caben)" : ""}</option>`).join("")}</select></label>` : ""}
    ${activa(r) && paraJuntar.length && puede("juntar") ? `<label class="campo">Juntar con otra mesa <select data-accion-cambio="juntar" data-id="${r.id}"><option value="">Agregar mesa libre…</option>${paraJuntar.map((m) => `<option value="${m.id}">${m.id} · +${m.cap} lugares</option>`).join("")}</select></label>` : ""}
    ${r.mesasExtra.length && activa(r) && puede("juntar") ? `<div class="botones"><button class="btn chico" data-accion="separar" data-id="${r.id}">Separar mesas</button></div>` : ""}`;
}

function resumenCliente(r) {
  const p = perfil(r.tel);
  if (!p || rol() === "mesero") return "";
  return `<button class="resumen-cli" type="button" data-accion="ver-cliente" data-tel="${p.tel}">
    <span class="fr-chips">${etiquetas(p).map(chip).join("")}</span>
    <span class="tenue">${p.visitas} visitas · ${p.noshows} no-shows · ticket ${dinero(p.ticket)}</span>
    ${ROLES[rol()].tabs.includes("clientes") ? `<span class="cian">Historial →</span>` : ""}
  </button>`;
}

function panelConfirmaciones(lista) {
  const porLlegar = lista.filter((r) => r.estado === "reservada");
  if (!porLlegar.length) return "";
  const si = porLlegar.filter((r) => r.confirmacion === "si");
  const sin = porLlegar.filter((r) => r.confirmacion !== "si");
  const cancelaron = lista.filter((r) => r.estado === "cancelada" && r.canceloCliente);
  return `<div class="confirmaciones">
    <div class="panel-cab"><h3>Confirmaciones</h3><span class="tenue chico">WhatsApp automático: día antes 19:00 y 2 h antes</span></div>
    <div class="conf-cuentas"><span><b class="verde">${si.length}</b> confirmaron</span><span><b class="ambar">${sin.length}</b> sin respuesta</span><span><b class="rojo">${cancelaron.length}</b> cancelaron</span></div>
    ${sin.length ? `<div class="lista">${sin.map((r) => `<div class="sin-resp"><span class="mesa-tag z-${mesaDe(r.mesa, r.suc).zona}">${etiquetaMesa(r)}</span><span><b>${esc(r.cliente)}</b><small class="tenue"> ${r.hora} · ${r.recordatorios.map((x) => x.tipo).join(", ") || "sin enviar"}</small></span><a class="btn chico" href="${waRecordatorio(r)}" target="_blank" rel="noopener">Recordar</a></div>`).join("")}</div>` : ""}
  </div>`;
}

function vistaMapa() {
  const todasNoche = deNoche();
  const lista = todasNoche.filter((r) => r.estado !== "cancelada").sort((a, b) => aMin(a.hora) - aMin(b.hora));
  const tardes = lista.filter(tarde);
  const espera = lista.filter((r) => r.estado === "espera");
  const usadas = ocupadas(S.noche).size;
  const limpiar = Object.keys(limpiezaDe());
  const acom = S.acomodando && buscar(S.acomodando);
  const selRes = !S.sel && S.selRes && buscar(S.selRes);
  return `<section class="grid-mapa">
    <div class="panel">
      <div class="panel-cab">
        <h2>${multiSucursal ? esc(sucDe(S.suc).nombre) + " · " : ""}${nocheDe(S.noche).larga}</h2>
        <div class="cab-der">
          <span class="mono tenue">${usadas}/${mesasSuc().length} mesas</span>
          ${puede("escanear") ? `<button class="btn primario" data-accion="escanear">Escanear QR</button>` : ""}
        </div>
      </div>
      ${acom ? `<div class="aviso acomodo"><span>Toca la mesa libre donde va <b>${esc(acom.cliente)}</b> (${acom.personas} personas).${puede("cualquierMesa") ? " Como gerente puedes usar cualquiera." : ""}</span><button class="btn chico" data-accion="acomodar-cancelar">Cancelar</button></div>` : ""}
      <div class="leyenda">
        <span><i class="l-libre"></i>Libre</span><span><i class="l-reservada"></i>Por llegar</span><span><i class="l-tarde"></i>Tarde</span>
        <span><i class="l-enmesa"></i>En mesa</span><span><i class="l-debe"></i>Debe</span><span><i class="l-pagada"></i>Pagada</span><span><i class="l-limpiar"></i>Por limpiar</span><span><b class="verde">✓</b> Confirmó</span>
      </div>
      <div class="plano-caja${acom ? " modo-acomodo" : ""}">${plano({ sel: S.sel })}</div>
      ${limpiar.length ? `<div class="aviso gris"><span>${limpiar.length === 1 ? "La mesa" : "Las mesas"} <b>${limpiar.join(", ")}</b> ${limpiar.length === 1 ? "está" : "están"} por limpiar. Tócala y reactívala cuando esté lista.</span></div>` : ""}
      ${tardes.length && puede("noshow") ? `<div class="aviso"><span>${tardes.length} ${tardes.length === 1 ? "reservación pasó" : "reservaciones pasaron"} la tolerancia de ${S.ajustes.tolerancia} min.</span> <button class="btn peligro" data-accion="liberar-tardes">Liberar no-shows</button></div>` : ""}
    </div>
    <aside class="panel detalle">
      ${S.sel ? detalleMesa(S.sel) : selRes ? `<div class="panel-cab"><h3>${selRes.estado === "espera" ? "Lista de espera" : "Reservación"}</h3><button class="x" data-accion="cerrar-sel" aria-label="Cerrar">×</button></div>${detalleReserva(selRes)}` : `${panelConfirmaciones(todasNoche)}
        <div class="panel-cab"><h3>Llegadas de la noche</h3></div>
        <div class="lista">${lista.filter((r) => r.estado !== "espera").map((r) => filaReserva(r)).join("") || `<p class="tenue">Sin reservaciones.</p>`}</div>
        ${espera.length ? `<h4>Lista de espera</h4><div class="lista">${espera.map((r) => filaReserva(r)).join("")}</div>` : ""}`}
    </aside>
  </section>`;
}

// ---------- vista comandas (barra y cocina) ----------
// La mesa sale de la reservación, no de cuando se pidió: si el gerente los movió, la comanda los sigue.
const mesaComanda = (c) => { const r = buscar(c.reservaId); return r ? etiquetaMesa(r) : c.mesa; };
function tarjetaComanda(c) {
  const min = Math.max(0, aMin(S.hora) - aMin(c.hora));
  const sig = { nueva: ["preparando", "Empezar"], preparando: ["lista", "Lista"], lista: ["entregada", "Entregada"] }[c.estado];
  return `<article class="comanda e-${c.estado}${min >= 15 && c.estado !== "lista" ? " atrasada" : ""}">
    <header><b class="mono">#${c.numero}</b><span class="mesa-tag">${esc(mesaComanda(c))}</span><span class="chip ${c.area === "cocina" ? "c-ambar" : "c-cian"}">${AREAS[c.area]}</span></header>
    <div class="cm-meta tenue">${esc(c.cliente)} · ${esc(c.quien)} · ${c.hora}${c.estado !== "lista" ? ` · <b class="${min >= 15 ? "rojo" : ""}">${min} min</b>` : ""}</div>
    <ul>${c.items.map((i) => `<li><b>${i.cant}×</b> ${esc(i.nombre)}${i.nota ? `<em>${esc(i.nota)}</em>` : ""}</li>`).join("")}</ul>
    <footer>
      ${sig && puede("preparar") ? `<button class="btn ${c.estado === "lista" ? "" : "primario"} chico" data-accion="comanda-avanzar" data-c="${c.id}" data-a="${sig[0]}">${sig[1]}</button>` : ""}
      <button class="btn chico" data-accion="comanda-imprimir" data-c="${c.id}">Imprimir</button>
    </footer>
  </article>`;
}
function vistaComandas() {
  const deHoy = S.comandas.filter((c) => c.noche === S.noche && c.suc === S.suc && c.estado !== "cancelada" && (S.area === "todas" || c.area === S.area));
  const col = (estado, titulo) => {
    const l = deHoy.filter((c) => c.estado === estado).sort((a, b) => a.numero - b.numero);
    return `<div class="col-comandas"><h3>${titulo} <span class="mono tenue">${l.length}</span></h3>${l.map(tarjetaComanda).join("") || `<p class="tenue chico">Nada aquí.</p>`}</div>`;
  };
  const entregadas = deHoy.filter((c) => c.estado === "entregada").length;
  return `<section>
    <div class="panel-cab comandas-cab">
      <div class="segmentos" role="tablist">${[["todas", "Todas"], ["barra", "Barra"], ["cocina", "Cocina"]].map(([k, t]) => `<button role="tab" aria-selected="${S.area === k}" data-accion="area" data-f="${k}">${t}</button>`).join("")}</div>
      <span class="tenue chico">Las comandas llegan solas cuando el mesero envía la orden · ${entregadas} entregadas hoy</span>
    </div>
    <div class="tablero">${col("nueva", "Nuevas")}${col("preparando", "Preparando")}${col("lista", "Listas para llevar")}</div>
  </section>`;
}

// ---------- vista cobranza ----------
function vistaCobranza() {
  const todas = deNoche().filter((r) => r.estado !== "cancelada" && r.estado !== "espera");
  const vinieron = todas.filter(vino);
  const faltan = vinieron.filter((r) => falta(r) > 0).sort((a, b) => (b.estado === "llego") - (a.estado === "llego") || falta(b) - falta(a));
  const pagadas = vinieron.filter((r) => estadoPago(r) === "pagada");
  const sinOrden = vinieron.filter((r) => !cuenta(r));
  const consumo = vinieron.reduce((a, r) => a + cuenta(r), 0);
  const cobrado = todas.reduce((a, r) => a + pagado(r), 0);
  const porCobrar = faltan.reduce((a, r) => a + falta(r), 0);
  const conAnticipo = S.ajustes.anticipo !== "nunca";
  const sinApartar = todas.filter((r) => r.estado === "reservada" && !apartada(r));
  const lista = { faltan, pagadas, sinorden: sinOrden, ligas: sinApartar, todas: [...todas].sort((a, b) => aMin(a.hora) - aMin(b.hora)) }[S.filtro] || faltan;
  const pagosNoche = todas.flatMap((r) => r.pagos.map((p) => ({ p, r })));
  const grupo = (p) => (p.metodo.startsWith("Liga") ? "Liga" : p.metodo);
  const porMetodo = ["Efectivo", "Tarjeta", "Transferencia", "Liga"].map((m) => [m, pagosNoche.filter(({ p }) => grupo(p) === m).reduce((a, { p }) => a + p.monto, 0)]).filter(([m, v]) => v || m !== "Liga");
  const totalPropinas = pagosNoche.reduce((a, { p }) => a + (p.propina || 0), 0);
  const conRPs = RPS_REALES.map((rp) => [rp, efectivoEnMano(rp.id)]).filter(([, l]) => l.length);
  const filtros = [["faltan", `Faltan · ${faltan.length}`], ["pagadas", `Pagaron · ${pagadas.length}`], ["sinorden", `Sin orden · ${sinOrden.length}`], ...(conAnticipo ? [["ligas", `Sin anticipo · ${sinApartar.length}`]] : []), ["todas", "Todas"]];
  return `<section>
    <div class="kpis cinco">
      <div class="kpi"><small>Consumo de la noche</small><b>${dinero(consumo)}</b></div>
      <div class="kpi"><small>Cobrado</small><b class="cian">${dinero(cobrado)}</b></div>
      <div class="kpi"><small>Por cobrar</small><b class="rojo">${dinero(porCobrar)}</b></div>
      <div class="kpi ${faltan.some((r) => r.estado === "llego") ? "alerta" : ""}"><small>Mesas que deben</small><b>${faltan.length}</b></div>
      <div class="kpi"><small>Pagaron</small><b>${pagadas.length}<span class="tenue"> / ${vinieron.length}</span></b></div>
    </div>
    <div class="grid-cobro">
      <div class="panel">
        <div class="segmentos" role="tablist">
          ${filtros.map(([k, t]) => `<button role="tab" aria-selected="${S.filtro === k}" data-accion="filtro" data-f="${k}">${t}</button>`).join("")}
        </div>
        <div class="tabla-cobro">
          <div class="tc-cab"><span>Mesa</span><span>Cliente</span><span>Estado</span><span class="der">Consumo</span><span class="der">Pagado</span><span class="der">Falta</span><span>Último pago</span><span></span></div>
          ${lista.map((r) => {
            const up = r.pagos.at(-1);
            const m = r.mesa || (r.mesaOriginal || "").split("+")[0];
            return `<div class="tc-fila ${r.estado === "llego" && falta(r) ? "urgente" : ""}">
              <span><span class="mesa-tag ${m ? "z-" + mesaDe(m, r.suc).zona : "z-none"}">${etiquetaMesa(r)}</span></span>
              <span class="tc-cli"><b>${esc(r.cliente)}</b><small>${r.hora} · ${esc(rpDe(r.rp).nombre)} · ${comandasDe(r).length} comanda(s)</small></span>
              <span class="fr-chips">${chipEstado(r)}${chipPago(r)}</span>
              <span class="der mono" data-l="Consumo">${dinero(cuenta(r))}</span>
              <span class="der mono cian" data-l="Pagado">${dinero(pagado(r))}</span>
              <span class="der mono ${falta(r) ? "rojo" : "tenue"}" data-l="Falta">${dinero(falta(r))}</span>
              <span class="tenue" data-l="Último">${up ? `${up.hora} · ${up.metodo}` : "—"}</span>
              <span class="der acciones-fila">${cuenta(r) ? `<button class="btn chico" data-accion="ver-cuenta" data-id="${r.id}">Cuenta</button>` : ""}${falta(r) && puede("cobrar") ? `<button class="btn chico primario" data-accion="cobrar" data-id="${r.id}">Cobrar</button>` : ""}${r.estado === "reservada" && !apartada(r) ? `<a class="btn chico" href="${waLink(r)}" target="_blank" rel="noopener">Liga</a>` : ""}</span>
            </div>`;
          }).join("") || `<p class="tenue vacio-tabla">${S.filtro === "faltan" ? `Nadie debe nada. ${MARCA.emoji}` : "Sin registros."}</p>`}
        </div>
      </div>
      <aside class="col">
        <div class="panel">
          <div class="panel-cab"><h3>Corte por método</h3><span class="tenue chico">${nocheDe(S.noche).corta}</span></div>
          ${porMetodo.map(([m, v]) => `<div class="metodo-fila"><span>${m === "Liga" ? "Liga de pago" : m}</span><b class="mono">${dinero(v)}</b></div>`).join("")}
          <div class="metodo-fila"><span>Propinas <small class="tenue">aparte</small></span><b class="mono verde">${dinero(totalPropinas)}</b></div>
        </div>
        ${panelTerminales(pagosNoche.map(({ p }) => p))}
        ${conRPs.length || conAnticipo ? `<div class="panel">
          <div class="panel-cab"><h3>Efectivo con RPs</h3><span class="tenue chico">anticipos sin entregar</span></div>
          ${conRPs.length ? conRPs.map(([rp, l]) => `<div class="metodo-fila"><span><b>${esc(rp.nombre)}</b> <small class="tenue">${l.length} pago(s)</small></span><b class="mono ambar">${dinero(l.reduce((a, x) => a + x.p.monto, 0))}</b>${puede("caja") ? `<button class="btn chico" data-accion="recibir-caja" data-rp="${rp.id}">Recibido en caja</button>` : ""}</div>`).join("") : `<p class="tenue">Ningún RP trae efectivo pendiente.</p>`}
        </div>` : ""}
      </aside>
    </div>
  </section>`;
}

// ---------- vista menú (catálogo) ----------
function vistaMenu() {
  const cats = [...new Set(S.menu.map((p) => p.categoria))];
  return `<section>
    <div class="panel">
      <div class="panel-cab"><h2>Menú</h2><span class="chip c-ambar">Precios de ejemplo</span></div>
      <p class="tenue">Lo que aparece aquí es lo que el mesero puede pedir. Cada producto va a <b>barra</b> o <b>cocina</b> y su comanda llega sola a esa pantalla.</p>
      <div class="botones">
        <label class="btn primario">Cargar menú (CSV)<input type="file" accept=".csv,text/csv" data-cargar-menu hidden></label>
        <button class="btn" data-accion="menu-csv">Descargar menú en CSV</button>
        <button class="btn" data-accion="menu-agregar">Agregar producto</button>
      </div>
      <p class="tenue chico">El CSV lleva columnas <span class="mono">nombre, categoria, precio, area</span> (area = barra o cocina). Sale directo de Excel o del punto de venta.</p>
    </div>
    ${cats.map((cat) => `<div class="panel">
      <div class="panel-cab"><h3>${esc(cat)}</h3><span class="mono tenue">${S.menu.filter((p) => p.categoria === cat).length}</span></div>
      <div class="menu-tabla">
        ${S.menu.filter((p) => p.categoria === cat).map((p) => `<div class="menu-fila${p.inactivo ? " inactivo" : ""}">
          <input aria-label="Nombre" value="${esc(p.nombre)}" data-menu="${p.id}" data-campo="nombre">
          <input aria-label="Categoría" value="${esc(p.categoria)}" data-menu="${p.id}" data-campo="categoria">
          <select aria-label="Área" data-menu="${p.id}" data-campo="area">${opciones([["barra", "Barra"], ["cocina", "Cocina"]], p.area)}</select>
          <input aria-label="Precio" type="number" min="0" step="5" value="${p.precio}" data-menu="${p.id}" data-campo="precio">
          <label class="switch"><input type="checkbox" ${p.inactivo ? "" : "checked"} data-menu="${p.id}" data-campo="activo"><span>Activo</span></label>
          <button class="x" data-accion="menu-borrar" data-id="${p.id}" aria-label="Borrar ${esc(p.nombre)}">×</button>
        </div>`).join("")}
      </div>
    </div>`).join("")}
  </section>`;
}
function csvACampos(linea) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (q) { if (ch === '"' && linea[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === "," || ch === ";") { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}
function cargarMenuCSV(texto) {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const cab = csvACampos(lineas.shift()).map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
  const idx = (n) => cab.indexOf(n);
  if (idx("nombre") < 0 || idx("precio") < 0) return toast("El CSV necesita al menos las columnas <b>nombre</b> y <b>precio</b>.");
  const nuevos = lineas.map((l) => csvACampos(l)).filter((f) => f[idx("nombre")]).map((f, i) => ({
    id: "p" + Date.now().toString(36) + i,
    nombre: f[idx("nombre")],
    categoria: (idx("categoria") >= 0 && f[idx("categoria")]) || "General",
    precio: Number(String(f[idx("precio")]).replace(/[$,\s]/g, "")) || 0,
    area: idx("area") >= 0 && /cocina/i.test(f[idx("area")]) ? "cocina" : "barra",
  }));
  if (!nuevos.length) return toast("No encontré productos en el archivo.");
  if (!confirm(`¿Reemplazar el menú actual por ${nuevos.length} productos del archivo?`)) return;
  S.menu = nuevos;
  toast(`Menú cargado: <b>${nuevos.length}</b> productos`);
  render();
}
function descargar(nombre, texto, tipo = "text/csv") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + texto], { type: tipo }));
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}
const filaCSV = (f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");

// ---------- vista gerente ----------
function vistaGerente() {
  const n = deNoche().filter((r) => r.estado !== "cancelada");
  const act = n.filter((r) => activa(r) || r.estado === "cerrada");
  const cobrado = n.reduce((a, r) => a + pagado(r), 0);
  const consumo = n.reduce((a, r) => a + cuenta(r), 0);
  const noshows = n.filter((r) => r.estado === "noshow").length;
  const ocup = Math.round((ocupadas(S.noche).size / mesasSuc().length) * 100);
  const porZona = ZONAS.map((z) => {
    const total = mesasSuc().filter((m) => m.zona === z.id).length;
    const usadas = mesasSuc().filter((m) => m.zona === z.id && reservaEnMesa(m.id)).length;
    return { z, total, usadas };
  }).filter((x) => x.total);
  const ranking = RPS.map((rp) => {
    const suyas = n.filter((r) => r.rp === rp.id && r.estado !== "espera");
    const cob = suyas.reduce((a, r) => a + pagado(r), 0);
    return { rp, total: suyas.length, llegaron: suyas.filter(vino).length, cob, cons: suyas.reduce((a, r) => a + cuenta(r), 0), liga: suyas.filter((r) => r.origen === "liga").length };
  }).filter((x) => !x.rp.casa || x.total).sort((a, b) => b.cob - a.cob || b.total - a.total);
  const vendidos = {};
  S.comandas.filter((c) => c.noche === S.noche && c.suc === S.suc && c.estado !== "cancelada").flatMap((c) => c.items).forEach((i) => { (vendidos[i.nombre] ??= { cant: 0, total: 0 }); vendidos[i.nombre].cant += i.cant; vendidos[i.nombre].total += i.cant * i.precio; });
  const top = Object.entries(vendidos).sort((a, b) => b[1].total - a[1].total).slice(0, 6);
  const campo = (nombre, etiqueta, valor, extra = "") => `<label class="campo">${etiqueta}<input type="number" min="0" name="${nombre}" value="${valor}" ${extra}></label>`;
  return `<section class="grid-gerente">
    ${multiSucursal ? panelTodas() : ""}
    ${multiSucursal ? `<h3 class="titulo-suc">${esc(sucDe(S.suc).nombre)} · ${nocheDe(S.noche).corta}</h3>` : ""}
    <div class="kpis seis">
      <div class="kpi"><small>Reservaciones</small><b>${act.length}</b></div>
      <div class="kpi"><small>Personas</small><b>${act.reduce((a, r) => a + r.personas, 0)}</b></div>
      <div class="kpi"><small>Ocupación</small><b>${ocup}%</b></div>
      <div class="kpi"><small>Consumo</small><b>${dinero(consumo)}</b></div>
      <div class="kpi"><small>Cobrado</small><b class="cian">${dinero(cobrado)}</b></div>
      <div class="kpi"><small>No-shows</small><b class="${noshows ? "rojo" : ""}">${noshows}</b></div>
    </div>
    <div class="grid-cobro">
      <div class="panel">
        <div class="panel-cab"><h3>Ranking de RPs · ${nocheDe(S.noche).corta}</h3><span class="tenue">comisión ${S.ajustes.comision}% de lo cobrado</span></div>
        <div class="tabla-rp">
          <div class="tr-cab"><span>#</span><span>RP</span><span class="der">Reservas</span><span class="der">Llegaron</span><span class="der">Consumo</span><span class="der">Cobrado</span><span class="der">Comisión</span></div>
          ${ranking.map((x, i) => `<div class="tr-fila"><span class="mono tenue">${i + 1}</span><span><b>${esc(x.rp.nombre)}</b>${x.liga ? ` <small class="cian">${x.liga} por liga</small>` : ""}</span><span class="der mono" data-l="Reservas">${x.total}</span><span class="der mono" data-l="Llegaron">${x.llegaron}${x.total ? ` <small class="tenue">${Math.round((x.llegaron / x.total) * 100)}%</small>` : ""}</span><span class="der mono" data-l="Consumo">${dinero(x.cons)}</span><span class="der mono cian" data-l="Cobrado">${dinero(x.cob)}</span><span class="der mono" data-l="Comisión">${x.rp.casa ? "—" : dinero((x.cob * S.ajustes.comision) / 100)}</span></div>`).join("")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-cab"><h3>Lo más pedido hoy</h3></div>
        ${top.map(([nombre, x]) => `<div class="metodo-fila"><span>${x.cant}× ${esc(nombre)}</span><b class="mono">${dinero(x.total)}</b></div>`).join("") || `<p class="tenue">Aún no hay comandas.</p>`}
      </div>
    </div>
    <div class="panel">
      <div class="panel-cab"><h3>Ocupación por zona</h3></div>
      ${porZona.map(({ z, total, usadas }) => `<div class="barra-z"><span>${z.nombre}</span><div class="bz-pista"><div class="bz-lleno z-${z.id}" style="width:${(usadas / total) * 100}%"></div></div><span class="mono">${usadas}/${total}</span></div>`).join("")}
    </div>
    <div class="panel">
      <div class="panel-cab"><h3>Preventa de eventos</h3></div>
      ${NOCHES.filter((x) => x.evento).map((x) => { const v = S.reservas.filter((r) => r.noche === x.fecha && r.suc === S.suc && activa(r)); return `<div class="metodo-fila"><span><b>${x.corta}</b> · ${esc(x.evento)} <small class="tenue">${v.length}/${mesasSuc().length} mesas apartadas</small></span><a class="btn chico" href="${ligaSucursal(S.suc, "noche=" + x.fecha)}" target="_blank" rel="noopener">Abrir preventa</a></div>`; }).join("")}
      <p class="tenue chico">Página pública donde el cliente escoge su mesa. Cada RP comparte su liga y la reservación queda a su nombre.</p>
    </div>
    <form class="panel" id="form-ajustes">
      <div class="panel-cab"><h3>Ajustes</h3><span class="chip c-ambar">Ejemplo · por confirmar</span></div>
      <div class="campos">
        ${ZONAS.map((z) => campo("min-" + z.id, "Consumo mín. " + z.nombre, S.ajustes.minimos[z.id], 'step="100"')).join("")}
        ${campo("factorEvento", "Mínimos en evento (×)", S.ajustes.factorEvento, 'step="0.1"')}
        ${campo("tolerancia", "Tolerancia (min)", S.ajustes.tolerancia, 'step="5"')}
        ${campo("comision", "Comisión RP (%)", S.ajustes.comision, 'max="100" step="0.5"')}
        ${campo("metaSemanal", "Meta semanal por RP", S.ajustes.metaSemanal, 'step="1"')}
        <label class="campo">Anticipo para apartar<select name="anticipo">${opciones([["nunca", "No se pide"], ["riesgo", "Sólo a quien ha dejado plantado"], ["siempre", "Siempre"]], S.ajustes.anticipo)}</select></label>
        ${campo("anticipoPct", "Anticipo (% del mínimo)", S.ajustes.anticipoPct, 'max="100" step="5"')}
      </div>
      <p class="tenue chico">El consumo mínimo ya no decide la mesa: sólo avisa al mesero si la mesa no ha llegado al mínimo de su zona.</p>
      <div class="botones">
        <button class="btn primario" type="submit">Guardar ajustes</button>
        <button class="btn" type="button" data-accion="csv">Descargar corte de la noche</button>
        <button class="btn peligro" type="button" data-accion="reiniciar">Reiniciar demo</button>
      </div>
    </form>
  </section>`;
}

// ---------- vista clientes ----------
const FILTROS_CLI = [["todos", "Todos"], ["frecuentes", "Frecuentes"], ["vip", "VIP"], ["riesgo", "No-shows"]];
function clientesFiltrados() {
  const q = S.cliBusca.trim().toLowerCase();
  const qTel = telKey(q);
  return clientes()
    .filter((p) => ({ todos: true, frecuentes: p.visitas >= 3, vip: p.gasto >= 30000, riesgo: p.noshows > 0 })[S.cliFiltro])
    .filter((p) => !q || p.cliente.toLowerCase().includes(q) || (qTel.length >= 3 && p.tel.includes(qTel)))
    .sort((a, b) => S.cliFiltro === "riesgo" ? b.noshows - a.noshows || b.gasto - a.gasto : b.gasto - a.gasto || b.visitas - a.visitas);
}
function listaClientes() {
  return clientesFiltrados().map((p) => `<button class="fila-cli${S.cliSel === p.tel ? " sel" : ""}" type="button" data-accion="cli-sel" data-tel="${p.tel}">
      <span class="fc-nombre"><b>${esc(p.cliente)}</b><small class="mono tenue">${esc(p.telVisible)}</small></span>
      <span class="fr-chips">${etiquetas(p).map(chip).join("")}</span>
      <span class="fc-num mono" data-l="Visitas">${p.visitas}</span>
      <span class="fc-num mono ${p.noshows ? "rojo" : "tenue"}" data-l="No-shows">${p.noshows}</span>
      <span class="fc-num mono cian" data-l="Gasto">${dinero(p.gasto)}</span>
    </button>`).join("") || `<p class="tenue vacio-tabla">Nadie con ese filtro.</p>`;
}
function detalleCliente(p) {
  if (!p) return `<div class="vacio"><img src="${MARCA.logoTenue || "img/logo-blanco.png"}" alt=""><p>Elige un cliente para ver su historial.</p></div>`;
  const ESTADO_H = { llego: ["Llegó", "c-verde"], noshow: ["No llegó", "c-rojo"], cancelada: ["Canceló", "c-gris"] };
  return `<div class="panel-cab"><h3>${esc(p.cliente)}</h3><button class="x" data-accion="cli-cerrar" aria-label="Cerrar">×</button></div>
    <div class="fr-meta mono">${esc(p.telVisible)}</div>
    <div class="fr-chips" style="margin:10px 0 14px">${etiquetas(p).map(chip).join("")}</div>
    <div class="cuentas cuatro">
      <div><small>Visitas</small><b>${p.visitas}</b></div>
      <div><small>No-shows</small><b class="${p.noshows ? "rojo" : ""}">${p.noshows}</b></div>
      <div><small>Gasto total</small><b class="cian">${dinero(p.gasto)}</b></div>
      <div><small>Ticket prom.</small><b>${dinero(p.ticket)}</b></div>
    </div>
    ${p.proximas.length ? `<h4>Próximas</h4><div class="lista">${p.proximas.map((r) => filaReserva(r)).join("")}</div>` : ""}
    <h4>Historial</h4>
    <ol class="historial">${p.regs.map((x) => `<li><span class="mono tenue">${fechaCorta(x.noche)}</span>${chip(ESTADO_H[x.estado])}<span class="tenue">${esc(rpDe(x.rp).nombre)}${x.ocasion && x.ocasion !== "Normal" ? " · " + esc(x.ocasion) : ""}</span><b class="mono">${x.consumo ? dinero(x.consumo) : "—"}</b></li>`).join("") || `<li class="tenue">Sin visitas todavía.</li>`}</ol>
    <div class="botones">
      ${ROLES[rol()].tabs.includes("rp") ? `<button class="btn primario" data-accion="nueva-para" data-tel="${p.tel}">Nueva reservación</button>` : ""}
      <a class="btn" href="https://wa.me/52${p.tel}" target="_blank" rel="noopener">WhatsApp</a>
    </div>`;
}
function vistaClientes() {
  const todos = clientes();
  return `<section>
    <div class="kpis">
      <div class="kpi"><small>Clientes</small><b>${todos.length}</b></div>
      <div class="kpi"><small>Frecuentes (3+)</small><b class="verde">${todos.filter((p) => p.visitas >= 3).length}</b></div>
      <div class="kpi"><small>Con no-shows</small><b class="rojo">${todos.filter((p) => p.noshows > 0).length}</b></div>
      <div class="kpi"><small>Ticket promedio</small><b class="cian">${dinero(todos.filter((p) => p.visitas).reduce((a, p) => a + p.ticket, 0) / (todos.filter((p) => p.visitas).length || 1))}</b></div>
    </div>
    <div class="grid-mapa">
      <div class="panel">
        <div class="busca-fila">
          <input type="search" placeholder="Buscar por nombre o WhatsApp" value="${esc(S.cliBusca)}" data-buscar aria-label="Buscar cliente">
          <div class="segmentos" role="tablist">${FILTROS_CLI.map(([k, t]) => `<button role="tab" aria-selected="${S.cliFiltro === k}" data-accion="cli-filtro" data-f="${k}">${t}</button>`).join("")}</div>
        </div>
        <div class="fc-cab"><span>Cliente</span><span></span><span class="der">Visitas</span><span class="der">No-shows</span><span class="der">Gasto</span></div>
        <div id="lista-clientes">${listaClientes()}</div>
      </div>
      <aside class="panel detalle">${detalleCliente(S.cliSel && perfil(S.cliSel))}</aside>
    </div>
  </section>`;
}

// ---------- diálogos ----------
function dialogo(html, clase = "") {
  const d = $("#dlg");
  if (d.open) d.close();
  d.className = clase;
  d.innerHTML = html;
  d.showModal();
  const primero = d.querySelector("input:not([type=radio]):not([type=hidden]), select");
  if (primero && !clase) primero.focus();
}

function dlgRol() {
  dialogo(`<form method="dialog" id="form-rol">
    <h3>Entrar como</h3>
    <p class="tenue">En el sistema real cada quien entra con su teléfono y PIN, y sólo ve lo suyo.</p>
    <div class="roles">
      ${Object.entries(ROLES).map(([k, v]) => `<label class="rol-op"><input type="radio" name="rol" value="${k}"${rol() === k ? " checked" : ""}><span><b>${v.nombre}</b><small>${v.desc}</small></span></label>`).join("")}
    </div>
    <label class="campo">¿Qué RP? <select name="rp">${opciones(RPS_REALES.map((r) => [r.id, r.nombre]), S.sesion.rp)}</select></label>
    ${multiSucursal ? `<label class="campo">Sucursal (hostess, mesero y barra) <select name="suc">${opciones(SUCURSALES.map((x) => [x.id, x.nombre]), S.sesion.suc || S.suc)}</select></label>` : ""}
    <div class="botones fin"><button class="btn" value="cancel" formnovalidate>Cancelar</button><button class="btn primario" value="ok">Entrar</button></div>
  </form>`);
}

// Cobro: por defecto lo que falta de la cuenta; la propina va aparte y no cuenta para la mesa.
function dlgCobrar(r, soloEfectivo = false) {
  const esAnticipo = r.estado === "reservada";
  const monto = esAnticipo ? Math.max(0, r.anticipo - pagadoAnticipo(r)) : falta(r);
  const metodoInicial = soloEfectivo || r.efectivoPendiente ? "Efectivo" : esAnticipo ? "Transferencia" : "Tarjeta";
  dialogo(`<form method="dialog" id="form-pago" data-id="${r.id}">
    <h3>${soloEfectivo ? "Recibí efectivo" : esAnticipo ? "Registrar anticipo" : "Cobrar"} · ${esc(r.cliente)}</h3>
    <p class="tenue">Mesa ${etiquetaMesa(r)}${esAnticipo ? "" : ` · consumo ${dinero(cuenta(r))} · pagado ${dinero(pagado(r))}`}</p>
    <input type="hidden" name="tipo" value="${esAnticipo ? "Anticipo" : "Cuenta"}">
    <div class="campos">
      <label class="campo">Monto<input name="monto" type="number" min="1" step="1" value="${monto}" required data-monto></label>
      ${esAnticipo ? "" : `<label class="campo">Propina<input name="propina" type="number" min="0" step="1" value="0" data-propina></label>`}
    </div>
    ${esAnticipo ? "" : `<div class="propinas">${[0, 10, 15, 20].map((p) => `<button type="button" class="btn chico" data-pct="${p}">${p ? p + "%" : "Sin propina"}</button>`).join("")}</div>`}
    <div class="metodos">${(soloEfectivo ? ["Efectivo"] : METODOS).map((m) => `<label><input type="radio" name="metodo" value="${m}"${m === metodoInicial ? " checked" : ""}><span>${m}</span></label>`).join("")}</div>
    ${esAnticipo || soloEfectivo ? "" : `<div class="solo-tarjeta">
      <div class="a-terminal">
        <label class="campo">Terminal <select name="terminal">${opciones(terminalesDe(r.suc).map((t) => [t.id, t.nombre]), S.ultimaTerminal)}</select></label>
        <button type="button" class="btn primario" data-accion="a-terminal" data-id="${r.id}">Mandar a la terminal</button>
      </div>
      <p class="tenue chico">El cliente escoge propina y paga en la terminal; el pago se registra solo, con su folio. Si la terminal no está conectada, llena el folio y guarda a mano.</p>
      <label class="campo">Folio o últimos 4 dígitos (a mano)<input name="folio" inputmode="numeric" placeholder="Del ticket de la terminal"></label>
    </div>`}
    <p class="tenue chico">Lo recibe: <b>${esc(nombreQuien(quienSoy()))}</b>${rol() === "rp" ? ". Queda pendiente de entregar en caja." : ""}</p>
    <div class="botones fin"><button class="btn" value="cancel" formnovalidate>Cancelar</button><button class="btn primario" value="ok">Guardar pago</button></div>
  </form>`);
}

function ticketHTML(r) {
  const filas = comandasDe(r).flatMap((c) => c.items);
  const agrupado = {};
  filas.forEach((i) => { const k = i.nombre + "|" + i.precio; (agrupado[k] ??= { ...i, cant: 0 }); agrupado[k].cant += i.cant; });
  return { items: Object.values(agrupado), total: cuenta(r) };
}
function dlgCuenta(r) {
  const { items, total } = ticketHTML(r);
  const minimoMesa = minimoMesas(mesasDe(r).length ? mesasDe(r) : (r.mesaOriginal || "").split("+").filter(Boolean), r.noche);
  dialogo(`<form method="dialog" class="cuenta-dlg">
    <h3>Cuenta · mesa ${etiquetaMesa(r)}</h3>
    <p class="tenue">${esc(r.cliente)} · ${r.personas} personas · ${comandasDe(r).length} comanda(s)</p>
    <ul class="ticket">${items.map((i) => `<li><span>${i.cant}× ${esc(i.nombre)}</span><b class="mono">${dinero(i.cant * i.precio)}</b></li>`).join("")}</ul>
    <div class="ticket-total"><span>Consumo</span><b class="mono">${dinero(total)}</b></div>
    ${minimoMesa > total ? `<p class="nota-ambar chico">No llegan al consumo mínimo de la zona (${dinero(minimoMesa)}): faltan ${dinero(minimoMesa - total)}.</p>` : ""}
    ${r.pagos.length ? `<ul class="pagos">${r.pagos.map((p) => `<li><span>${detallePago(p)}</span><span class="mono">${p.hora}</span><b>${dinero(p.monto)}</b></li>`).join("")}</ul>` : ""}
    <div class="ticket-total"><span>Falta</span><b class="mono ${falta(r) ? "rojo" : "cian"}">${dinero(falta(r))}</b></div>
    <div class="botones fin">
      <button class="btn" type="button" data-accion="imprimir-cuenta" data-id="${r.id}">Imprimir cuenta</button>
      ${falta(r) && puede("cobrar") ? `<button class="btn primario" type="button" data-accion="cobrar" data-id="${r.id}">Cobrar ${dinero(falta(r))}</button>` : ""}
      <button class="btn" value="cancel" formnovalidate>Cerrar</button>
    </div>
  </form>`);
}

// ---------- tomar orden (mesero) ----------
const orden = { rid: null, items: [], cat: null };
function dlgOrden(r) {
  orden.rid = r.id;
  orden.items = [];
  orden.cat = orden.cat || [...new Set(S.menu.filter((p) => !p.inactivo).map((p) => p.categoria))][0];
  dialogo(`<form method="dialog" id="form-orden" class="orden">
    <div class="panel-cab"><h3>Orden · mesa ${etiquetaMesa(r)}</h3><span class="tenue">${esc(r.cliente)} · ${r.personas} pers</span></div>
    <div class="orden-cuerpo">
      <div class="orden-menu"><div class="cats" id="orden-cats"></div><div class="productos" id="orden-productos"></div></div>
      <div class="orden-lista"><h4>Esta comanda</h4><div id="orden-items"></div></div>
    </div>
    <div class="botones fin"><button class="btn" value="cancel" formnovalidate>Cancelar</button><button class="btn primario" value="ok" id="orden-enviar">Enviar comanda</button></div>
  </form>`, "grande");
  pintarOrden();
}
function pintarOrden() {
  const activos = S.menu.filter((p) => !p.inactivo);
  const cats = [...new Set(activos.map((p) => p.categoria))];
  if (!cats.includes(orden.cat)) orden.cat = cats[0];
  $("#orden-cats").innerHTML = cats.map((c) => `<button type="button" class="noche${c === orden.cat ? " activa" : ""}" data-orden-cat="${esc(c)}">${esc(c)}</button>`).join("");
  $("#orden-productos").innerHTML = activos.filter((p) => p.categoria === orden.cat).map((p) => {
    const en = orden.items.find((i) => i.id === p.id);
    return `<button type="button" class="producto${en ? " en" : ""}" data-orden-add="${p.id}"><span>${esc(p.nombre)}</span><b class="mono">${dinero(p.precio)}</b>${en ? `<i>${en.cant}</i>` : ""}<small>${AREAS[p.area]}</small></button>`;
  }).join("");
  const total = orden.items.reduce((a, i) => a + productoDe(i.id).precio * i.cant, 0);
  $("#orden-items").innerHTML = orden.items.length ? orden.items.map((i) => `<div class="orden-item">
      <div class="oi-fila"><span>${esc(productoDe(i.id).nombre)}</span><div class="cant"><button type="button" data-orden-menos="${i.id}" aria-label="Quitar uno">−</button><b>${i.cant}</b><button type="button" data-orden-add="${i.id}" aria-label="Agregar uno">+</button></div></div>
      <input placeholder="Nota (sin hielo, bien dorado…)" value="${esc(i.nota)}" data-orden-nota="${i.id}">
    </div>`).join("") + `<div class="ticket-total"><span>Total</span><b class="mono">${dinero(total)}</b></div>`
    : `<p class="tenue">Toca productos para agregarlos.</p>`;
  $("#orden-enviar").disabled = !orden.items.length;
}

// ---------- terminales de tarjeta ----------
// Con una terminal conectada (p. ej. Mercado Pago Point por su API) el sistema le manda el monto, el
// cliente escoge propina y paga ahí, y la respuesta (aprobada, folio, últimos 4) llega sola. En el demo
// la terminal se simula en pantalla. Cada sucursal puede declarar sus terminales en datos.js.
function detallePago(p) {
  let via = "";
  if (p.via === "terminal") via = ` · ${esc(p.terminal)} · ****${p.ultimos4} · aut. ${p.aut}`;
  else if (p.metodo === "Tarjeta") via = p.folio ? ` · a mano · folio ${esc(p.folio)}` : " · a mano, sin folio";
  return `${p.tipo} · ${p.metodo}${via}${p.propina ? ` · propina ${dinero(p.propina)}` : ""}`;
}
function panelTerminales(pagos) {
  const tarjeta = pagos.filter((p) => p.metodo === "Tarjeta");
  const porTerminal = terminalesDe(S.suc).map((t) => {
    const l = tarjeta.filter((p) => p.via === "terminal" && p.terminal === t.nombre);
    return [t.nombre, l.length, l.reduce((a, p) => a + p.monto + (p.propina || 0), 0)];
  });
  const mano = tarjeta.filter((p) => p.via !== "terminal");
  const sinFolio = mano.filter((p) => !p.folio).length;
  return `<div class="panel">
    <div class="panel-cab"><h3>Terminales</h3><span class="tenue chico">con propina</span></div>
    ${porTerminal.map(([n, k, v]) => `<div class="metodo-fila"><span>${esc(n)} <small class="tenue">${k} cobro(s)</small></span><b class="mono">${dinero(v)}</b></div>`).join("")}
    <div class="metodo-fila"><span>Tarjeta a mano <small class="tenue">${mano.length} cobro(s)</small></span><b class="mono">${dinero(mano.reduce((a, p) => a + p.monto + (p.propina || 0), 0))}</b></div>
    ${sinFolio ? `<p class="nota-ambar chico">${sinFolio} cobro(s) con tarjeta sin folio: revísalos contra el corte de la terminal.</p>` : `<p class="tenue chico">Lo de las terminales ya viene con folio: el corte cuadra solo.</p>`}
  </div>`;
}
const cobroTerm = { rid: null, monto: 0, terminal: null, propina: 0, paso: "propina" };
function dlgTerminal(r, monto, terminalId) {
  const t = terminalesDe(r.suc).find((x) => x.id === terminalId) || terminalesDe(r.suc)[0];
  Object.assign(cobroTerm, { rid: r.id, monto, terminal: t, propina: 0, paso: "propina" });
  S.ultimaTerminal = t.id;
  dialogo(`<form method="dialog" class="terminal-dlg">
    <div class="panel-cab"><h3>📡 Enviado a ${esc(t.nombre)}</h3><span class="chip c-ambar">Simulación</span></div>
    <p class="tenue">Mesa ${etiquetaMesa(r)} · ${esc(r.cliente)}. Esto pasa en la terminal, en manos del cliente.</p>
    <div class="dispositivo"><div class="pantalla" id="pantalla"></div><div class="lector"></div></div>
    <div class="botones fin"><button type="button" class="btn" data-term="cancelar">Cancelar cobro</button></div>
  </form>`, "terminal");
  pintarTerminal();
}
function pintarTerminal() {
  const { monto, propina, paso } = cobroTerm;
  const total = monto + propina;
  const pct = (p) => Math.round((monto * p) / 100);
  const pantallas = {
    propina: `<small>${esc(MARCA.nombre)}</small><b class="t-monto">${dinero(monto)}</b><p>¿Agregar propina?</p>
      <div class="t-props">${[0, 10, 15, 20].map((p) => `<button type="button" data-term="propina" data-tpct="${p}">${p ? `${p}%<small>${dinero(pct(p))}</small>` : "Sin propina"}</button>`).join("")}</div>`,
    tarjeta: `<small>Total</small><b class="t-monto">${dinero(total)}</b>${propina ? `<small>incluye propina ${dinero(propina)}</small>` : ""}
      <div class="t-tarjeta">💳</div><p>Acerca, inserta o desliza tu tarjeta</p>
      <div class="t-sim"><button type="button" data-term="aprobar">Simular: aprobada</button><button type="button" data-term="rechazar">Simular: rechazada</button></div>`,
    procesando: `<div class="t-giro"></div><p>Procesando…</p>`,
    aprobada: `<div class="t-ok">✓</div><b>Aprobada</b><p class="mono">****${cobroTerm.ultimos4} · aut. ${cobroTerm.aut}</p><b class="t-monto chico">${dinero(total)}</b>
      <button type="button" class="t-listo" data-term="listo">Listo</button>`,
    rechazada: `<div class="t-mal">✕</div><b>Rechazada</b><p>Fondos insuficientes</p>
      <div class="t-sim"><button type="button" data-term="otra">Otra tarjeta</button><button type="button" data-term="otro-metodo">Cobrar de otra forma</button></div>`,
  };
  $("#pantalla").innerHTML = pantallas[paso];
}
function accionTerminal(accion, boton) {
  const r = buscar(cobroTerm.rid);
  if (accion === "propina") { cobroTerm.propina = Math.round((cobroTerm.monto * Number(boton.dataset.tpct)) / 100); cobroTerm.paso = "tarjeta"; }
  if (accion === "otra") cobroTerm.paso = "tarjeta";
  if (accion === "aprobar" || accion === "rechazar") {
    cobroTerm.paso = "procesando";
    setTimeout(() => {
      if (accion === "rechazar") cobroTerm.paso = "rechazada";
      else { cobroTerm.paso = "aprobada"; cobroTerm.aut = String(100000 + Math.floor(Math.random() * 899999)); cobroTerm.ultimos4 = String(1000 + Math.floor(Math.random() * 8999)); }
      if ($("#pantalla")) pintarTerminal();
    }, 1100);
  }
  if (accion === "listo") {
    r.pagos.push({ monto: cobroTerm.monto, metodo: "Tarjeta", tipo: "Cuenta", hora: S.hora, recibio: quienSoy(), via: "terminal", terminal: cobroTerm.terminal.nombre, aut: cobroTerm.aut, ultimos4: cobroTerm.ultimos4, ...(cobroTerm.propina ? { propina: cobroTerm.propina } : {}) });
    toast(`💳 ${esc(cobroTerm.terminal.nombre)}: mesa ${etiquetaMesa(r)} ${estadoPago(r) === "pagada" ? "<b>pagada</b> ✓" : `abonó ${dinero(cobroTerm.monto)}`}${cobroTerm.propina ? ` · propina ${dinero(cobroTerm.propina)}` : ""}`);
    return render();
  }
  if (accion === "cancelar") { $("#dlg").close(); return toast("Cobro cancelado en la terminal"); }
  if (accion === "otro-metodo") return dlgCobrar(r);
  pintarTerminal();
}

// ---------- check-in con QR ----------
// Lee el QR del pase del cliente con la cámara (jsQR) o con el código escrito a mano.
const escaner = { stream: null, raf: 0, pausa: false };
function dlgEscanear() {
  dialogo(`<form method="dialog" id="form-escaner" class="escaner">
    <h3>Check-in con QR</h3>
    <div class="camara"><video playsinline muted></video><div class="mira"></div><p class="cam-msg tenue">Abriendo cámara…</p></div>
    <div id="resultado-qr" class="resultado-qr"></div>
    <label class="campo">O escribe el código<input name="codigo" placeholder="${MARCA.prefijo}-XXXX" autocapitalize="characters"></label>
    <div class="botones fin"><button class="btn" value="cancel" formnovalidate>Cerrar</button><button class="btn primario" value="ok">Buscar código</button></div>
  </form>`);
  const video = $("#dlg video");
  if (!navigator.mediaDevices?.getUserMedia) { $(".cam-msg").textContent = "Este navegador no deja usar la cámara; escribe el código."; return; }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then((stream) => {
    escaner.stream = stream;
    video.srcObject = stream;
    video.play();
    $(".cam-msg").textContent = "Apunta al QR del cliente";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const leer = () => {
      if (!escaner.stream) return;
      if (video.readyState >= 2 && !escaner.pausa && typeof jsQR === "function") {
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const qr = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
        if (qr) { checkinCodigo(qr.data); escaner.pausa = true; setTimeout(() => (escaner.pausa = false), 2500); }
      }
      escaner.raf = requestAnimationFrame(leer);
    };
    leer();
  }, () => { $(".cam-msg").textContent = "Sin permiso de cámara; escribe el código."; });
}
function cerrarCamara() {
  cancelAnimationFrame(escaner.raf);
  escaner.stream?.getTracks().forEach((t) => t.stop());
  escaner.stream = null;
}
function checkinCodigo(texto) {
  const codigoLeido = (String(texto).toUpperCase().match(new RegExp(MARCA.prefijo + "-[A-Z0-9]{4}")) || [])[0];
  const r = codigoLeido && S.reservas.find((x) => x.codigo === codigoLeido);
  const out = $("#resultado-qr");
  const mostrar = (clase, html) => { if (out) out.innerHTML = `<div class="${clase}">${html}</div>`; };
  if (!r) return mostrar("qr-mal", `No encontré <b>${esc(codigoLeido || texto)}</b>.`);
  if (r.noche !== S.noche) return mostrar("qr-mal", `${esc(r.cliente)} reservó para el <b>${nocheDe(r.noche).corta}</b>, no para hoy.`);
  if (r.suc !== S.suc) return mostrar("qr-mal", `${esc(r.cliente)} reservó en <b>${esc(sucDe(r.suc).nombre)}</b>, no en esta sucursal.`);
  if (r.estado === "llego") return mostrar("qr-aviso", `${esc(r.cliente)} ya entró a las ${r.llegada} · mesa ${etiquetaMesa(r)}.`);
  if (r.estado !== "reservada") return mostrar("qr-mal", `La reservación de ${esc(r.cliente)} está <b>${CHIP_ESTADO[r.estado][0].toLowerCase()}</b>.`);
  r.estado = "llego";
  r.llegada = S.hora;
  const debe = !apartada(r) ? `<p class="nota-roja">No pagó anticipo: cobra ${dinero(r.anticipo - pagadoAnticipo(r))} antes de pasar.</p>` : "";
  mostrar("qr-bien", `<span class="eyebrow">Bienvenido</span><div class="qr-mesa">${etiquetaMesa(r)}</div><b>${esc(r.cliente)}</b> · ${r.personas} personas · RP ${esc(rpDe(r.rp).nombre)}${debe}`);
  toast(`✓ <b>${esc(r.cliente)}</b> entró · mesa ${etiquetaMesa(r)}`);
  render(true);
}

// Impresión en la ticketera: se arma una página mínima y se manda a imprimir.
function imprimir(titulo, cuerpo) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  document.body.appendChild(f);
  f.contentDocument.write(`<!doctype html><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font:13px monospace;width:72mm;margin:0 auto;color:#000}h1{font-size:16px;text-align:center;margin:6px 0}li{display:flex;justify-content:space-between;gap:8px}ul{list-style:none;padding:0}hr{border:0;border-top:1px dashed #000}.c{text-align:center}</style>${cuerpo}`);
  f.contentDocument.close();
  f.contentWindow.focus();
  f.contentWindow.print();
  setTimeout(() => f.remove(), 1000);
}
function imprimirComanda(c) {
  imprimir(`Comanda ${c.numero}`, `<h1>${AREAS[c.area].toUpperCase()} · #${c.numero}</h1><p class="c">Mesa ${esc(mesaComanda(c))} · ${c.hora} · ${esc(c.quien)}</p><hr><ul>${c.items.map((i) => `<li><span>${i.cant}× ${esc(i.nombre)}</span></li>${i.nota ? `<li><i>  → ${esc(i.nota)}</i></li>` : ""}`).join("")}</ul><hr>`);
}
function imprimirCuenta(r) {
  const { items, total } = ticketHTML(r);
  imprimir(`Cuenta ${etiquetaMesa(r)}`, `<h1>${esc(MARCA.nombre)}</h1><p class="c">Mesa ${etiquetaMesa(r)} · ${esc(r.cliente)}<br>${nocheDe(r.noche).larga}</p><hr><ul>${items.map((i) => `<li><span>${i.cant}× ${esc(i.nombre)}</span><span>${dinero(i.cant * i.precio)}</span></li>`).join("")}</ul><hr><ul><li><b>Total</b><b>${dinero(total)}</b></li><li><span>Pagado</span><span>${dinero(pagado(r))}</span></li><li><b>Falta</b><b>${dinero(falta(r))}</b></li></ul><hr><p class="c">${esc(MARCA.lema)}</p>`);
}

function csv() {
  const filas = [["Sucursal", "Noche", "Código", "Mesa", "Zona", "Cliente", "WhatsApp", "RP", "Origen", "Personas", "Hora", "Estado", "Comandas", "Consumo", "Pagado", "Propina", "Falta", "Pagos"]];
  deNoche().forEach((r) => {
    const m = r.mesa || (r.mesaOriginal || "").split("+")[0];
    filas.push([sucDe(r.suc).nombre, r.noche, r.codigo, etiquetaMesa(r), m ? zonaDe(mesaDe(m, r.suc).zona).nombre : "", r.cliente, r.tel, rpDe(r.rp).nombre, r.origen, r.personas, r.hora, CHIP_ESTADO[r.estado][0], comandasDe(r).length, cuenta(r), pagado(r), propinas(r), falta(r), r.pagos.map((p) => `${p.hora} ${detallePago(p)} ${p.monto}${p.recibio ? " (" + nombreQuien(p.recibio) + ")" : ""}`).join(" | ")]);
  });
  descargar(`corte-${MARCA.archivo}${multiSucursal ? "-" + S.suc : ""}-${S.noche}.csv`, filas.map(filaCSV).join("\n"));
}

// Aviso sonoro corto para la pantalla de barra/cocina.
function campana() {
  try {
    const a = new AudioContext(), o = a.createOscillator(), g = a.createGain();
    o.frequency.value = 880; g.gain.setValueAtTime(0.15, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.4);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + 0.4);
  } catch {}
}

// ---------- sucursales ----------
// Hostess, meseros y barra trabajan en una sola sucursal; el RP y el gerente pueden cambiar.
const fijoEnSucursal = () => ["hostess", "mesero", "barra"].includes(rol());
function pintarSucursal() {
  const el = $("#sucursal");
  if (!el) return;
  el.hidden = !multiSucursal;
  if (!multiSucursal) return;
  if (fijoEnSucursal()) S.suc = S.sesion.suc;
  el.innerHTML = fijoEnSucursal()
    ? `<span class="suc-fija">📍 ${esc(sucDe(S.suc).nombre)}</span>`
    : `<label class="reloj"><span>Sucursal</span><select id="suc" aria-label="Sucursal">${opciones(SUCURSALES.map((x) => [x.id, x.nombre]), S.suc)}</select></label>`;
}
// Gerente: la noche de todas las sucursales juntas, con total.
function panelTodas() {
  const filas = SUCURSALES.map((x) => {
    const n = deNoche(S.noche, x.id).filter((r) => r.estado !== "cancelada");
    const act = n.filter((r) => activa(r) || r.estado === "cerrada");
    return {
      x, reservas: act.length, personas: act.reduce((a, r) => a + r.personas, 0),
      usadas: ocupadas(S.noche, undefined, x.id).size, mesas: x.MESAS.length,
      consumo: n.reduce((a, r) => a + cuenta(r), 0), cobrado: n.reduce((a, r) => a + pagado(r), 0),
      porCobrar: n.filter(vino).reduce((a, r) => a + falta(r), 0), noshows: n.filter((r) => r.estado === "noshow").length,
    };
  });
  const tot = (k) => filas.reduce((a, f) => a + f[k], 0);
  const celdas = (f) => `<span class="der mono" data-l="Reservas">${f.reservas}</span><span class="der mono" data-l="Personas">${f.personas}</span>
    <span class="der mono" data-l="Ocupación">${Math.round((f.usadas / f.mesas) * 100)}%</span><span class="der mono" data-l="Consumo">${dinero(f.consumo)}</span>
    <span class="der mono cian" data-l="Cobrado">${dinero(f.cobrado)}</span><span class="der mono ${f.porCobrar ? "rojo" : "tenue"}" data-l="Por cobrar">${dinero(f.porCobrar)}</span>
    <span class="der mono ${f.noshows ? "rojo" : "tenue"}" data-l="No-shows">${f.noshows}</span>`;
  const total = { reservas: tot("reservas"), personas: tot("personas"), usadas: tot("usadas"), mesas: tot("mesas"), consumo: tot("consumo"), cobrado: tot("cobrado"), porCobrar: tot("porCobrar"), noshows: tot("noshows") };
  const mejor = [...filas].sort((a, b) => b.consumo - a.consumo)[0];
  return `<div class="panel todas">
    <div class="panel-cab"><h3>Todas las sucursales · ${nocheDe(S.noche).corta}</h3>${mejor.consumo ? `<span class="tenue chico">Vende más hoy: <b class="cian">${esc(mejor.x.nombre)}</b></span>` : ""}</div>
    <div class="tabla-todas">
      <div class="tt-cab"><span>Sucursal</span><span class="der">Reservas</span><span class="der">Personas</span><span class="der">Ocupación</span><span class="der">Consumo</span><span class="der">Cobrado</span><span class="der">Por cobrar</span><span class="der">No-shows</span></div>
      ${filas.map((f) => `<button type="button" class="tt-fila${f.x.id === S.suc ? " actual" : ""}" data-accion="ir-suc" data-suc="${f.x.id}"><span><b>${esc(f.x.nombre)}</b>${f.x.id === S.suc ? ` <small class="tenue">· abierta</small>` : ""}</span>${celdas(f)}</button>`).join("")}
      <div class="tt-fila total"><span><b>Total</b></span>${celdas(total)}</div>
    </div>
    <p class="tenue chico">Toca una sucursal para ver su mapa, cobranza y comandas.</p>
  </div>`;
}

// ---------- render y eventos ----------
// conDialogo: no cierra el diálogo abierto encima (escáner, cuenta, orden).
function render(conDialogo = false) {
  const tabs = ROLES[rol()].tabs;
  if (!tabs.includes(S.vista)) S.vista = tabs[0];
  pintarSucursal();
  const enviados = correrRecordatorios();
  if (enviados.length) toast(`📲 Recordatorio de 2 h enviado a ${enviados.map((r) => `<b>${esc(r.cliente)}</b>`).join(", ")}`);
  $("#noches").innerHTML = NOCHES.map((n) => `<button class="noche${n.fecha === S.noche ? " activa" : ""}" data-accion="noche" data-f="${n.fecha}">${n.corta}${n.evento ? '<i title="' + esc(n.evento) + '">' + (n.icono || "★") + "</i>" : ""}</button>`).join("");
  $("#hora").innerHTML = opciones(HORAS, S.hora);
  $("#rol").innerHTML = `<small>Entraste como</small><b>${rol() === "rp" ? esc(rpDe(S.sesion.rp).nombre) + " · RP" : ROLES[rol()].nombre}</b>`;
  const pendientes = S.comandas.filter((c) => c.noche === S.noche && c.suc === S.suc && (c.estado === "nueva" || c.estado === "lista")).length;
  $("#tabs").innerHTML = tabs.map((t) => `<button data-vista="${t}" aria-current="${t === S.vista ? "page" : "false"}"><b>${TABS[t][0]}${t === "comandas" && pendientes ? `<i class="burbuja">${pendientes}</i>` : ""}</b><small>${TABS[t][1]}</small></button>`).join("");
  $("#vista").innerHTML = { rp: vistaRP, misnumeros: vistaMisNumeros, mapa: vistaMapa, comandas: vistaComandas, cobranza: vistaCobranza, clientes: vistaClientes, menu: vistaMenu, gerente: vistaGerente }[S.vista]();
  if (!conDialogo && $("#dlg").open) $("#dlg").close();
  guardar();
}

const buscar = (id) => S.reservas.find((r) => r.id === id);
const copiar = (texto) => navigator.clipboard?.writeText(texto).then(() => toast("Copiado"), () => toast("No se pudo copiar"));

function asignarMesa(r, mesaId) {
  r.mesa = mesaId;
  r.mesasExtra = [];
  if (r.estado === "espera") r.estado = "reservada";
  if (puede("cualquierMesa")) r.forzada = "gerente";
  S.acomodando = null;
  S.selRes = null;
  S.sel = mesaId;
  toast(`<b>${esc(r.cliente)}</b> quedó en la ${mesaId}${mesaDe(mesaId, r.suc).cap < r.personas ? ` · ojo: caben ${mesaDe(mesaId, r.suc).cap} y van ${r.personas}` : ""}`);
  render();
}

document.addEventListener("click", (e) => {
  // Pantalla de la terminal simulada.
  const term = e.target.closest("[data-term]");
  if (term) return accionTerminal(term.dataset.term, term);
  // Diálogo de orden: categorías, agregar y quitar productos.
  const o = e.target.closest("[data-orden-cat], [data-orden-add], [data-orden-menos], [data-pct]");
  if (o) {
    if (o.dataset.pct !== undefined) {
      const f = $("#form-pago");
      f.propina.value = Math.round((Number(f.monto.value) * Number(o.dataset.pct)) / 100);
      return;
    }
    if (o.dataset.ordenCat) orden.cat = o.dataset.ordenCat;
    if (o.dataset.ordenAdd) { const it = orden.items.find((i) => i.id === o.dataset.ordenAdd); it ? it.cant++ : orden.items.push({ id: o.dataset.ordenAdd, cant: 1, nota: "" }); }
    if (o.dataset.ordenMenos) { const it = orden.items.find((i) => i.id === o.dataset.ordenMenos); if (it && --it.cant <= 0) orden.items = orden.items.filter((i) => i !== it); }
    return pintarOrden();
  }
  const t = e.target.closest("[data-accion], #tabs button, #rol");
  if (!t) return;
  if (t.id === "rol") return dlgRol();
  if (t.matches("#tabs button")) { S.vista = t.dataset.vista; S.sel = null; S.selRes = null; S.acomodando = null; return render(); }
  const r = t.dataset.id && buscar(t.dataset.id);
  switch (t.dataset.accion) {
    case "ir-suc": S.suc = t.dataset.suc; S.sel = null; S.selRes = null; S.acomodando = null; S.vista = "mapa"; return render();
    case "noche": S.noche = t.dataset.f; S.sel = null; S.selRes = null; S.ultimo = null; S.acomodando = null; return render();
    case "sel-mesa": {
      const id = t.dataset.mesa;
      if (S.acomodando) {
        if (ocupadas(S.noche, S.acomodando).has(id)) return toast(`La ${id} está ocupada.`);
        return asignarMesa(buscar(S.acomodando), id);
      }
      S.sel = S.sel === id ? null : id; S.selRes = null; return render();
    }
    case "cerrar-sel": S.sel = null; S.selRes = null; return render();
    case "abrir":
      if (!ROLES[rol()].tabs.includes("mapa") || (fijoEnSucursal() && r.suc !== S.suc)) return;
      S.vista = "mapa"; S.noche = r.noche; S.suc = r.suc; S.sel = r.mesa || null; S.selRes = r.mesa ? null : r.id; return render();
    case "acomodar": S.acomodando = r.id; S.sel = null; S.selRes = null; return render();
    case "acomodar-cancelar": S.acomodando = null; return render();
    case "cli-sel": S.cliSel = t.dataset.tel; return render();
    case "cli-cerrar": S.cliSel = null; return render();
    case "cli-filtro": S.cliFiltro = t.dataset.f; return render();
    case "ver-cliente":
      if (!ROLES[rol()].tabs.includes("clientes")) return;
      S.vista = "clientes"; S.cliSel = t.dataset.tel; S.cliBusca = ""; S.cliFiltro = "todos"; return render();
    case "nueva-para": {
      const p = perfil(t.dataset.tel);
      S.prefill = { cliente: p.cliente, tel: p.telVisible };
      S.vista = "rp"; S.ultimo = null;
      render();
      $("#form-rp [name=personas]").focus();
      return;
    }
    case "copiar": return copiar(t.dataset.texto);
    case "ver-mapa": S.vista = "mapa"; S.noche = t.dataset.noche; S.suc = t.dataset.suc || S.suc; S.sel = t.dataset.mesa; return render();
    case "llego": r.estado = "llego"; r.llegada = S.hora; toast(`<b>${esc(r.cliente)}</b> llegó a la ${etiquetaMesa(r)}`); return render();
    case "ordenar": return dlgOrden(r);
    case "ver-cuenta": return dlgCuenta(r);
    case "imprimir-cuenta": return imprimirCuenta(r);
    case "cobrar": return dlgCobrar(r);
    case "a-terminal": {
      const f = $("#form-pago");
      const monto = Number(f.monto.value);
      if (!(monto > 0)) return toast("Escribe el monto a cobrar");
      return dlgTerminal(r, monto, f.terminal.value);
    }
    case "efectivo-rp": return dlgCobrar(r, true);
    case "desocupar":
      if (falta(r) && !confirm(`${r.cliente} todavía debe ${dinero(falta(r))}. ¿Liberar la mesa de todos modos?`)) return;
      desocupar(r);
      toast(`Mesa ${etiquetaMesa(r)} desocupada · queda <b>por limpiar</b> hasta que alguien la reactive`);
      S.sel = r.mesa;
      return render();
    case "reactivar": {
      const extra = reactivar(t.dataset.mesa, S.noche);
      toast(`Mesa <b>${t.dataset.mesa}</b> lista otra vez${extra}`);
      return render();
    }
    case "noshow": { const extra = liberar(r, "noshow"); S.sel = null; toast(`Mesa liberada${extra}`); return render(); }
    case "cancelar": { const extra = r.mesa ? liberar(r, "cancelada") : ((r.estado = "cancelada"), ""); S.sel = null; S.selRes = null; toast(`Reservación cancelada${extra}`); return render(); }
    case "separar": { const quitadas = r.mesasExtra.splice(0); toast(`Se separaron ${quitadas.join(", ")}${avisoEspera(reacomodarEspera(r.noche))}`); return render(); }
    case "liberar-tardes": {
      const tardes = deNoche().filter(tarde);
      let extra = "";
      tardes.forEach((x) => { extra += liberar(x, "noshow"); });
      toast(`${tardes.length} mesa(s) liberada(s)${extra}`);
      return render();
    }
    case "asignar-aqui": return asignarMesa(r, t.dataset.mesa);
    case "recibir-caja": {
      const l = efectivoEnMano(t.dataset.rp);
      l.forEach(({ p }) => { p.entregado = true; p.entregadoA = quienSoy(); });
      toast(`Caja recibió ${dinero(l.reduce((a, x) => a + x.p.monto, 0))} de <b>${esc(rpDe(t.dataset.rp).nombre)}</b>`);
      return render();
    }
    case "comanda-avanzar": {
      const c = S.comandas.find((x) => x.id === t.dataset.c);
      c.estado = t.dataset.a;
      toast(`Comanda <b>#${c.numero}</b> · ${{ preparando: "en preparación", lista: "lista para llevar a la " + mesaComanda(c), entregada: "entregada" }[c.estado]}`);
      return render();
    }
    case "comanda-imprimir": return imprimirComanda(S.comandas.find((x) => x.id === t.dataset.c));
    case "area": S.area = t.dataset.f; return render();
    case "menu-agregar":
      S.menu.unshift({ id: "p" + Date.now().toString(36), nombre: "Producto nuevo", categoria: S.menu[0]?.categoria || "General", precio: 0, area: "barra" });
      render();
      $("[data-campo=nombre]")?.select();
      return;
    case "menu-borrar": if (confirm("¿Quitar este producto del menú?")) { S.menu = S.menu.filter((p) => p.id !== t.dataset.id); render(); } return;
    case "menu-csv": return descargar(`menu-${MARCA.archivo}.csv`, [["nombre", "categoria", "precio", "area"], ...S.menu.map((p) => [p.nombre, p.categoria, p.precio, p.area])].map(filaCSV).join("\n"));
    case "escanear": return dlgEscanear();
    case "filtro": S.filtro = t.dataset.f; return render();
    case "csv": return csv();
    case "reiniciar": if (confirm("¿Borrar los cambios y volver a los datos de ejemplo?")) { estadoInicial(); render(); toast("Demo reiniciado"); } return;
  }
});

document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.id === "hora") { S.hora = t.value; return render(); }
  if (t.id === "suc") { S.suc = t.value; S.sel = null; S.selRes = null; S.acomodando = null; S.ultimo = null; return render(); }
  if (t.dataset.cambia === "rp") { S.rp = t.value; S.ultimo = null; return render(); }
  if (t.dataset.cargarMenu !== undefined && t.files?.[0]) { t.files[0].text().then(cargarMenuCSV); return; }
  if (t.dataset.menu) {
    const p = S.menu.find((x) => x.id === t.dataset.menu);
    const k = t.dataset.campo;
    if (k === "activo") p.inactivo = !t.checked;
    else p[k] = k === "precio" ? Number(t.value) || 0 : t.value;
    guardar();
    if (k === "categoria" || k === "activo") render();
    return;
  }
  const r = t.dataset.id && buscar(t.dataset.id);
  if (t.dataset.accionCambio === "mover" && t.value) {
    const antes = etiquetaMesa(r);
    r.mesa = t.value;
    r.mesasExtra = [];
    if (puede("cualquierMesa")) r.forzada = "gerente";
    S.sel = r.mesa;
    toast(`<b>${esc(r.cliente)}</b> se movió de ${antes} a ${r.mesa}`);
    return render();
  }
  if (t.dataset.accionCambio === "juntar" && t.value) {
    r.mesasExtra.push(t.value);
    toast(`Mesas juntas: <b>${etiquetaMesa(r)}</b> · ${mesasDe(r).reduce((a, id) => a + mesaDe(id, r.suc).cap, 0)} lugares`);
    return render();
  }
  if (t.form && t.form.id === "form-rp" && (t.name === "noche" || t.name === "suc") && $("#sel-mesa-alta")) $("#sel-mesa-alta").innerHTML = opcionesMesas(t.form.noche.value, t.form.suc?.value || S.suc);
  if (t.hasAttribute("data-pista")) pista(t.form);
});

document.addEventListener("input", (e) => {
  const t = e.target;
  if (t.dataset.ordenNota) { const it = orden.items.find((i) => i.id === t.dataset.ordenNota); if (it) it.nota = t.value; return; }
  if (t.hasAttribute("data-pista") && t.form) pista(t.form);
  if (t.hasAttribute("data-tel")) {
    const html = tarjetaPerfilRP(t.value);
    if ($("#perfil-rp").dataset.html !== html) { $("#perfil-rp").innerHTML = html; $("#perfil-rp").dataset.html = html; }
    const p = perfil(t.value);
    if (p && !t.form.cliente.value) t.form.cliente.value = p.cliente;
    pista(t.form);
  }
  if (t.hasAttribute("data-buscar")) {
    S.cliBusca = t.value;
    $("#lista-clientes").innerHTML = listaClientes();
    guardar();
  }
});

// Las páginas del cliente y las otras pantallas (mesero, barra) corren en otras pestañas:
// cuando cambian algo, aquí entra el aviso.
window.addEventListener("storage", (e) => {
  if (e.key !== LLAVE || !e.newValue) return;
  let nuevo;
  try { nuevo = JSON.parse(e.newValue); } catch { return; }
  const antes = new Map(S.reservas.map((r) => [r.id, { pagos: r.pagos.length, conf: r.confirmacion, estado: r.estado, efe: r.efectivoPendiente }]));
  const comAntes = new Map(S.comandas.map((c) => [c.id, c.estado]));
  recibirDatos(e.newValue);
  const avisos = [];
  S.reservas.forEach((r) => {
    const a = antes.get(r.id);
    if (!a) return avisos.push(`🆕 <b>${esc(r.cliente)}</b> reservó ${etiquetaMesa(r)} ${r.origen === "liga" ? "con la liga de " + esc(rpDe(r.rp).nombre) : r.origen === "web" ? "desde la web" : ""}`);
    if (r.pagos.length > a.pagos) avisos.push(`💸 <b>${esc(r.cliente)}</b> pagó ${dinero(r.pagos.at(-1).monto)}`);
    if (r.confirmacion === "si" && a.conf !== "si") avisos.push(`✓ <b>${esc(r.cliente)}</b> confirmó que viene`);
    if (r.estado === "cancelada" && a.estado !== "cancelada") avisos.push(`<b>${esc(r.cliente)}</b> canceló · ${r.mesaOriginal} liberada`);
    else if (r.estado === "reservada" && a.estado === "espera") avisos.push(`De la lista de espera entró <b>${esc(r.cliente)}</b> a ${etiquetaMesa(r)}`);
    if (r.efectivoPendiente && !a.efe) avisos.push(`<b>${esc(r.cliente)}</b> pagará el anticipo en efectivo con ${esc(rpDe(r.rp).nombre)}`);
  });
  let nuevaComanda = false;
  S.comandas.forEach((c) => {
    const a = comAntes.get(c.id);
    if (!a) { nuevaComanda = true; avisos.push(`🧾 Comanda <b>#${c.numero}</b> · mesa ${esc(mesaComanda(c))} → ${AREAS[c.area]}`); }
    else if (c.estado === "lista" && a !== "lista") avisos.push(`✅ Comanda <b>#${c.numero}</b> lista · llevar a la ${esc(mesaComanda(c))}`);
  });
  if (nuevaComanda && ROLES[rol()].tabs.includes("comandas")) campana();
  if (avisos.length) toast(avisos.join("<br>"));
  render(true);
});

document.addEventListener("submit", (e) => {
  const f = e.target;
  if (f.id === "form-rp") {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(f));
    const r = altaReserva({ ...d, origen: "rp", mesas: d.mesa ? [d.mesa] : null, forzada: d.mesa ? "gerente" : null });
    S.rp = d.rp; S.noche = d.noche; S.ultimo = r.id;
    if (d.suc) S.suc = d.suc;
    toast(r.mesa ? `Acomodada en <b>${etiquetaMesa(r)}</b> · ${zonaDe(mesaDe(r.mesa, r.suc).zona).nombre}${multiSucursal ? " · " + esc(sucDe(r.suc).nombre) : ""}` : "Sin mesa disponible: quedó en lista de espera");
    return render();
  }
  if (f.id === "form-ajustes") {
    e.preventDefault();
    const d = new FormData(f);
    ZONAS.forEach((z) => { S.ajustes.minimos[z.id] = Number(d.get("min-" + z.id)) || 0; });
    ["tolerancia", "comision", "anticipoPct", "factorEvento", "metaSemanal"].forEach((k) => { S.ajustes[k] = Number(d.get(k)) || 0; });
    S.ajustes.anticipo = d.get("anticipo");
    toast("Ajustes guardados. Aplican a las nuevas reservaciones.");
    return render();
  }
  if (e.submitter && e.submitter.value === "cancel") return;
  if (f.id === "form-rol") {
    const d = new FormData(f);
    S.sesion = { rol: d.get("rol"), rp: d.get("rp"), suc: d.get("suc") || S.sesion.suc || S.suc };
    S.sel = null; S.selRes = null; S.ultimo = null; S.acomodando = null;
    toast(`Entraste como <b>${d.get("rol") === "rp" ? rpDe(d.get("rp")).nombre + " (RP)" : ROLES[d.get("rol")].nombre}</b>${multiSucursal && fijoEnSucursal() ? " en " + esc(sucDe(S.sesion.suc).nombre) : ""}`);
    return render();
  }
  if (f.id === "form-escaner") {
    e.preventDefault();
    checkinCodigo(new FormData(f).get("codigo"));
    return;
  }
  if (f.id === "form-orden") {
    const r = buscar(orden.rid);
    if (!orden.items.length) return;
    const comandas = crearComandas(r, orden.items, nombreQuien(quienSoy()));
    toast(`🧾 ${comandas.map((c) => `Comanda <b>#${c.numero}</b> → ${AREAS[c.area]}`).join(" · ")} · cuenta ${dinero(cuenta(r))}`);
    orden.items = [];
    return render();
  }
  if (f.id === "form-pago") {
    const r = buscar(f.dataset.id);
    const d = new FormData(f);
    const monto = Number(d.get("monto"));
    if (!(monto > 0)) return;
    const metodo = d.get("metodo");
    const pago = { monto, metodo, tipo: d.get("tipo"), hora: S.hora, recibio: quienSoy() };
    const propina = Number(d.get("propina")) || 0;
    if (propina) pago.propina = propina;
    if (metodo === "Tarjeta") { pago.via = "manual"; const folio = String(d.get("folio") || "").trim(); if (folio) pago.folio = folio; }
    if (metodo === "Efectivo" && rol() === "rp") pago.entregado = false;
    r.pagos.push(pago);
    if (apartada(r)) r.efectivoPendiente = false;
    toast(estadoPago(r) === "pagada" ? `Mesa ${etiquetaMesa(r)} <b>pagada</b> ✓${propina ? ` · propina ${dinero(propina)}` : ""}` : `Pago de ${dinero(monto)} registrado${cuenta(r) ? ` · faltan ${dinero(falta(r))}` : ""}`);
    render();
  }
});

$("#dlg").addEventListener("close", cerrarCamara);

document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("g.mesa")) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
});

S = cargar() || estadoInicial();
aplicarMarca("Reservas");
$("#marca").innerHTML = logoMarca() + (MARCA.logoConTexto ? `<span class="sub">reservas</span>` : "");
$("#pie").innerHTML = `Demo hecho por <b>Mecha</b> para ${esc(MARCA.nombre)}${MARCA.sucursal ? " " + esc(MARCA.sucursal) : ""} · plano, menú, RPs y clientes de ejemplo`;
render();
