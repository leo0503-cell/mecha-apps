from __future__ import annotations

from dataclasses import dataclass, field

CAMPOS = {
    "situacion": "Situación",
    "senal": "Señal",
    "decision": "Decisión",
    "porque": "Por qué",
    "excepcion": "Excepción",
    "limite": "Límite",
    "contacto": "Contacto",
}
MARCAS = ("seguridad", "calidad")


@dataclass(frozen=True)
class Fuente:
    archivo: str
    linea: int
    minuto: str = ""

    @property
    def cita(self) -> str:
        minuto = f" · min {self.minuto}" if self.minuto else ""
        return f"{self.archivo} · línea {self.linea}{minuto}"


@dataclass(frozen=True)
class Fragmento:
    pregunta: str
    campo: str
    texto: str
    fuente: Fuente


@dataclass(frozen=True)
class Dato:
    texto: str
    fuente: Fuente


@dataclass(frozen=True)
class Regla:
    si: str
    entonces: str
    fuente: Fuente


@dataclass
class Ficha:
    id: str
    categoria: str
    pregunta: str
    campos: dict[str, list[Dato]] = field(default_factory=dict)
    reglas: list[Regla] = field(default_factory=list)
    marcas: set[str] = field(default_factory=set)

    def primero(self, campo: str) -> str:
        datos = self.campos.get(campo, [])
        return datos[0].texto if datos else ""

    @property
    def requiere_responsable(self) -> bool:
        return bool(self.marcas)


@dataclass(frozen=True)
class Validacion:
    fecha: str
    ficha: str
    tipo: str  # experto | responsable
    nombre: str
    version: int
    fuente: Fuente


@dataclass(frozen=True)
class Practica:
    fecha: str
    ficha: str
    sucesor: str
    respuesta: str
    calificacion: str  # correcto | parcial | incorrecto
    correccion: str
    fuente: Fuente
