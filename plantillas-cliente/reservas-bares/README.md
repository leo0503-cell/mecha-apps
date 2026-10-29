# Reservas para bares (motor)

Sistema de reservas por RP para bares y antros: alta y acomodo automático, mapa en vivo, menú y
comandas a barra/cocina, cobranza desde lo pedido, clientes y no-shows, liga del RP, preventa,
recordatorios, check-in con QR y roles (RP, hostess, mesero, barra/cocina, gerente).

Hoy es un **demo**: todo vive en el navegador (localStorage), el pago y el WhatsApp son simulados.

## Estructura
| Archivo | Qué es |
|---|---|
| `motor/app.js` | App del personal |
| `motor/nucleo.js` | Reglas: acomodo, mesas juntas, cuenta por comandas, anticipo, historial, plano |
| `motor/estilos.css` | Estilos con variables (los valores base son los de Not a Bank) |
| `motor/index.html`, `reservar.html`, `mi-mesa.html` | Páginas: personal, reserva pública, página del cliente |

Cada bar tiene su carpeta `demo/` con **sólo lo suyo**:
- `datos.js` — `MARCA` (nombre, lema, logo, prefijo de códigos, horario…), `PLANO` (SVG de decoración),
  `ZONAS`, `MESAS`, `JUNTAS`, `RPS`, `NOCHES`, `MENU`, `AJUSTES_BASE`, `HISTORIAL`, `SEMILLA`.
  Varias sucursales: en lugar de `PLANO`/`MESAS`/`JUNTAS` se declara `SUCURSALES: [{ id, nombre,
  direccion, PLANO, MESAS, JUNTAS }]` y cada reservación de la semilla lleva `suc`. Sale un selector de
  sucursal; hostess, mesero y barra quedan fijos en la suya; el gerente ve "Todas las sucursales" con
  total; la página pública deja escoger sucursal (`reservar.html?suc=colosio`).
- `marca.css` — fuentes extra y variables de color que cambian.
- `img/` — logo e ícono.
- Enlaces: `motor` → esta carpeta, y `index.html`, `reservar.html`, `mi-mesa.html` → `motor/…`.

Bares que lo usan: `~/mecha/propuestas/not-a-bank/demo`, `~/mecha/propuestas/maria-mezcal/demo`,
`~/mecha/propuestas/maria-loreta/demo` (3 sucursales).

## Cobro con tarjeta
- **Terminal conectada (simulada en el demo):** en Cobrar → Tarjeta → "Mandar a la terminal". El cliente
  escoge propina y paga en la terminal; el pago entra solo con terminal, últimos 4 y autorización.
  Para hacerlo real: terminales con API de integración (p. ej. Mercado Pago Point; confirmar Clip u otra),
  cuenta de negocio, credenciales, y un servidor con URL pública que reciba la confirmación (webhook).
- **A mano:** si la terminal no está conectada, se guarda el pago con folio o últimos 4. Cobranza →
  Terminales avisa los cobros con tarjeta sin folio para cuadrar contra el corte de la terminal.
- Terminales por sucursal: `terminales: [{ id, nombre }]` en cada sucursal (si no, salen "barra" y "salón").

## Bar nuevo
```bash
mkdir -p ~/mecha/propuestas/<bar>/demo && cd ~/mecha/propuestas/<bar>/demo
ln -s ../../../plantillas-cliente/reservas-bares/motor motor
for h in index.html reservar.html mi-mesa.html; do ln -s motor/$h $h; done
cp ../../maria-mezcal/demo/datos.js ../../maria-mezcal/demo/marca.css .   # y se editan
```
Logo: si la imagen ya trae el nombre, `logoConTexto: true`; si es sólo símbolo, `false` y se escribe
el nombre al lado.

## Servir el demo
`cd demo && python3 motor/servir.py <puerto>`: igual que `http.server` pero sin caché, para que una
pestaña abierta no se quede con código viejo. Las páginas piden `motor/*.js?v=<fecha>`: al cambiar el
motor, sube ese número en las tres páginas. Los datos se guardan en `localStorage` (compartidos entre
pestañas) y lo de cada pantalla en `sessionStorage`; al cambiar la forma de los datos, sube `LLAVE` en
`nucleo.js`.

## Para mandarlo a otro lado
Los enlaces no viajan en un zip: copiar con `cp -RL demo/ destino/` para que se vuelvan archivos.
Cambiar algo en `motor/` cambia todos los bares a la vez; probarlos todos después.
