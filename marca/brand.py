"""Tokens de marca de Mecha. Fuente unica de verdad: todo lo demas lee de aqui."""

COLORS = {
    "polvora":      "#16161A",  # base: texto, fondos oscuros, logo
    "ceniza":       "#F1EFE9",  # fondo claro (nunca blanco puro)
    "mecha":        "#E03127",  # el rojo: relleno y grafico sobre fondo claro
    "mecha_texto":  "#C0241A",  # el mismo rojo, oscurecido para poder ser texto
    "mecha_clara":  "#FF6152",  # el rojo sobre fondo oscuro: relleno y texto
    "humo":         "#676A70",  # texto secundario (claro)
    "humo_claro":   "#9A9CA2",  # texto secundario (oscuro)
    "azufre":       "#E8A317",  # acento raro: SOLO relleno, nunca texto
    "azufre_texto": "#8A6100",  # el mismo acento, apto para texto sobre claro
    "azufre_claro": "#F3BE4D",  # acento raro (oscuro): relleno y texto
}


def relative_luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    chans = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in chans]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast_ratio(a: str, b: str) -> float:
    la, lb = relative_luminance(a), relative_luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


FONTS = {
    "display": ("Archivo", [700, 800]),   # titulos y logotipo
    "body":    ("DM Sans", [400, 500]),   # textos, propuestas, correos
}

# Pares aprobados PARA TEXTO: (texto, fondo, contraste, uso).
# Todos tienen que dar 4.5:1 o mas. La build lo verifica.
CONTRAST = [
    ("polvora",      "ceniza",      15.69, "todo"),
    ("ceniza",       "polvora",     15.69, "todo"),
    ("mecha_texto",  "ceniza",       5.21, "texto rojo sobre claro"),
    ("ceniza",       "mecha_texto",  5.21, "boton rojo solido, fondo claro"),
    ("mecha_clara",  "polvora",      6.09, "texto rojo sobre oscuro"),
    ("polvora",      "mecha_clara",  6.09, "boton rojo solido, fondo oscuro"),
    ("humo",         "ceniza",       4.72, "texto secundario"),
    ("humo_claro",   "polvora",      6.57, "texto secundario"),
    ("azufre_texto", "ceniza",       4.82, "acento raro en texto"),
    ("azufre_claro", "polvora",     10.55, "acento raro en texto"),
]

# Colores que solo pueden ser relleno decorativo (barras, chips, la brasa del
# logo). No llevan texto encima ni debajo, por eso no tienen umbral.
FILL_ONLY = {"mecha", "azufre"}

TEXT_MIN = 4.5
