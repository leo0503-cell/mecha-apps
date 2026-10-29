import hashlib
import hmac
import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from src import app as bot

client = TestClient(bot.app)


@pytest.fixture(autouse=True)
def aislamiento(tmp_path):
    with (
        patch.object(bot.cfg, "wa_receipts_path", str(tmp_path / "recibos.sqlite3")),
        patch.object(bot.cfg, "handoff_numero", ""),
    ):
        yield


def firmado(body):
    raw = json.dumps(body).encode()
    firma = "sha256=" + hmac.new(b"secreto-ficticio", raw, hashlib.sha256).hexdigest()
    return raw, {"X-Hub-Signature-256": firma}


def evento(mensajes):
    return {"entry": [{"changes": [{"value": {"messages": mensajes}}]}]}


def test_sin_firma_o_secreto_no_envia():
    with (
        patch.object(bot.cfg, "wa_app_secret", ""),
        patch.object(bot, "enviar", new_callable=AsyncMock) as enviar,
    ):
        assert client.post("/webhook", json={}).status_code == 503
        enviar.assert_not_awaited()
    with patch.object(bot.cfg, "wa_app_secret", "secreto-ficticio"):
        assert client.post("/webhook", json={}).status_code == 403


def test_verificacion_no_acepta_token_default():
    with patch.object(bot.cfg, "wa_verify_token", ""):
        assert (
            client.get("/webhook?hub.mode=subscribe&hub.verify_token=&hub.challenge=x").status_code
            == 403
        )
    with patch.object(bot.cfg, "wa_verify_token", "token-ficticio"):
        r = client.get(
            "/webhook?hub.mode=subscribe&hub.verify_token=token-ficticio&hub.challenge=x"
        )
        assert r.status_code == 200
        assert r.text == "x"


def test_lote_completo_y_multimedia_no_es_texto_vacio():
    raw, headers = firmado(
        evento(
            [
                {
                    "from": "524490000001",
                    "id": "mensaje-1",
                    "type": "text",
                    "text": {"body": "Hola"},
                },
                {"from": "524490000002", "type": "image"},
                {
                    "from": "524490000003",
                    "id": "mensaje-2",
                    "type": "text",
                    "text": {"body": "Precio"},
                },
            ]
        )
    )
    with (
        patch.object(bot.cfg, "wa_app_secret", "secreto-ficticio"),
        patch.object(bot, "enviar", new_callable=AsyncMock) as enviar,
    ):
        assert client.post("/webhook", content=raw, headers=headers).status_code == 200
        assert enviar.await_count == 2


def test_eventos_malformados_no_cierran_servidor():
    for body in [
        [],
        {"entry": [None]},
        evento([{"type": "text", "from": "abc", "text": {"body": "hola"}}]),
    ]:
        raw, headers = firmado(body)
        with (
            patch.object(bot.cfg, "wa_app_secret", "secreto-ficticio"),
            patch.object(bot, "enviar", new_callable=AsyncMock) as enviar,
        ):
            assert client.post("/webhook", content=raw, headers=headers).status_code == 400
            enviar.assert_not_awaited()


def test_fallo_de_meta_no_se_reporta_como_envio_exitoso():
    raw, headers = firmado(
        evento(
            [{"from": "524490000001", "id": "mensaje-1", "type": "text", "text": {"body": "Hola"}}]
        )
    )
    with (
        patch.object(bot.cfg, "wa_app_secret", "secreto-ficticio"),
        patch.object(
            bot, "enviar", new_callable=AsyncMock, side_effect=httpx.ConnectError("error sintético")
        ),
    ):
        assert client.post("/webhook", content=raw, headers=headers).status_code == 502


def test_placeholders_no_salen_a_whatsapp_real():
    import asyncio

    with (
        patch.object(bot.cfg, "wa_access_token", "token-ficticio"),
        patch("httpx.AsyncClient") as cliente,
    ):
        try:
            asyncio.run(bot.enviar("524490000001", "Estamos en <dirección>"))
        except ValueError:
            pass
        else:
            raise AssertionError("Se permitió enviar un placeholder")
        cliente.assert_not_called()


def test_reintento_de_handoff_no_repite_respuesta_al_cliente():
    raw, headers = firmado(
        evento(
            [
                {
                    "id": "mensaje-handoff",
                    "from": "524490000001",
                    "type": "text",
                    "text": {"body": "asesor"},
                }
            ]
        )
    )
    enviar = AsyncMock(side_effect=[None, httpx.ConnectError("falla sintética"), None])
    with (
        patch.object(bot.cfg, "wa_app_secret", "secreto-ficticio"),
        patch.object(bot.cfg, "handoff_numero", "524490000002"),
        patch.object(bot, "enviar", enviar),
    ):
        assert client.post("/webhook", content=raw, headers=headers).status_code == 502
        assert client.post("/webhook", content=raw, headers=headers).status_code == 200
        assert client.post("/webhook", content=raw, headers=headers).status_code == 200
    assert enviar.await_count == 3
    destinos = [c.args[0] for c in enviar.await_args_list]
    assert destinos.count("524490000001") == 1


def test_token_unicode_da_403():
    with patch.object(bot.cfg, "wa_verify_token", "token-ficticio"):
        assert (
            client.get(
                "/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "á"}
            ).status_code
            == 403
        )


def test_config_incompleta_impide_arranque_real():
    with (
        patch.object(bot.cfg, "wa_access_token", "ficticio"),
        patch.object(bot.cfg, "wa_app_secret", ""),
        pytest.raises(ValueError),
        TestClient(bot.app),
    ):
        pass
