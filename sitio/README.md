# Mecha · sitio público

HTML, CSS y JavaScript sin dependencias ni build. Puedes abrir `index.html`
directamente o previsualizarlo con:

```sh
python3 -m http.server -d ~/mecha/sitio 4180
```

Abre `http://localhost:4180`. Para publicarlo, sube los archivos junto con las
carpetas `css/`, `js/` y `assets/` a un hosting estático.

- **Contacto:** edita `js/config.js`. Todos los botones de WhatsApp usan ese
  número y el mensaje centralizado; los paquetes usan su nombre en el mensaje.
  Mientras falte el número, los botones llevan a `#contacto`.
- **Precios y plazo:** edita las tarjetas de `#paquetes` y la respuesta de
  `#preguntas` en `index.html`. Al confirmar un dato, elimina su clase `pendiente`.
- **Tema:** el botón recorre sistema, claro y oscuro y recuerda tu elección.
  Los colores vienen de `css/tokens.css`; no se modifica. `.prettierignore`
  protege ese archivo al formatear.
- **App y reel:** los tabs funcionan con clic y teclado. El video se reproduce
  solo cuando está visible; con movimiento reducido se usa reproducción manual.

Pendientes visibles (sin sustituir por datos inventados):

- `<hola@mecha.mx>`
- `<@mecha.mx>`
- `<Tu negocio>`: ejemplo ilustrativo en las pantallas de la app.
- `<Plazo mínimo por confirmar>`
- `<por confirmar>`: respuesta sobre plazo forzoso.

Open Graph y Twitter usan `assets/img/og.png`. Al definir el dominio público,
convierte esas dos rutas de metadatos a URL absoluta para los lectores de redes.

Para dar formato sin alterar los tokens:

```sh
~/.bun/bin/prettier --write "**/*.{html,css,js}"
```

Verificación: copy, anclas y archivos locales, formato, sintaxis JavaScript,
contraste y controles en DOM local. Las capturas y la revisión visual en Chrome
quedaron pendientes: el entorno bloqueó el servidor local y Chrome headless
terminó sin producir imágenes.
