# Mecha — Hub de soluciones & demos

Interfaz comercial responsiva en React + TypeScript + Vite, con Framer Motion, Lucide y CSS modular por componentes. Implementada de forma independiente del sitio existente en `../sitio/`.

## Ejecutar

Node 24 vía nvm y Bun:

```sh
bun install --frozen-lockfile
bun run dev
# http://127.0.0.1:4325
bun run build
bun run preview
bun run test
bun run test:browser
```

`test:browser` utiliza Chrome instalado. En otro sistema define `BROWSER_BIN` con la ruta del ejecutable. No descarga ni instala navegadores. Los artefactos de pruebas se generan en `artifacts/`, excluido de Git. Para formato: `bun run format`.

## Componentes

- `src/components/Landing.tsx`: navegación, hero, identidad del hub y capacidades.
- `src/components/Demos.tsx`: catálogo, búsqueda y filtros.
- `src/components/DemoModal.tsx`: contenedor modal accesible, temporizador y `TrialLock`.
- `src/components/DemoApps.tsx`: seis versiones de muestra con interacción local.
- `src/components/Packages.tsx`: paquetes y formulario con selección sincronizada.
- `src/components/Preview.tsx`: miniaturas de interfaz en HTML/CSS.
- `src/data/projects.ts`: catálogo y contenido de los paquetes.
- `src/trial.ts`: plazo de prueba por demo y cálculo del tiempo restante.
- `src/styles.css`: tokens del hub, componentes y vistas responsivas.

## Demos y procedencia

Se revisaron los README locales de Inventario TMM, Universidad TMM, CubiCarga, Traba, Relevo y Prende. Las demos del hub son versiones ilustrativas nuevas de sus flujos, con datos ficticios identificados. **No son las aplicaciones originales embebidas ni utilizan sus APIs, bases, credenciales o archivos internos.** No se copió información operativa de TMM. No se atribuye la autoría de proyectos a Claude sin documentación verificable. TMM se describe como experiencia del equipo, no como cliente de Mecha.

- Inventario: búsqueda, consulta, mapa y salida de piezas durante la sesión.
- CubiCarga: cálculo geométrico de volumen con dimensiones y cantidad; sin motor real 3D.
- Universidad TMM: lección y evaluación de muestra; sin cuentas, constancias o progreso real.
- Traba: consulta y revisión de expedientes ficticios; sin conciliación real.
- Relevo: regla y práctica de muestra; no valida expertos ni genera manuales reales.
- Prende: instrucciones por plantilla para llevar a ChatGPT o Claude; sin llamada a IA.

Para integrar una aplicación original se requiere un despliegue aislado con fixtures y un adaptador que cumpla el contrato de pausa/desmontaje del hub. No apuntar iframes a operaciones reales.

## Temporizador

Cada demo recibe 30 segundos desde su primera apertura. Un plazo absoluto evita extender la prueba al cambiar de pestaña o al suspender los intervalos. `sessionStorage` conserva el vencimiento al cerrar, reabrir o recargar la misma pestaña. Cada demo tiene su propio plazo. Al vencer, el contenido conserva su estado, queda `inert` y desenfocado y el foco va a la acción de cotización. El diálogo nativo contiene el foco, permite Escape y restaura el foco al cerrar.

Este es un **límite comercial de frontend**, no un control de acceso seguro: borrar almacenamiento, abrir otra sesión o modificar JavaScript puede reiniciar la prueba. Si se necesita protección real de software, implementar sesiones y caducidad verificadas por el backend, con las APIs protegidas independientemente de la interfaz. Si el navegador no permite almacenamiento, la prueba funciona con el plazo de la apertura actual.

## Cotización y contacto

El botón del bloqueo preselecciona la demo, cierra el diálogo y lleva a Paquetes; elegir un plan lo preselecciona y lleva al formulario. El formulario valida campos obligatorios y correo. El envío abre WhatsApp con la solicitud preparada; **el visitante confirma el envío en WhatsApp**. No hay envío automático, backend de leads, CRM ni almacenamiento de datos del formulario.

El número proviene de `../sitio/js/config.js` y `../prende/web/js/config.js`. Los planes no publican precios ni plazos. La inversión y el alcance requieren confirmación. Las cantidades de las demos son fixtures ficticios, no métricas de resultados.

## Diseño y publicación

Esta propuesta usa la dirección visual solicitada: carbón y lima. El logotipo vectorial del hub es provisional; la marca previa en `../marca/brand.py` utiliza rojo/ceniza. No se modificaron sus archivos. Las fuentes DM Sans y Manrope se cargan desde Google Fonts con fallback local. Se respeta movimiento reducido y se verifican tamaños de 390, 768 y 1440 px.

`bun run build` genera `dist/`. El manifiesto `.openai/hosting.json` declara alojamiento estático para Sites. La publicación se conserva privada por defecto; no sustituye al sitio anterior.
