# Traba, por Mecha

Cada factura detenida, con su motivo, evidencia y siguiente responsable.
MVP local, determinista y sin llaves de API. Todos los datos de la demo son ficticios;
los XML de demostración no tienen validez fiscal.

Requiere Python 3.12 y uv. Desde esta carpeta:

```sh
export UV_CACHE_DIR="$PWD/.uv-cache"
export TMPDIR="$PWD/.tmp"
mkdir -p "$TMPDIR"
uv run traba demo && uv run traba procesar demo/datos
open demo/datos/salida/bandeja.html
```

La salida queda dentro de la entrada: `demo/datos/salida/expedientes.json` y
`demo/datos/salida/bandeja.html`. La bandeja funciona sin red y también en celular.
No envía correos, cambia el ERP ni recalcula saldos. Cada conclusión conserva archivo
y campo o línea; una coincidencia de RFC y monto siempre queda por confirmar.

Para otra carpeta: `uv run traba procesar <carpeta>`. Usa XML CFDI 4.0 en `xml/`
(o subcarpetas), `cartera.csv`, `pedidos.csv` y `evidencias/` con TXT, EML o PDF con
texto extraíble. PDF escaneado requiere OCR externo y revisión; un nombre de archivo
no acredita aceptación. Las frases reconocidas aparecen en `ClasificadorDeterminista`.
La interfaz `Clasificador` permite proponer señales con un modelo futuro, pero las
reglas vuelven a validar los eventos positivos de forma determinista.

CSV en UTF-8, encabezados en minúsculas. Cartera: `uuid,folio,rfc,monto,moneda,saldo,
vencimiento,pago_conciliado,complemento_uuid,referencia_conciliacion`. Pedidos:
`uuid,folio,oc,rfc,monto,moneda`. UUID es preferente; folio incluye la serie si existe.
Montos decimales sin separador de miles. Vencimiento contractual en `AAAA-MM-DD`.
OC en XML se lee de `Addenda/OrdenCompra/@Numero` cuando el cliente lo aporta.
También se vinculan documentos por OC y referencias explícitas en evidencia.
La evidencia afirmativa debe mencionar UUID, folio u OC en su contenido y una frase
como “Acuse de entrega firmado”, “Factura aceptada” o “Expediente recibido”.

“Pago confirmado” exige `DoctoRelacionado/@IdDocumento` correspondiente, moneda y
montos consistentes de liquidación total, más cartera con `pago_conciliado=si`,
el UUID del complemento y una `referencia_conciliacion` documentada.
Un pago parcial permanece por conciliar. La ausencia de REP no demuestra impago.
Los totales muestran importes facturados por moneda, sin convertirlos.

Copia [config.toml](src/traba/config.toml) a la carpeta de entrada para personalizar
responsables por motivo. Cada ejecución reemplaza únicamente sus dos salidas;
`traba demo` protege carpetas sin el marcador de demostración.

Verificación (pytest requiere agregarlo como dependencia de desarrollo):

```sh
uv add --dev pytest
uv run pytest
uv run ruff format .
uv run ruff check .
# Alternativa sin descargar pytest: misma suite de casos, ejecutor estándar.
uv run python -m unittest discover -s tests -v
```

Antes de un piloto: autorizaciones y procedencia de documentos, acceso y conservación,
validación humana de uniones y aceptación, conciliación contable, historial de decisiones,
adaptadores de los formatos del cliente, OCR, pagos múltiples/parciales y notas de crédito.
No consulta SAT ni valida sellos/cancelaciones; falta definir los controles de seguridad
y medir una línea base con el cliente. Sin promesa de recuperación de dinero.
