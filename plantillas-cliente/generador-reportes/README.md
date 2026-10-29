# generador-reportes

CSV de métricas → reporte mensual branded (HTML → PDF).

```bash
uv sync
uv run src/generar.py ejemplos/metricas.csv --cliente "Tableros Bonaterra"
```

CSV: `fecha,metrica,valor,meta` (una fila por corte; `meta` opcional y se toma la primera).
Color de marca en `marca.toml`. Abre `reporte.html` y ⌘P → PDF.

El CSV admite BOM de Excel y encabezados en mayúsculas. Las fechas deben poder convertirse a ISO; las entradas inválidas se rechazan. Los valores vacíos muestran `<sin datos completos>` y no se sustituyen por cero. Metas contradictorias se rechazan; una meta de cero se distingue de una meta faltante. `--sin-abrir` evita abrir el navegador.

Este reporte **suma métricas aditivas** (mensajes, pedidos, unidades). No sumar tasas, CTR, porcentajes ni promedios. `meta` representa la meta del periodo completo y debe ser consistente en sus filas. El color de marca requiere formato hexadecimal. Toda entrada se escapa antes de insertarse en HTML.
