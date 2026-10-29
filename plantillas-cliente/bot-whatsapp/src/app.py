"""Webhook de WhatsApp: verifica, clasifica intención y responde o escala.

    uv run uvicorn src.app:app --reload --port 8000

Falta por cliente: catálogo de respuestas, reglas de negocio, y conectar
el handoff real (hoy solo notifica). Todo lo pendiente va entre <corchetes>.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import re
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic_settings import BaseSettings, SettingsConfigDict


class Cfg(BaseSettings):
    wa_verify_token: str = ""
    wa_app_secret: str = ""
    wa_access_token: str = ""
    wa_phone_number_id: str = ""
    handoff_numero: str = ""
    wa_receipts_path: str = "data/recepciones.sqlite3"

    model_config = SettingsConfigDict(env_file=".env")


LOGGER = logging.getLogger(__name__)
cfg = Cfg()


@asynccontextmanager
async def ciclo_vida(app):
    if cfg.wa_access_token:
        if not cfg.wa_verify_token or not cfg.wa_app_secret or not cfg.wa_phone_number_id:
            raise ValueError("Configura WA_VERIFY_TOKEN, WA_APP_SECRET y WA_PHONE_NUMBER_ID")
        if cfg.wa_verify_token == "cambia-esto" or any(
            re.search(r"<[^>]+>", valor)
            for valor in (
                cfg.wa_verify_token,
                cfg.wa_app_secret,
                cfg.wa_access_token,
                cfg.wa_phone_number_id,
            )
        ):
            raise ValueError("Completa las credenciales de WhatsApp")
        if any(re.search(r"<[^>]+>", texto) for _, texto in REGLAS):
            raise ValueError("Completa REGLAS antes de activar el bot real")
    yield


app = FastAPI(title="bot-whatsapp · Mecha", lifespan=ciclo_vida)
CANDADO = asyncio.Lock()

GRAPH = "https://graph.facebook.com/v21.0"

# --- ruteo de intención (ajústalo por cliente) -----------------------
REGLAS: list[tuple[str, str]] = [
    (
        r"\b(precio|cuánto|cotiza|cotización)\b",
        "Con gusto te paso una cotización. ¿Qué producto y qué cantidad necesitas?",
    ),
    (
        r"\b(horario|abren|cierran|ubicación|dónde)\b",
        "Estamos en <dirección> de <horario>. Te esperamos.",
    ),
    (r"\b(envío|entrega|mandan)\b", "Sí hacemos envíos a <zona>. El costo depende del volumen."),
    (
        r"\b(hola|buenas|buenos días|buenas tardes)\b",
        "¡Hola! Soy el asistente de <cliente>. ¿En qué te ayudo?",
    ),
]
ESCALA = re.compile(r"\b(humano|persona|asesor|reclamo|queja|urgente)\b", re.IGNORECASE)


def responder_texto(mensaje: str) -> tuple[str, bool]:
    """Devuelve (respuesta, requiere_handoff)."""
    if ESCALA.search(mensaje):
        return ("En un momento te contacta una persona del equipo.", True)
    for patron, resp in REGLAS:
        if re.search(patron, mensaje, re.IGNORECASE):
            return (resp, False)
    return ("Gracias por tu mensaje. Un asesor te responde en breve.", True)


async def enviar(destino: str, texto: str) -> None:
    if not cfg.wa_access_token:
        LOGGER.info("Modo de prueba: mensaje no enviado")
        return
    if re.search(r"<[^>]+>", texto):
        raise ValueError("Completa las respuestas del cliente antes de enviar")
    if not cfg.wa_phone_number_id:
        raise ValueError("Falta WA_PHONE_NUMBER_ID")
    async with httpx.AsyncClient(timeout=10) as c:
        respuesta = await c.post(
            f"{GRAPH}/{cfg.wa_phone_number_id}/messages",
            headers={"Authorization": f"Bearer {cfg.wa_access_token}"},
            json={
                "messaging_product": "whatsapp",
                "to": destino,
                "type": "text",
                "text": {"body": texto},
            },
        )

        respuesta.raise_for_status()


@app.get("/webhook")
def verificar(request: Request):
    p = request.query_params
    if (
        cfg.wa_verify_token
        and p.get("hub.mode") == "subscribe"
        and hmac.compare_digest(
            p.get("hub.verify_token", "").encode(), cfg.wa_verify_token.encode()
        )
    ):
        return Response(p.get("hub.challenge", ""), media_type="text/plain")
    return Response(status_code=403)


@app.post("/webhook")
async def entrante(request: Request):
    if not cfg.wa_app_secret:
        raise HTTPException(503, "Falta configurar WA_APP_SECRET")
    crudo = await request.body()
    firma = "sha256=" + hmac.new(cfg.wa_app_secret.encode(), crudo, hashlib.sha256).hexdigest()
    recibida = request.headers.get("X-Hub-Signature-256", "")
    if not re.fullmatch(r"sha256=[0-9a-f]{64}", recibida) or not hmac.compare_digest(
        firma, recibida
    ):
        raise HTTPException(403, "Firma inválida")
    try:
        body = json.loads(crudo)
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(400, "JSON inválido") from None
    if not isinstance(body, dict) or not isinstance(body.get("entry", []), list):
        raise HTTPException(400, "Evento inválido")
    mensajes = []
    try:
        for entry in body.get("entry", []):
            for cambio in entry.get("changes", []):
                for msg in cambio.get("value", {}).get("messages", []):
                    if not isinstance(msg, dict):
                        raise ValueError("Mensaje inválido")
                    # Una imagen o un audio no es un pedido vacío de texto.
                    if msg.get("type") != "text":
                        continue
                    de = msg.get("from")
                    identificador = msg.get("id")
                    if not isinstance(identificador, str) or not identificador:
                        raise ValueError("Falta el identificador del mensaje")
                    texto = msg.get("text", {}).get("body")
                    if not isinstance(de, str) or not re.fullmatch(r"[0-9]{6,20}", de):
                        raise ValueError("Remitente inválido")
                    if not isinstance(texto, str) or not texto.strip():
                        raise ValueError("Texto inválido")
                    mensajes.append((identificador, de, texto))
    except (AttributeError, TypeError, ValueError):
        raise HTTPException(400, "Evento inválido") from None
    # Un worker. Registra cada etapa confirmada antes de pasar al siguiente envío.
    # Si Meta reintenta un lote, no repite las etapas que ya respondieron con éxito.
    async with CANDADO:
        ruta = Path(cfg.wa_receipts_path)
        ruta.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(ruta) as db:
            ruta.chmod(0o600)
            db.execute(
                "CREATE TABLE IF NOT EXISTS recibos (id TEXT PRIMARY KEY, respuesta INTEGER NOT NULL DEFAULT 0, aviso INTEGER NOT NULL DEFAULT 0)"
            )
            try:
                for identificador, de, texto in mensajes:
                    clave = hashlib.sha256(identificador.encode()).hexdigest()
                    db.execute("INSERT OR IGNORE INTO recibos (id) VALUES (?)", (clave,))
                    db.commit()
                    respondido, avisado = db.execute(
                        "SELECT respuesta, aviso FROM recibos WHERE id=?", (clave,)
                    ).fetchone()
                    respuesta, handoff = responder_texto(texto)
                    if not respondido:
                        await enviar(de, respuesta)
                        db.execute("UPDATE recibos SET respuesta=1 WHERE id=?", (clave,))
                        db.commit()
                    if handoff and cfg.handoff_numero and not avisado:
                        await enviar(cfg.handoff_numero, f"Escalar: {de} escribió «{texto[:120]}»")
                        db.execute("UPDATE recibos SET aviso=1 WHERE id=?", (clave,))
                        db.commit()
            except (httpx.HTTPError, ValueError):
                LOGGER.warning("WhatsApp rechazó el envío o no está disponible")
                raise HTTPException(502, "No se pudo enviar; Meta puede reintentar") from None
    return {"ok": True}
