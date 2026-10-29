from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from traba.cli import procesar
from traba.demo import complemento, generar, guardar_xml, identificador
from traba.fuentes import cargar, leer_evidencia
from traba.modelos import Fuente, Registro
from traba.reglas import ESTADOS, ClasificadorDeterminista, configuracion, evaluar
from traba.vinculos import vincular

PROYECTO = Path(__file__).resolve().parents[1]


class CasosTraba(unittest.TestCase):
    def setUp(self):
        raiz = PROYECTO / ".pruebas-tmp"
        raiz.mkdir(exist_ok=True)
        self.temporal = tempfile.TemporaryDirectory(dir=raiz)
        self.addCleanup(self.temporal.cleanup)
        self.base = Path(self.temporal.name) / "datos"
        generar(self.base)
        self.insumos = cargar(self.base)
        self.responsables = configuracion(self.base)

    def factura(self, numero):
        return next(
            f
            for f in self.insumos.facturas
            if f.uuid == identificador(f"factura-{numero}")
        )

    def expediente(self, numero):
        f = self.factura(numero)
        return evaluar(f, self.insumos, vincular(f, self.insumos), self.responsables)

    def test_demo_cubre_siete_estados_y_dos_monedas(self):
        salida = procesar(self.base)
        self.assertEqual(len(salida["expedientes"]), 25)
        self.assertEqual(set(salida["conteo_por_estado"]), set(ESTADOS))
        self.assertEqual(set(salida["totales_facturados_por_moneda"]), {"MXN", "USD"})
        self.assertTrue(salida["demostracion"])
        self.assertFalse(salida["avisos"])

    def test_aceptado_sin_evidencia_no_avanza(self):
        self.insumos.evidencias = []
        self.assertNotEqual(self.expediente(13)["estado"], "aceptado")

    def test_pago_sin_complemento_no_avanza(self):
        self.insumos.pagos = []
        self.assertNotEqual(self.expediente(1)["estado"], "pago confirmado")

    def test_pago_reportado_no_equivale_a_pago_confirmado(self):
        self.assertNotEqual(self.expediente(21)["estado"], "pago confirmado")
        self.assertIn("pago por conciliar", self.expediente(21)["motivos"])

    def test_vinculo_ambiguo_no_elige_candidato(self):
        e = self.expediente(24)
        pedidos = [v for v in e["vinculos"] if v["tipo"] == "pedido"]
        self.assertEqual(len(pedidos), 2)
        self.assertTrue(all(v["nivel"] == "por confirmar" for v in pedidos))
        self.assertEqual(e["estado"], "vínculo por confirmar")

    def test_rfc_monto_unico_tambien_requiere_validacion(self):
        self.insumos.pedidos = self.insumos.pedidos[:-1]
        self.assertEqual(self.expediente(24)["estado"], "vínculo por confirmar")

    def test_uuid_equivocado_no_vincula_por_monto(self):
        f = self.factura(24)
        self.insumos.pedidos = [
            Registro(
                "ajeno",
                {
                    "uuid": identificador("factura-999"),
                    "rfc": f.receptor["Rfc"],
                    "monto": str(f.monto),
                    "moneda": f.moneda,
                },
                [],
            )
        ]
        self.assertFalse(any(v.tipo == "pedido" for v in vincular(f, self.insumos)))

    def test_complemento_sin_conciliacion_no_confirma(self):
        next(r for r in self.insumos.cartera if r.datos["folio"] == "DEMO1").datos[
            "pago_conciliado"
        ] = "no"
        self.assertNotEqual(self.expediente(1)["estado"], "pago confirmado")

    def test_conciliacion_complemento_equivocado_no_confirma(self):
        next(r for r in self.insumos.cartera if r.datos["folio"] == "DEMO1").datos[
            "complemento_uuid"
        ] = identificador("pago-999")
        self.assertNotEqual(self.expediente(1)["estado"], "pago confirmado")

    def test_pago_parcial_no_liquida(self):
        self.assertNotEqual(self.expediente(22)["estado"], "pago confirmado")

    def test_complemento_de_otro_uuid_no_vincula(self):
        self.insumos.pagos[0].documento = identificador("factura-999")
        self.assertNotEqual(self.expediente(1)["estado"], "pago confirmado")

    def test_moneda_de_pago_distinta_no_confirma(self):
        self.insumos.pagos[0].moneda = "USD"
        self.assertNotEqual(self.expediente(1)["estado"], "pago confirmado")

    def test_pago_total_conciliado_confirma(self):
        self.assertEqual(self.expediente(1)["estado"], "pago confirmado")

    def test_pago_inconsistente_no_confirma(self):
        self.insumos.pagos[0].monto += 1
        self.assertNotEqual(self.expediente(1)["estado"], "pago confirmado")

    def test_aceptacion_negada_no_se_confirma(self):
        clasificador = ClasificadorDeterminista()
        for texto in (
            "Factura no aceptada.",
            "No hay factura aceptada.",
            "¿Factura aceptada?",
            "Cuando exista factura aceptada",
            "Solicitamos factura aceptada",
        ):
            self.assertNotIn(
                "aceptacion",
                clasificador.clasificar(Fuente("e.txt", "texto", texto, 1)),
            )

    def test_nombre_de_archivo_no_acredita_aceptacion(self):
        ruta = self.base / "evidencias" / "folio_DEMO25_factura_aceptada.txt"
        ruta.write_text("Sin confirmación de la contraparte", encoding="utf-8")
        self.insumos.evidencias.append(leer_evidencia(ruta, self.base))
        self.assertNotEqual(self.expediente(25)["estado"], "aceptado")

    def test_clasificador_futuro_no_fabrica_aceptacion(self):
        class Inventor:
            def clasificar(self, fuente):
                return {"aceptacion"}

        f = self.factura(4)
        e = evaluar(
            f, self.insumos, vincular(f, self.insumos), self.responsables, Inventor()
        )
        self.assertNotEqual(e["estado"], "aceptado")

    def test_oc_y_monto_discrepantes(self):
        self.assertIn("pedido no coincide", self.expediente(9)["motivos"])
        self.assertIn("monto distinto", self.expediente(11)["motivos"])

    def test_fuentes_linea_y_campo_en_json(self):
        procesar(self.base)
        salida = json.loads((self.base / "salida/expedientes.json").read_text())
        e = next(e for e in salida["expedientes"] if e["folio"] == "DEMO13")
        self.assertTrue(
            any(f["linea"] for h in e["hechos_confirmados"] for f in h["fuentes"])
        )
        self.assertTrue(any(f["campo"] == "Comprobante/@Total" for f in e["fuentes"]))

    def test_html_autocontenido_y_escapa_cierre_de_script(self):
        ruta = self.base / "xml/factura-13.xml"
        contenido = ruta.read_text().replace(
            "Cliente Inventado Tornillo Lunar",
            "&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;",
        )
        ruta.write_text(contenido)
        procesar(self.base)
        html = (self.base / "salida/bandeja.html").read_text()
        self.assertNotIn("<script src=", html)
        self.assertNotIn("<link ", html)
        self.assertNotIn("__DATOS_TRABA__", html)
        self.assertNotIn("</script><img", html)
        self.assertIn("\\u003c/script>", html)

    def test_personalizar_responsables(self):
        (self.base / "config.toml").write_text(
            '[responsables]\n"falta acuse de entrega" = "Logística ficticia"\n'
        )
        self.responsables = configuracion(self.base)
        self.assertEqual(self.expediente(4)["responsable"], "Logística ficticia")

    def test_xml_invalido_no_interrumpe_lote(self):
        (self.base / "xml/roto.xml").write_text("<no>")
        salida = procesar(self.base)
        self.assertEqual(len(salida["expedientes"]), 25)
        self.assertTrue(salida["avisos"])

    def test_uuid_duplicado_no_elige_version(self):
        (self.base / "xml/repetido.xml").write_bytes(
            (self.base / "xml/factura-01.xml").read_bytes()
        )
        insumos = cargar(self.base)
        self.assertFalse(
            any(f.uuid == identificador("factura-1") for f in insumos.facturas)
        )
        self.assertTrue(insumos.avisos)

    def test_demo_no_sobrescribe_carpeta_ajena(self):
        otra = Path(self.temporal.name) / "ajena"
        otra.mkdir()
        (otra / "documento.txt").write_text("Conservar")
        with self.assertRaises(ValueError):
            generar(otra)
        self.assertEqual((otra / "documento.txt").read_text(), "Conservar")

    def test_parser_complemento_20_conserva_fuente(self):
        from decimal import Decimal

        from traba.cfdi import leer_cfdi

        ruta = self.base / "xml/extra.xml"
        guardar_xml(ruta, complemento(25, Decimal("123.45"), "USD"))
        factura, pagos = leer_cfdi(ruta)
        self.assertIsNone(factura)
        self.assertEqual(pagos[0].documento, identificador("factura-25"))
        self.assertEqual(pagos[0].monto, Decimal("123.45"))
        self.assertTrue(any("IdDocumento" in f.campo for f in pagos[0].fuentes))


if __name__ == "__main__":
    unittest.main()


def test_dtd_utf16_no_evade_validacion(tmp_path):
    import pytest

    from traba.cfdi import leer_cfdi

    archivo = tmp_path / "entidad.xml"
    archivo.write_bytes(
        (
            '<?xml version="1.0" encoding="UTF-16"?>'
            '<!DOCTYPE x [<!ENTITY a "dato">]><x>&a;</x>'
        ).encode("utf-16")
    )
    with pytest.raises(ValueError, match="entidades o DTD"):
        leer_cfdi(archivo)
