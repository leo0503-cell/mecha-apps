# CubiCarga

Calculadora de cubicaje y planes 3D de Mecha. Next.js App Router, TypeScript estricto, Tailwind/shadcn, Supabase y React Three Fiber. Produce acomodos recomendados por heurísticas; no certifica optimalidad ni seguridad de carga.

## Ejecutar

Node 24 por nvm y Bun 1.3.14.

```bash
bun install --frozen-lockfile
bun run dev
bun run lint
bun run typecheck
bun run test
bun run probar-sql
bun run build
bun run start --port 4218
```

Sin credenciales funciona localmente: IndexedDB guarda catálogos, escenarios, plantillas y versiones en este navegador. El selector de rol local prueba la UI; no autentica empresas. En Supabase el perfil verificado y RLS determinan los permisos.

## Flujos

- /calculadora: cálculo público de un material, paletizado y comparación de equipos.
- /planificar: cuatro pasos, varios SKU/paradas, flota para carga suelta, editor, bloqueos con apoyos, reoptimización, importación y exportación.
- /proyectos: escenarios, duplicación, comparación de dos visores y restauración como versión nueva.
- /almacen: capacidad de rack selectivo en posiciones, m³ y kg con datos capturados.
- /herramientas: CBM, conversiones, cobro aéreo y LCL W/M.
- /catalogos: materiales, equipos, tarimas, transportistas y almacenes.
- /p/[token]: lectura pública, OG y WhatsApp cuando existe backend público.

Paletizado conserva el motor homogéneo de un SKU; la flota repite el primer tipo de equipo. El editor de posiciones opera en carga suelta. Las cajas dentro de una tarima se recalculan por parámetros.

Excel es XLSX real. PNG captura el visor o usa fallback SVG. El informe HTML imprimible permite guardar PDF e incluye vistas isométricas completas por equipo, capas, pasos, no cargados y avisos. Se valida antes de guardar/exportar.

Las etiquetas QR necesitan tarimas y un link válido. Montacarguista presenta un paso a la vez y marcas durante la sesión. Plantillas permiten cambiar cantidades. Atajos del visor enfocado: 1–4 vistas, espacio secuencia, R rotación/vista y Ctrl+Z deshacer; respetan campos de captura.

## Supabase

1. Copia .env.example a .env.local: URL, clave pública anon y URL pública del sitio. Nunca pongas una clave de servicio en el cliente.
2. Aplica migraciones 1–6, en orden, primero en staging. Son aditivas y no eliminan datos ni políticas.
3. seed.sql contiene solo catálogos globales. scripts/fixtures.sql es exclusivo de PGlite; no lo apliques al backend real.
4. Crea empresas y asigna perfiles/roles mediante administración confiable de Supabase. Registrar Auth no asigna automáticamente una empresa.
5. Si se aplicaron semillas antiguas, revisa/revoca/rota sus cuentas demo y sesiones. Corregir el repositorio no modifica cuentas externas.
6. Sigue docs/PUESTA_EN_MARCHA.md para aislamiento A/B, cambio de sesión, revocación, OG y WhatsApp.

APIs verifican origen web, sesión y Zod con límite real del cuerpo. Triggers protegen identidades, referencias, aprobación y snapshots. Respuestas privadas usan private, no-store. El service worker excluye APIs, autenticación y tokens.

## Motor y límites

src/motor es TypeScript puro; motor.worker.ts usa Comlink. mm enteros/kg, X fondo→puerta, Y ancho, Z alto. Valida orientación, soporte por unión de áreas, resistencia/capas, fragilidad, carga útil, LIFO y COG. Recalcula KPIs desde posiciones.

Mixto usa puntos extremos y semilla reproducible. Su presupuesto determinista limita candidatos y 5,000 bultos colocados por ejecución. tiempoMaxS representa esfuerzo, no plazo garantizado. Cancelar termina el Worker; una búsqueda incompleta no se presenta como límite de volumen.

ULD usa una envolvente rectangular referencial; contorno, altura/carga autorizadas requieren proveedor/aerolínea. No está certificado para el contorno real. COG no valida pesos por eje y las maniobras animadas son ilustrativas.

## PWA y recursos

Abre la calculadora con red para preparar el service worker. Después calcula y consulta catálogos globales offline. Usa HTTPS o localhost. Build genera public/sw.js y offline-assets.json desde src/lib/pwa/service-worker.js.

bun run recursos regenera SVG, logo provisional, iconos y placeholders. Fotos reales pendientes: reemplazar WebP/alt según docs/IMAGENES.md. Hero móvil ligero; 3D diferido en escritorio y movimiento reducido respetado.

## Verificar navegador

Con producción 4218 y Chrome instalado:

```bash
export BROWSER_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
node scripts/nucleo-e2e.mjs
node scripts/operacion-e2e.mjs
node scripts/motion-e2e.mjs
node scripts/pwa-e2e.mjs
node scripts/cierre-e2e.mjs
node scripts/visor-stress.mjs
node scripts/lighthouse.mjs
```

Contextos aislados y datos sintéticos. CAPTURAS_DIR conserva capturas históricas de núcleo/operación/motion. Lighthouse registra tres corridas, medianas y variación. Heap JS no equivale a memoria total/GPU ni a móvil físico.

## Entregas

docs/PROMPT.md, AUDITORIA.md, AUDITORIA_INICIAL.md, DECISIONES.md, PLAN.md y pr/FASE-N.md contienen alcance y evidencia. Ramas por fase apiladas sobre la anterior. Sin remoto: no se publicaron PRs ni se desplegó.
