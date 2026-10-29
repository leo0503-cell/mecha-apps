# bot-whatsapp

Auto-respuesta + ruteo de intención + aviso de handoff sobre la **Meta WhatsApp Cloud API**.

## Arranque
```bash
cp .env.example .env      # llena los <corchetes>
uv sync
uv run uvicorn src.app:app --reload --port 8000
```
Expón el puerto (ngrok / cloudflared) y registra `https://.../webhook` en la app de Meta
con el mismo `WA_VERIFY_TOKEN`.

## Qué ajustar por cliente
- `REGLAS` y `ESCALA` en `src/app.py` — el catálogo de respuestas.
- Handoff real (hoy solo manda un WhatsApp de aviso al `HANDOFF_NUMERO`).
- Persistencia de conversaciones si el cliente la pide (hoy es stateless).

## Test
```bash
uv run pytest
```

## Controles de recepción

Configura `WA_APP_SECRET`: cada POST verifica la firma HMAC-SHA256 sobre el cuerpo original. Sin secreto responde 503; con firma inválida responde 403. El handshake requiere un token configurado. Con un token de envío real, el arranque rechaza credenciales incompletas y respuestas con `<corchetes>`.

El bot recorre todos los mensajes de texto del lote y verifica los errores HTTP de Meta. Los eventos multimedia e interactivos se omiten: esta plantilla todavía no los interpreta. El aviso al asesor no equivale a una transferencia de conversación.

`data/recepciones.sqlite3` guarda el hash del ID y las etapas de respuesta y aviso confirmadas. Conserva ese archivo al reiniciar y corre **un solo worker**. Un reintento no repite etapas confirmadas. Una interrupción entre el envío remoto y su registro local todavía puede producir un duplicado; no se promete entrega exactamente una vez. Hace falta definir retención, cola y recuperación antes de operar a escala.

Firma implementada conforme al [ejemplo oficial de Meta](https://github.com/fbsamples/whatsapp-api-examples/tree/main/signature-validation-with-webhooks-payloads). Las pruebas usan mensajes ficticios y envíos simulados.
