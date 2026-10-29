from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from relevo.cli import procesar
from relevo.demo import generar
from relevo.estados import evaluar
from relevo.fichas import ExtractorDeterminista
from relevo.guia import cargar_guia
from relevo.modelos import Fuente, Practica, Validacion
from relevo.transcripciones import Insumos, cargar, leer_transcripcion

PROYECTO = Path(__file__).resolve().parents[1]


class CasosRelevo(unittest.TestCase):
    def setUp(self):
        raiz = PROYECTO / ".pruebas-tmp"
        raiz.mkdir(exist_ok=True)
        self.temporal = tempfile.TemporaryDirectory(dir=raiz)
        self.addCleanup(self.temporal.cleanup)
        self.base = Path(self.temporal.name) / "datos"
        generar(self.base)
        self.salida = procesar(self.base)
        self.fichas = {f["id"]: f for f in self.salida["fichas"]}
        self.guia = cargar_guia()

    def ficha_cruda(self, pid):
        insumos = cargar(self.base)
        fichas = ExtractorDeterminista().extraer(insumos.fragmentos, self.guia, [])
        return next(f for f in fichas if f.id == pid)

    def validacion(self, ficha, tipo="experto", version=1, fecha="2026-01-01"):
        return Validacion(
            fecha, ficha, tipo, "Persona Ficticia", version, Fuente("v.csv", 2)
        )

    def practica(self, ficha, calificacion, correccion="", fecha="2026-01-02"):
        return Practica(
            fecha,
            ficha,
            "Sucesor Ficticio",
            "respuesta",
            calificacion,
            correccion,
            Fuente("p.csv", 2),
        )

    def test_parser_conserva_fuente_y_minuto(self):
        insumos = Insumos()
        ruta = Path(self.temporal.name) / "t.txt"
        ruta.write_text(
            "# experto: Alguien\n\n[P:senales-01] [04:10] señal: Ruido raro\n",
            encoding="utf-8",
        )
        leer_transcripcion(ruta, insumos)
        fragmento = insumos.fragmentos[0]
        self.assertEqual(fragmento.campo, "senal")
        self.assertEqual(fragmento.fuente.linea, 3)
        self.assertEqual(fragmento.fuente.minuto, "04:10")
        self.assertEqual(insumos.metadatos["experto"], "Alguien")

    def test_linea_sin_formato_genera_aviso(self):
        insumos = Insumos()
        ruta = Path(self.temporal.name) / "t.txt"
        ruta.write_text("texto suelto\n[P:senales-01] [04:10] color: x\n", "utf-8")
        leer_transcripcion(ruta, insumos)
        self.assertEqual(len(insumos.avisos), 2)
        self.assertFalse(insumos.fragmentos)

    def test_no_vigente_sin_practica_correcta(self):
        ficha = self.ficha_cruda("decisiones-01")
        r = evaluar(ficha, self.guia, [self.validacion(ficha.id)], [])
        self.assertEqual(r["estado"], "validada por experto")
        r = evaluar(
            ficha,
            self.guia,
            [self.validacion(ficha.id)],
            [self.practica(ficha.id, "parcial")],
        )
        self.assertEqual(r["estado"], "practicada")

    def test_no_vigente_sin_validacion_del_experto(self):
        ficha = self.ficha_cruda("decisiones-01")
        r = evaluar(ficha, self.guia, [], [self.practica(ficha.id, "correcto")])
        self.assertEqual(r["estado"], "borrador")

    def test_correccion_regresa_estado_y_sube_version(self):
        ficha = self.ficha_cruda("decisiones-01")
        r = evaluar(
            ficha,
            self.guia,
            [self.validacion(ficha.id)],
            [
                self.practica(ficha.id, "correcto", fecha="2026-01-02"),
                self.practica(ficha.id, "incorrecto", "Nueva forma", "2026-01-03"),
            ],
        )
        self.assertEqual(r["version"], 2)
        self.assertEqual(r["estado"], "validada por experto")
        self.assertEqual(r["decision_vigente"], "Nueva forma")
        # La práctica correcta de la versión 1 ya no cuenta.
        r = evaluar(
            ficha,
            self.guia,
            [self.validacion(ficha.id)],
            [
                self.practica(ficha.id, "incorrecto", "Nueva forma", "2026-01-03"),
                self.practica(ficha.id, "correcto", fecha="2026-01-04"),
            ],
        )
        self.assertEqual(r["estado"], "vigente")

    def test_validacion_de_version_vieja_no_cuenta(self):
        ficha = self.ficha_cruda("decisiones-01")
        r = evaluar(
            ficha,
            self.guia,
            [self.validacion(ficha.id, version=2)],
            [self.practica(ficha.id, "correcto")],
        )
        self.assertEqual(r["estado"], "borrador")
        self.assertTrue(r["avisos"])

    def test_seguridad_sin_responsable_no_queda_vigente(self):
        ficha = self.ficha_cruda("senales-02")
        self.assertIn("seguridad", ficha.marcas)
        validaciones = [self.validacion(ficha.id)]
        practicas = [self.practica(ficha.id, "correcto")]
        r = evaluar(ficha, self.guia, validaciones, practicas)
        self.assertEqual(r["estado"], "practicada")
        self.assertTrue(any("responsable" in f for f in r["faltantes"]))
        validaciones.append(self.validacion(ficha.id, tipo="responsable"))
        r = evaluar(ficha, self.guia, validaciones, practicas)
        self.assertEqual(r["estado"], "vigente")

    def test_demo_estados_esperados(self):
        estados = {k: v["estado"] for k, v in self.fichas.items()}
        self.assertEqual(estados["decisiones-01"], "vigente")
        self.assertEqual(estados["decisiones-02"], "vigente")
        self.assertEqual(estados["decisiones-03"], "validada por experto")
        self.assertEqual(self.fichas["decisiones-03"]["version"], 2)
        self.assertEqual(estados["senales-02"], "practicada")
        self.assertEqual(estados["limites-02"], "practicada")
        self.assertEqual(estados["contactos-01"], "validada por experto")
        self.assertEqual(estados["trucos-02"], "borrador")

    def test_cobertura_cuenta_vigentes(self):
        total = sum(c["total"] for c in self.salida["cobertura"])
        vigentes = sum(c["vigentes"] for c in self.salida["cobertura"])
        self.assertEqual(total, len(self.fichas))
        self.assertEqual(vigentes, self.salida["conteo_por_estado"]["vigente"])
        decisiones = next(
            c for c in self.salida["cobertura"] if c["categoria"] == "decisiones"
        )
        self.assertEqual((decisiones["vigentes"], decisiones["total"]), (2, 4))

    def test_manual_solo_incluye_vigentes(self):
        manual = (self.base / "salida" / "manual.md").read_text(encoding="utf-8")
        cuerpo, pendientes = manual.split("## Pendientes de transferir")
        self.assertIn("`decisiones-01`", cuerpo)
        self.assertNotIn("`senales-02`", cuerpo)
        self.assertIn("`senales-02`", pendientes)

    def test_salidas_generadas(self):
        carpeta = self.base / "salida"
        mapa = (carpeta / "mapa.html").read_text(encoding="utf-8")
        self.assertNotIn("__DATOS_RELEVO__", mapa)
        datos = json.loads((carpeta / "relevo.json").read_text(encoding="utf-8"))
        self.assertTrue(datos["demostracion"])
        self.assertFalse(datos["avisos"])
        self.assertTrue((carpeta / "ejercicios.md").exists())

    def test_cada_dato_tiene_fuente(self):
        for ficha in self.fichas.values():
            for datos in ficha["campos"].values():
                for dato in datos:
                    self.assertRegex(dato["fuente"], r"línea \d+")


def test_csv_malformado_y_firma_vacia_no_validan(tmp_path):
    from relevo.transcripciones import Insumos, leer_practicas, leer_validaciones

    archivo = tmp_path / "validaciones.csv"
    archivo.write_text(
        "Fecha,ficha,tipo,nombre,version\n2026-10-14,decisiones-01,experto,,1\n2026-10-14,decisiones-01,experto,Persona,1,extra\n2026-10-14,decisiones-01,experto,Persona,1\n",
        encoding="utf-8-sig",
    )
    insumos = Insumos()
    leer_validaciones(archivo, insumos)
    assert len(insumos.validaciones) == 1
    assert len(insumos.avisos) == 2
    archivo.write_text(
        "fecha,ficha,sucesor,respuesta,calificacion\n2026-10-14,decisiones-01,,,correcto\n"
    )
    leer_practicas(archivo, insumos)
    assert not insumos.practicas
