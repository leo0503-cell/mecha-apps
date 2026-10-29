from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal


@dataclass(frozen=True)
class Fuente:
    archivo: str
    campo: str
    valor: str
    linea: int | None = None


@dataclass
class Factura:
    uuid: str
    folio: str
    serie: str
    fecha: str
    emisor: dict[str, str]
    receptor: dict[str, str]
    monto: Decimal
    moneda: str
    conceptos: list[dict[str, str]]
    oc: str
    fuentes: list[Fuente]

    @property
    def referencia(self) -> str:
        return self.serie + self.folio


@dataclass
class Pago:
    uuid_complemento: str
    documento: str
    monto: Decimal
    moneda: str
    saldo_anterior: Decimal
    saldo_insoluto: Decimal
    fecha: str
    fuentes: list[Fuente]


@dataclass
class Registro:
    id: str
    datos: dict[str, str]
    fuentes: list[Fuente]


@dataclass
class Evidencia:
    id: str
    texto: str
    referencias: dict[str, set[str]]
    fuentes: list[Fuente]


@dataclass
class Vinculo:
    tipo: str
    destino: str
    nivel: str
    criterio: str
    fuentes: list[Fuente]


@dataclass
class Insumos:
    facturas: list[Factura] = field(default_factory=list)
    pagos: list[Pago] = field(default_factory=list)
    cartera: list[Registro] = field(default_factory=list)
    pedidos: list[Registro] = field(default_factory=list)
    evidencias: list[Evidencia] = field(default_factory=list)
    avisos: list[str] = field(default_factory=list)
    demostracion: bool = False
