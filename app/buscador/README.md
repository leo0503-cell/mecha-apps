# Mecha · Pedidos y entregas

App local para que cada negocio pida lo que necesita y reciba el producto preparado por Mecha. No usa Claude ni otra API de IA. No genera entregas automáticamente y no necesita claves de modelos.

## Uso

```sh
bun install
bun run build
bun start
```

Clientes: http://127.0.0.1:4195/ · Operación: http://127.0.0.1:4195/operacion

El catálogo reúne las 140 solicitudes proporcionadas por Leonardo. Se abre desde “Ver qué puedes pedir”, permite buscar y filtrar por categoría y llena el buscador al elegir una idea. Las opciones que requieren conexiones se presentan como proyectos de implementación: no activan integraciones ni ejecutan tareas por sí solas. Toda la experiencia y las entregas llevan la marca Mecha.

El buscador es público: el visitante puede explorar problemas y preparar su solicitud antes de registrarse. Al enviar, entra o crea su cuenta y registra el negocio; el borrador se conserva en memoria durante ese proceso y vuelve al buscador para revisión. No se envía automáticamente. Puede adjuntar hasta ocho archivos: Excel, CSV, Word, PDF, presentaciones, XML, imágenes, audio, video, texto o ZIP. Los pedidos nuevos se guardan en **Solicitud recibida**, con un resultado esperado opcional. Mecha cotiza alcance, exclusiones, monto confirmado en MXN, plazo, costos externos y rondas de ajustes. El cliente acepta explícitamente la versión vigente para pasar a **En proceso**. Cambiar una propuesta exige nueva aceptación. Los pedidos previos conservan su flujo y estado. Los datos persisten al cerrar el navegador o reiniciar.

Mecha revisa los pedidos en una bandeja privada, consulta el contexto del negocio y descarga los originales. Puede pedir información; el cliente responde y adjunta archivos dentro del mismo pedido. El servidor impide iniciar o publicar pedidos nuevos sin aprobación. Al publicar archivos, un enlace o contenido, el estado cambia a **Entregado**. El cliente puede revisar y descargar la entrega. El cliente puede registrar el resultado observado con sus fuentes y periodo, o indicar que todavía no lo conoce. Los ajustes de productos entregados crean un pedido vinculado y requieren acordar su alcance.

La página abierta consulta cambios cada cinco segundos para el pedido y cada diez segundos para el historial o la bandeja. Al regresar, el historial vuelve a consultar el servidor. No se envían correos, WhatsApps ni notificaciones fuera de la app. La operación muestra “Pendiente avisar” al entregar. Incluye un enlace privado y permite registrar la confirmación de que Mecha avisó personalmente; no demuestra envío ni lectura. Cada republicación deja el aviso pendiente otra vez. Los enlaces locales se identifican para evitar compartirlos como si fueran públicos.

## Acceso de administrador

```sh
bun run admin leo0503@outlook.com
```

Si el correo ya tiene cuenta, el comando local habilita el rol administrador. Si todavía no tiene cuenta, crea una invitación privada de un solo uso, ligada al correo y válida durante siete días. El enlace se guarda en `data/acceso-mecha.json` con permisos de lectura restringidos. Ábrelo en el navegador para elegir tu contraseña. El enlace deja de funcionar después de crear la cuenta. No compartas ese archivo ni lo subas a Git.

Si olvidas tu contraseña de operador: `bun run admin leo0503@outlook.com --restablecer` guarda en `data/acceso-mecha.json` un enlace de un solo uso (48 h) para elegir una nueva.

Los registros públicos siempre son clientes. Escribir el correo del administrador o enviar un campo `role` no concede permisos. El rol se revisa en el servidor en cada solicitud.

## Recuperar la cuenta de un cliente

No hay correos automáticos. Si un cliente olvida su contraseña, abre cualquiera de sus pedidos en `/operacion` → “¿El cliente olvidó su contraseña?” → **Generar enlace**. El enlace es de un solo uso, vence en 48 horas y se copia al portapapeles; envíaselo tú por el canal que ya usan. Al elegir la nueva contraseña se cierran todas sus sesiones abiertas. Generar otro enlace invalida el anterior. Desde el panel no se pueden restablecer cuentas de operador.

## Entregas y límites

- Adjuntos del cliente: hasta ocho por mensaje y 8 MB por archivo; los archivos originales se conservan sin cambios. No se analizan automáticamente. Los adjuntos que se subieron pero nunca se enviaron en un pedido o mensaje se borran después de 24 horas (al arrancar y cada hora).
- Publicación de Mecha: hasta ocho archivos y 20 MB en total; máximo dieciséis archivos por pedido. Las publicaciones adicionales agregan archivos a la entrega existente.
- Formatos de entrega: hojas de cálculo, documentos, presentaciones, PDF, HTML, texto, XML, ZIP, imágenes, video y audio. Las entregas grandes pueden usar un enlace.
- Los archivos solo se habilitan para el cliente cuando el pedido está entregado. Regresarlo a proceso oculta la entrega hasta volver a publicarla.
- El HTML conserva el original descargable. La vista previa utiliza una copia sin scripts, con sandbox y restricciones de recursos. Para sitios con JavaScript o recursos externos, entrega un enlace o un ZIP.
- El contexto del negocio se guarda al pedir el producto. Los cambios posteriores al perfil aplican a nuevos pedidos.
- Solo se pueden eliminar pedidos entregados. Los adjuntos compartidos con otros pedidos se conservan.

## Datos y verificación

Bun sirve el frontend y la API; SQLite guarda cuentas, sesiones, negocios, pedidos, mensajes y metadatos. Los archivos viven en `data/files/`. El comando de respaldo usa `VACUUM INTO`, copia los archivos referidos en esa instantánea y crea un manifiesto con hashes SHA-256. Una copia fallida queda sin manifiesto de completitud. `data/`, las claves y las pruebas locales están excluidos de Git.

```sh
bun test
bun run format
bun run build
```

Las pruebas cubren recuperación de contraseña, respuesta idéntica ante correo inexistente o contraseña incorrecta, aislamiento entre clientes, acceso de operador, invitaciones, CSRF, persistencia después de reiniciar, aclaraciones, publicación, concurrencia, archivos originales, vistas previas y eliminación con adjuntos compartidos.

Esta instalación corre en localhost. Para compartirla con clientes falta desplegarla en un servidor con HTTPS, configurar `APP_ORIGIN` y `COOKIE_SECURE=true`, y preparar respaldos. La app no incluye cobros ni presupuestos automáticos. Aceptar la propuesta no significa que se haya pagado. También faltan verificación de correo, roles por empresa y completar el aviso de privacidad con datos reales; consulta [venta y riesgos](docs/VENTA_Y_RIESGOS.md).

## Entrada desde redes

Los enlaces `/?problema=whatsapp`, `/?problema=quotes`, `/?problema=data` y `/?problema=web` llenan una solicitud relacionada con el síntoma. Cambia localhost por el dominio público cuando exista; seleccionar un problema no conecta redes ni envía el pedido. No hay analítica de atribución completa.

## Respaldos y recuperación

```sh
bun run backup
bun run backup verify /ruta/absoluta/al/respaldo
```

El respaldo contiene datos privados y credenciales derivadas; no se debe publicar ni subir a Git. Por defecto se guarda en `backups/`; `BACKUP_DIR` permite elegir otra ubicación autorizada. No está programado ni se copia automáticamente fuera de la Mac. Un respaldo en el mismo disco no protege ante pérdida del equipo.

Para ensayar recuperación, verifica el manifiesto, copia el respaldo a un directorio de datos **nuevo** y arranca una instancia aislada con `DATA_DIR` y otro puerto. En una recuperación real, detener el servicio, verificar integridad, invalidar las sesiones restauradas (`DELETE FROM sessions` en la base recuperada) y revisar cuentas/permisos antes de habilitar acceso. Conservar la base anterior hasta comprobar archivos, propuestas y pedidos; no sobrescribir datos de producción sin revisión.

La herramienta respalda el conjunto SQLite + archivos; no incluye la invitación de administrador, configuración de entorno ni otros secretos externos. Los usuarios y roles existentes están dentro de la base. Las pruebas incluyen una restauración sintética y detección de corrupción. No se afirma recuperación de la infraestructura de producción.
