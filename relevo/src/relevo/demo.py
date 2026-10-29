"""Datos ficticios para demostrar Relevo. Ninguna persona ni empresa es real."""

from __future__ import annotations

from pathlib import Path

ENCABEZADO = """# empresa: Moldeados Ficticios del Centro (empresa inventada)
# puesto: Jefatura de mantenimiento de planta
# experto: Rogelio Ejemplo (persona ficticia)
# sucesor: Daniela Muestra (persona ficticia)
"""

TRANSCRIPCIONES = {
    "entrevista-1-decisiones-y-senales.txt": """# fecha: 2026-09-01
[P:decisiones-01] [02:15] situacion: Producción pide un paro preventivo en la semana de cierre de mes.
[P:decisiones-01] [02:40] decision: Lo muevo al fin de semana y aviso a producción con un día de anticipación.
[P:decisiones-01] [03:05] porque: Producción prefiere perder un turno de sábado que atrasar embarques.
[P:decisiones-01] [03:30] excepcion: El equipo ya muestra vibración anormal.
[P:decisiones-01] [03:50] regla: si el equipo muestra vibración anormal entonces se para aunque sea cierre de mes
[P:decisiones-02] [07:10] situacion: Falla un motor y no hay refacción en almacén.
[P:decisiones-02] [07:35] decision: Primero reviso si el motor gemelo de la línea dos se puede usar, después pido la refacción urgente.
[P:decisiones-02] [08:00] porque: El proveedor tarda y la línea dos trabaja con menos carga.
[P:decisiones-02] [08:20] contacto: Compras, con la persona encargada de refacciones críticas.
[P:decisiones-03] [11:45] situacion: Dos técnicos piden vacaciones la misma semana.
[P:decisiones-03] [12:05] decision: Autorizo solo a uno si esa semana hay paro programado.
[P:decisiones-03] [12:30] porque: En paro programado se necesita a todo el equipo disponible.
[P:senales-01] [15:20] senal: El compresor hace un golpeteo distinto al arrancar en la mañana.
[P:senales-01] [15:40] situacion: Arranque del primer turno.
[P:senales-01] [16:00] decision: Reviso las purgas de condensado antes de que suba la producción.
[P:senales-01] [16:25] porque: La humedad que se junta en la noche es la causa más común.
[P:senales-01] [16:45] regla: si golpea al arrancar entonces purgar y revisar la válvula antes de cargar
[P:senales-02] [19:10] senal: Olor a quemado cerca del tablero de la inyectora.
[P:senales-02] [19:30] marca: seguridad
[P:senales-02] [19:45] decision: Bloqueo y etiqueto el tablero y llamo al electricista certificado.
[P:senales-02] [20:10] limite: Nunca abrir el tablero energizado.
[P:senales-02] [20:30] regla: si hay olor a quemado entonces bloqueo y etiquetado antes de cualquier revisión
""",
    "entrevista-2-excepciones-y-limites.txt": """# fecha: 2026-09-03
[P:excepciones-01] [01:50] situacion: La auditoría de un cliente cae el mismo día que un paro preventivo.
[P:excepciones-01] [02:20] decision: El paro se mueve; la auditoría no.
[P:excepciones-01] [02:45] porque: El cliente evalúa el orden de la planta y un paro a medias se ve mal.
[P:excepciones-02] [06:30] situacion: El proveedor de mantenimiento de montacargas no llega.
[P:excepciones-02] [06:55] marca: seguridad
[P:excepciones-02] [07:15] decision: Uso el montacargas de respaldo solo en almacén, nunca en producción.
[P:excepciones-02] [07:40] porque: El de respaldo tiene restricción de carga.
[P:limites-01] [10:05] limite: Nunca autorizar soldadura cerca de la zona de solventes sin permiso de trabajo en caliente firmado.
[P:limites-01] [10:30] marca: seguridad
[P:limites-01] [10:50] contacto: Responsable de seguridad e higiene de la planta.
[P:limites-02] [13:15] limite: No cambiar parámetros de un molde sin avisar a calidad.
[P:limites-02] [13:35] marca: calidad
[P:limites-02] [13:55] decision: Registro el cambio en la bitácora y aviso a calidad antes de arrancar.
[P:contactos-01] [16:40] situacion: Falla del compresor fuera de horario.
[P:contactos-01] [17:00] contacto: El técnico de fábrica del compresor responde mejor por teléfono que por correo.
[P:contactos-01] [17:20] porque: Por correo la respuesta llega hasta el siguiente día hábil.
""",
    "entrevista-3-trucos.txt": """# fecha: 2026-09-08
[P:trucos-01] [03:10] situacion: La bitácora del turno de noche viene incompleta.
[P:trucos-01] [03:30] decision: Reviso las fotos del grupo del turno antes de preguntar.
[P:trucos-01] [03:55] porque: El turno de noche documenta más con fotos que por escrito.
[P:trucos-02] [08:20] situacion: Hay que entregar el reporte mensual de mantenimiento.
[P:trucos-02] [08:45] decision: Lo armo desde las órdenes cerradas, no desde lo que se dijo en la junta.
[P:decisiones-04] [12:00] situacion: Llega una cotización de reparación mayor.
[P:decisiones-04] [12:25] decision: Pido segunda cotización cuando rebasa el límite de autorización del puesto.
[P:decisiones-04] [12:50] porque: Así lo pide dirección y evita retrabajos con el proveedor.
""",
}

VALIDACIONES = """fecha,ficha,tipo,nombre,version
2026-09-10,decisiones-01,experto,Rogelio Ejemplo,1
2026-09-10,decisiones-02,experto,Rogelio Ejemplo,1
2026-09-10,decisiones-03,experto,Rogelio Ejemplo,1
2026-09-10,senales-01,experto,Rogelio Ejemplo,1
2026-09-10,senales-02,experto,Rogelio Ejemplo,1
2026-09-11,excepciones-01,experto,Rogelio Ejemplo,1
2026-09-11,excepciones-02,experto,Rogelio Ejemplo,1
2026-09-11,limites-01,experto,Rogelio Ejemplo,1
2026-09-11,limites-02,experto,Rogelio Ejemplo,1
2026-09-11,contactos-01,experto,Rogelio Ejemplo,1
2026-09-12,trucos-01,experto,Rogelio Ejemplo,1
2026-09-12,excepciones-02,responsable,Responsable de seguridad (ficticio),1
2026-09-12,limites-01,responsable,Responsable de seguridad (ficticio),1
"""

PRACTICA = """fecha,ficha,sucesor,respuesta,calificacion,correccion
2026-09-15,decisiones-01,Daniela Muestra,Lo paso al sábado y aviso a producción un día antes.,correcto,
2026-09-15,decisiones-02,Daniela Muestra,Pido la refacción urgente a compras.,parcial,
2026-09-17,decisiones-02,Daniela Muestra,Reviso si puedo usar el motor de la línea dos y en paralelo pido la refacción.,correcto,
2026-09-15,decisiones-03,Daniela Muestra,Autorizo a los dos si cubren con horas extra.,incorrecto,"Autorizo solo a uno; el segundo únicamente si un técnico de otra área cubre el turno completo."
2026-09-16,senales-01,Daniela Muestra,Purgo el condensado y reviso la válvula antes de cargar la línea.,correcto,
2026-09-16,senales-02,Daniela Muestra,Bloqueo y etiqueto el tablero y llamo al electricista certificado.,correcto,
2026-09-16,excepciones-01,Daniela Muestra,Muevo el paro y atiendo la auditoría.,correcto,
2026-09-18,excepciones-02,Daniela Muestra,Uso el de respaldo solo dentro del almacén.,correcto,
2026-09-18,limites-01,Daniela Muestra,No se suelda sin permiso de trabajo en caliente firmado.,correcto,
2026-09-18,limites-02,Daniela Muestra,Aviso a calidad después de arrancar.,parcial,
2026-09-19,trucos-01,Daniela Muestra,Reviso las fotos del grupo del turno de noche.,correcto,
"""


def generar(base: Path) -> None:
    carpeta = base / "transcripciones"
    carpeta.mkdir(parents=True, exist_ok=True)
    for nombre, texto in TRANSCRIPCIONES.items():
        (carpeta / nombre).write_text(ENCABEZADO + texto, encoding="utf-8")
    (base / "validaciones.csv").write_text(VALIDACIONES, encoding="utf-8")
    (base / "practica.csv").write_text(PRACTICA, encoding="utf-8")
    (base / "DATOS_DE_DEMOSTRACION.txt").write_text(
        "Datos de demostración: empresa, personas y casos inventados.\n",
        encoding="utf-8",
    )
