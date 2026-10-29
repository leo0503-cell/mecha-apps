# Prende de Mecha

PWA gratuita para usar IA en una PyME: perfil, Radiografía con números propios, recetas personalizadas, Mesa de trabajo, Ruta de 30 días, reglas imprimibles y paquetes de Mecha. HTML, CSS y módulos ES; sin frameworks, dependencias de frontend ni compilación.

## Correr la app

Desde `prende/`:

```sh
uv run servidor.py
```

Abre **http://localhost:4190**. Para activar la Mesa con IA, copia `.env.ejemplo` a `prende/.env` y escribe tu llave en `ANTHROPIC_API_KEY`. La llave se queda en el servidor; nunca se manda al navegador ni se sube al repo. `.env` está ignorado por Git.

Sin llave, Prende arma un prompt con el perfil, el pedido y reglas para usarlo en ChatGPT o Claude. También sugiere una receta por coincidencia de palabras. Cuando hay un error de conexión o del servidor, ofrece ese mismo modo.

Para servir únicamente la versión estática:

```sh
python3 -m http.server -d web 4191
```

Abre **http://localhost:4191**. La Mesa prepara recetas para copiar, sin llamar a una IA. También puedes publicar el contenido de `web/` en un hosting estático, incluso en una subcarpeta. No abras `index.html` con `file://`: los módulos y los JSON necesitan un servidor HTTP.

La PWA se instala desde el navegador en HTTPS o localhost. El service worker pide primero la red para todos los archivos y usa la caché cuando no hay conexión. Precarga los recursos locales, excluye `/api/` y permite consultar la app sin conexión después de una primera carga exitosa. Al publicar cambios en el service worker, incrementa `CACHE` para retirar versiones anteriores.

## Archivos

- `web/datos/recetas.json`: síntomas y todas las recetas. Variables `{negocio}`, `{giro}`, `{ciudad}`, `{vende}`, `{cliente}` y `{tono}` salen del perfil.
- `web/datos/ruta.json`: niveles, semanas, retos y sus destinos.
- `web/datos/paquetes.json`: nombres, contenido, precios y letra chica.
- `web/js/config.js`: número de WhatsApp de Mecha.
- `web/js/domain.js`: cálculos, personalización, coincidencia de recetas y prompt sin IA.
- `web/js/state.js`: lectura y guardado local con manejo de errores.
- `web/js/ui.js`: escape de texto, cordón SVG, copiar y abrir chats.
- `web/js/views.js`: pantallas; `web/js/app.js`: navegación y acciones.
- `web/css/estilos.css`: diseño, responsividad, temas y hoja carta de reglas.
- `web/css/tokens.css`: tokens de marca generados; no editar a mano.

Los JSON editoriales y los tokens se conservan. El servidor valida JSON, origen y tamaño de petición. Para futuros cambios editoriales, modifica los JSON, no el JS.

## Datos locales y uso

Una única clave `prende.v1` guarda perfil, Radiografía, Ruta, favoritas y los últimos 10 pedidos con sus respuestas. `ruta.recetas` lleva la lista de recetas hechas; `preferencias` guarda el tema y el responsable de las reglas. Si falla el almacenamiento, la app sigue funcionando durante la sesión. En Ajustes puedes exportar un JSON o borrar tus datos con confirmación. No hay sincronización ni importación de copias.

El primer uso incluye **siete pasos**, uno por cada campo que enumera el brief (aunque su encabezado dice seis). Puedes saltar y completar el perfil después. Los retos se marcan a mano; “La hice” en una receta también completa el reto si es el primer día pendiente. Las ligas compartidas con `#/recetas?rol=ventas` abren el filtro indicado.

La Radiografía convierte días con ×30 y semanas con ×4.33. Cero, un campo vacío o un dato inválido se muestran como “sin datos”. No estima ahorros. Los enlaces de WhatsApp solo se abren cuando los tocas. Las respuestas de IA se pintan como texto escapado; no se interpreta HTML ni Markdown.

## Pendientes entre corchetes

- `<precio por confirmar>`: Taller Prende y Acompañamiento 30 días. Mecha debe confirmar estos dos precios en `paquetes.json`.
- `[tu negocio]`, `[tu giro]`, `[tu ciudad]`, `[lo que vendes]`, `[quién te compra]`, `[tu tono]`, `[tu rol]`: aparecen si falta un campo del perfil; se completan en Ajustes.
- `[responsable]`: nombre editable antes de imprimir las reglas.
- `[corchetes]`, `[verificar]`, `[sin fecha]`: se conservan tal como aparecen en las recetas originales. Los datos que falten en una respuesta de IA también se presentan con el estilo pendiente y se completan o verifican antes de usarse.
- Los huecos `«PEGA AQUÍ …»` y los demás textos entre `«…»` son espacios de trabajo de cada receta. Se resaltan para que el usuario añada su contenido.

La Mesa con IA real requiere una llave válida y disponibilidad del modelo configurado en el servidor. No se necesitan esos servicios para el resto de la app.

## Formato y revisión

Desde `prende/`, ejecuta el comando del brief:

```sh
~/.bun/bin/prettier --write "web/**/*.{html,css,js}"
```

Revisa 360 px y escritorio, tema claro/oscuro/sistema, navegación atrás, recetas con perfil incompleto, cálculos con datos/cero/vacíos, historial, compartir por rol, borrado confirmado, impresión en carta y recarga sin conexión. Para verificar la clasificación de IA, el servidor debe tener una llave válida.

## Regresiones

`node --test tests/state.test.mjs` comprueba recuperación de datos locales malformados. La suite `../tests/test_revision_apps.py` prueba el servidor sin llamar a Anthropic. El service worker separa su caché por ruta para que dos instalaciones en el mismo dominio no borren las copias de la otra. Borrar los datos descarta una respuesta de la Mesa que siga en curso.
