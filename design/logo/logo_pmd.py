#!/usr/bin/env python3
"""Pepe Flock: logo base (oveja PMD) en SVG. Solo libreria estandar.

Cada proyecto es una oveja del rebaño: cambia el color de toda la oveja y el simbolo
de la casilla libre. La forma, la cuadricula 2x2 y las letras P M D NO se tocan.

Ejemplos:
    python3 logo_pmd.py                                        # icono base -> logo_base.svg
    python3 logo_pmd.py --no-eyes -o sin_ojos.svg              # sin ojos
    python3 logo_pmd.py --wool "#2B4BD8" --head "#A9C0FF" --icon pen --name Notes \
                        --layout horizontal -o notes_horizontal.svg
    python3 logo_pmd.py --no-letters --size 64 -o favicon.svg  # tamanos pequenos
    python3 logo_pmd.py --blank -o oveja_plantilla.svg         # plantilla: oveja con P M D y la casilla libre (+)
    python3 logo_pmd.py --silhouette -o oveja_silueta.svg      # solo la oveja, sin casillas

Parametros de proyecto (lo unico que cambia):
    --wool       color fuerte: lana, letras, ojos y texto
    --head       color claro de la misma familia: cabeza, orejas, casilla libre
    --icon       slot | pen | hanger | backpack | dumbbell | sun   (o --icon-svg con un fragmento propio 36x36)
    --slot-fill  color de fondo de la casilla libre (por defecto, head)
    --slot-ink   color del simbolo de la casilla libre (por defecto, wool)
    --name       nombre del proyecto (solo en --layout horizontal), p. ej. Notes

Letras y texto van como trazados (paths): no dependen de ninguna fuente instalada.
El texto usa glyphs_spacegrotesk_bold.json, que debe estar al lado de este script
(Space Grotesk Bold, licencia OFL).
"""
import argparse
import json
import os

# ---- Geometria fija (lienzo del icono 200x200) -------------------------------
WOOL = [(52, 88, 34), (78, 52, 36), (122, 52, 36), (150, 88, 34),
        (138, 122, 32), (62, 122, 32), (100, 100, 44)]          # (cx, cy, r)
TILE = 36
TILES = {"P": (60, 42), "M": (104, 42), "D": (60, 86)}          # esquina sup. izq.
SLOT = (104, 86)

# Letras como trazos dentro de una casilla de 36x36
LETTERS = {
    "P": "M12 27 V9 H19 a5.5 5.5 0 0 1 0 11 H12",
    "M": "M9 27 V9 L18 20 L27 9 V27",
    "D": "M12 27 V9 H17 a9 9 0 0 1 0 18 Z",
}

# Iconos para la casilla libre (casilla 36x36, trazo del color slot-ink sobre fondo slot-fill)
ICONS = {
    "pen": "<path d='M10 27 L12 20 L24 8 L28 12 L16 24 Z'/><path d='M21 11 L25 15'/>",
    "hanger": "<circle cx='18' cy='9' r='2.8'/><path d='M18 12 V17 L6 26 H30 L18 17'/>",
    "dumbbell": "<path d='M11 18 H25'/><path d='M11 10 V26'/><path d='M25 10 V26'/>"
                "<path d='M6 14 V22'/><path d='M30 14 V22'/>",
    "sun": "<path d='M9 24 a9 9 0 0 1 18 0'/><path d='M5 24 H31'/>"
           "<path d='M18 8 V12 M9.5 15.5 L6.7 12.7 M26.5 15.5 L29.3 12.7'/>",
    "backpack": "<rect x='10' y='8' width='16' height='20' rx='6'/>"
                "<rect x='14' y='18' width='8' height='6' rx='2'/><path d='M15 8 V6 H21 V8'/>",
}

_GLYPHS = None


def _glyphs():
    global _GLYPHS
    if _GLYPHS is None:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "glyphs_spacegrotesk_bold.json")
        with open(path, encoding="utf-8") as f:
            _GLYPHS = json.load(f)
    return _GLYPHS


def text_width(text, font_size):
    g = _glyphs()
    return sum(g["glyphs"][c]["adv"] for c in text) * font_size / g["upm"]


def text_paths(text, x, baseline, font_size, fill):
    """Texto como trazados SVG (sin fuentes)."""
    g = _glyphs()
    s = font_size / g["upm"]
    parts, cx = [], x
    for c in text:
        gl = g["glyphs"][c]
        if gl["d"]:
            parts.append(f"<path transform='translate({cx:.2f} {baseline:.2f}) scale({s:.4f})' d='{gl['d']}'/>")
        cx += gl["adv"] * s
    return f"<g fill='{fill}'>" + "".join(parts) + "</g>"


def sheep(wool, head, paper, bg, icon, icon_svg, letters, eyes, slot_fill=None, slot_ink=None, mode=None):
    """Elementos SVG de la oveja en un lienzo de 200x200.

    mode: None (logo normal), 'blank' (plantilla: 4 casillas vacias) o 'silhouette' (sin casillas).
    En los modos de plantilla se añaden ids y comentarios para poder editarla a mano o con una IA.
    """
    slot_fill = slot_fill or head
    slot_ink = slot_ink or wool
    tpl = mode in ("blank", "silhouette")
    nl = "\n" if tpl else ""

    def c(txt):  # comentario solo en plantillas
        return f"<!-- {txt} -->{nl}" if tpl else ""

    def i(name):  # id solo en plantillas
        return f" id='{name}'" if tpl else ""

    out = [
        c(f"lana: color principal ({wool})"),
        f"<g{i('lana')} fill='{wool}'>" + "".join(f"<circle cx='{x}' cy='{y}' r='{r}'/>" for x, y, r in WOOL) + "</g>" + nl,
        c(f"orejas: color claro ({head})"),
        f"<g{i('orejas')} fill='{head}'><ellipse cx='70' cy='136' rx='13' ry='6.5' transform='rotate(-22 70 136)'/>"
        f"<ellipse cx='130' cy='136' rx='13' ry='6.5' transform='rotate(22 130 136)'/></g>" + nl,
        c(f"cabeza: color claro; el borde ({bg}) es el color del fondo donde ira el logo"),
        f"<ellipse{i('cabeza')} cx='100' cy='158' rx='30' ry='34' fill='{head}' stroke='{bg}' stroke-width='4'/>" + nl,
    ]
    if eyes:
        out.append(c("ojos: borra este grupo para la version sin ojos"))
        out.append(f"<g{i('ojos')} fill='{wool}'><circle cx='89' cy='154' r='3.4'/><circle cx='111' cy='154' r='3.4'/></g>" + nl)
    if mode == "silhouette":
        return "".join(out)
    out.append(c("casillas P M D (36x36, esquinas redondeadas)"))
    out.append(f"<g{i('casillas')} fill='{paper}'>" + "".join(
        f"<rect x='{x}' y='{y}' width='{TILE}' height='{TILE}' rx='9'/>" for x, y in TILES.values()) + "</g>" + nl)
    if letters:
        out.append(c(f"letras P M D: trazos del color de la lana ({wool})"))
        out.append(f"<g{i('letras')} fill='none' stroke='{wool}' stroke-width='3.6' stroke-linecap='round' "
                   f"stroke-linejoin='round'>" + "".join(
                       f"<path transform='translate({x} {y})' d='{LETTERS[ch]}'/>"
                       for ch, (x, y) in TILES.items()) + "</g>" + nl)
    sx, sy = SLOT
    if mode != "blank" and (icon_svg or icon in ICONS):
        out.append(f"<rect x='{sx}' y='{sy}' width='{TILE}' height='{TILE}' rx='9' fill='{slot_fill}'/>")
        out.append(f"<g transform='translate({sx} {sy})' fill='none' stroke='{slot_ink}' stroke-width='2.6' "
                   f"stroke-linecap='round' stroke-linejoin='round'>{icon_svg or ICONS[icon]}</g>")
    else:  # casilla libre: la unica con borde de color (head) y un +
        out.append(c(f"casilla libre (el +): sustituye este grupo por el simbolo del proyecto ({head})"))
        out.append(f"<g{i('casilla-libre')} transform='translate({sx} {sy})' fill='none' stroke='{head}' stroke-linecap='round'>"
                   f"<rect x='1.5' y='1.5' width='33' height='33' rx='8' stroke-width='2.4' stroke-dasharray='4 3.5'/>"
                   f"<path d='M18 10 V26 M10 18 H26' stroke-width='3'/></g>")
    return "".join(out)


def build(wool="#12151C", head="#FF8A6B", paper="#F5F6F8", bg="#FFFFFF", icon="slot", icon_svg=None,
          letters=True, eyes=True, layout="icon", brand="Pepe Flock", name=None, text=None, size=512,
          slot_fill=None, slot_ink=None, mode=None):
    """Devuelve el SVG como texto.

    layout: 'icon' (cuadrado 200x200) o 'horizontal' (oveja + 'Pepe Flock' [+ nombre del proyecto]).
    bg: color del fondo donde ira el logo (separa la cabeza de la lana).
    """
    text = text or wool
    body = sheep(wool, head, paper, bg, icon, icon_svg, letters, eyes, slot_fill, slot_ink, mode)
    label = "Logo Pepe Flock" + (f": {name}" if name else "")
    if mode == "blank":
        label = "Plantilla oveja Pepe Flock (P M D y casilla libre)"
    elif mode == "silhouette":
        label = "Silueta oveja Pepe Flock"
    if layout == "icon":
        return (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' width='{size}' height='{size}' "
                f"role='img' aria-label='{label}'>\n<title>{label}</title>\n{body}\n</svg>\n")
    # horizontal
    x0 = 232
    if name:
        fs_b, fs_n = 84, 54
        wb, wn = text_width(brand, fs_b), text_width(name, fs_n)
        words = text_paths(brand, x0, 108, fs_b, text) + text_paths(name, x0, 166, fs_n, text)
        width = x0 + max(wb, wn) + 24
    else:
        fs_b = 88
        words = text_paths(brand, x0, 100 + 0.35 * fs_b, fs_b, text)  # centrado vertical por altura de versal
        width = x0 + text_width(brand, fs_b) + 24
    width = round(width)
    h = size * 200 / width
    return (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {width} 200' width='{size}' height='{h:.0f}' "
            f"role='img' aria-label='{label}'>\n<title>{label}</title>\n{body}\n{words}\n</svg>\n")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Genera el logo Pepe Flock (oveja PMD) en SVG.")
    ap.add_argument("--wool", default="#12151C", help="color fuerte (lana, letras, ojos, texto)")
    ap.add_argument("--head", default="#FF8A6B", help="color claro (cabeza, orejas, casilla libre)")
    ap.add_argument("--paper", default="#F5F6F8", help="color de las casillas")
    ap.add_argument("--bg", default="#FFFFFF", help="color del fondo donde ira el logo")
    ap.add_argument("--text", default=None, help="color del texto (por defecto, igual que wool)")
    ap.add_argument("--icon", default="slot", help="slot | pen | hanger | backpack | dumbbell | sun")
    ap.add_argument("--icon-svg", default=None, help="fragmento SVG propio para la casilla (36x36)")
    ap.add_argument("--slot-fill", default=None, help="fondo de la casilla libre (por defecto, head)")
    ap.add_argument("--slot-ink", default=None, help="color del simbolo de la casilla libre (por defecto, wool)")
    ap.add_argument("--no-letters", action="store_true", help="sin letras (tamanos pequenos)")
    ap.add_argument("--no-eyes", action="store_true", help="sin ojos")
    ap.add_argument("--blank", action="store_true", help="plantilla: oveja con P M D y la casilla libre (+), con ids y comentarios")
    ap.add_argument("--silhouette", action="store_true", help="plantilla: solo la oveja, sin casillas")
    ap.add_argument("--layout", default="icon", choices=["icon", "horizontal"])
    ap.add_argument("--brand", default="Pepe Flock")
    ap.add_argument("--name", default=None, help="nombre del proyecto (layout horizontal)")
    ap.add_argument("--size", type=int, default=512, help="ancho en px")
    ap.add_argument("-o", "--output", default="logo_base.svg")
    a = ap.parse_args()
    mode = "silhouette" if a.silhouette else ("blank" if a.blank else None)
    svg = build(a.wool, a.head, a.paper, a.bg, a.icon, a.icon_svg, not a.no_letters, not a.no_eyes,
                a.layout, a.brand, a.name, a.text, a.size, a.slot_fill, a.slot_ink, mode)
    with open(a.output, "w", encoding="utf-8") as f:
        f.write(svg)
    print(f"Escrito {a.output}")
