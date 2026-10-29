# scraper-cotizaciones

Lista de precios (xlsx/csv) → cotización imprimible a PDF.

```bash
uv sync
uv run src/cotizar.py --precios ejemplos/precios.csv \
  --pedir "melamina blanca 18:10, mdf 18:4, canto blanco:50" \
  --cliente "Carpintería <nombre>"
```

Abre `cotizacion.html` y ⌘P → Guardar como PDF.

## Ajustar por cliente
- `--iva <porcentaje confirmado>` y `--vigencia "<vigencia confirmada>"`. Sin IVA confirmado, el total queda pendiente.
- Encabezado con logo y datos fiscales del cliente.
- Si la lista de precios vive en una web, agrega aquí el scraper (requests + selectolax).

Los importes usan Decimal y redondeo a centavos. Una búsqueda ambigua exige SKU; un precio vacío, negativo o no finito se rechaza. Cero explícito es válido. Si faltan productos se genera una cotización incompleta sin total y el comando termina con código 1. Los precios siguen siendo orientativos hasta confirmarlos. `--sin-abrir` permite ejecutarlo sin abrir el navegador.
