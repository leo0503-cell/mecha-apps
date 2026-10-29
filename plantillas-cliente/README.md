# Plantillas de entregable — Mecha

Base para arrancar un proyecto de cliente en minutos:

```bash
mecha nuevo-cliente "Tableros Bonaterra"
# → ~/Developer/mecha-clientes/tableros-bonaterra/  (git init hecho)
```

Cada plantilla es un proyecto `uv` independiente (`uv sync`, `uv run ...`).

| Carpeta | Entregable | Estado |
|---|---|---|
| `bot-whatsapp/` | Auto-respuesta + ruteo de intención + handoff a humano (Meta Cloud API) | skeleton |
| `generador-reportes/` | Reporte mensual branded (CSV de métricas → HTML/PDF) | funcional |
| `scraper-cotizaciones/` | Lista de precios (xlsx/csv) → PDF de cotización | skeleton |

## Convenciones
- Datos del cliente y credenciales en `.env` (nunca al repo).
- Lo que falte por confirmar con el cliente va entre `<corchetes>`.
- Marca del cliente en `marca.toml` (colores, logo, tono).
- `uv run pytest` antes de entregar.
