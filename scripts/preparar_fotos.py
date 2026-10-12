"""Prepara las fotos de fondo del login a partir de los originales.

    python scripts/preparar_fotos.py

Lee las fotos originales de  alerta-quito-interfaz/fotos-originales/  (imagen1 ... imagen5, en .png, .jpg o .webp)
y genera las que usa la aplicacion en  alerta-quito-interfaz/public/images/imagenN.jpg . Para cambiar una foto:
reemplace el original (manteniendo el nombre) y vuelva a ejecutar este script. Requiere Pillow:  pip install pillow

- Si el original ya mide 1920 px de ancho o mas, solo se optimiza (JPEG de calidad alta y carga progresiva).
- Si es un poco mas chico se amplia suavemente. Si es MUCHO mas chico (menos de 1/1.5 del objetivo) ademas se afina
  y se agrega un grano muy fino que disimula la suavidad. NO inventa detalle: para que se vea realmente nitida use
  fotos de 1920 px de ancho o mas.
"""
import pathlib
import random
import sys

from PIL import Image, ImageEnhance, ImageFilter

RAIZ = pathlib.Path(__file__).resolve().parent.parent / "alerta-quito-interfaz"
ORIGINALES = RAIZ / "fotos-originales"
SALIDA = RAIZ / "public" / "images"
ANCHO_OBJETIVO = 1920
EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp"}
random.seed(7)  # el grano es siempre el mismo: el resultado es reproducible
# Fotos que no son panoramicas (por ejemplo cuadradas) se recortan a 16:9 para que en pantalla grande se vea lo
# importante. El numero indica DONDE se corta: 0 = desde arriba, 1 = desde abajo, 0.5 = centrado.
ENCUADRE_VERTICAL: dict[str, float] = {}   # ej.: {"imagen1.jpg": 0.85} para una foto cuadrada


def ampliar(foto: Image.Image, ancho_final: int) -> Image.Image:
    """Amplia en pasos de hasta 1.6x (mejor que un salto grande) afinando entre pasos."""
    while foto.width < ancho_final:
        nuevo_ancho = min(ancho_final, round(foto.width * 1.6))
        nuevo_alto = round(foto.height * nuevo_ancho / foto.width)
        foto = foto.resize((nuevo_ancho, nuevo_alto), Image.LANCZOS)
        foto = foto.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=3))
    return foto


def grano(foto: Image.Image, intensidad: int) -> Image.Image:
    """Ruido fino en luminancia: rompe la sensacion de 'borroso' de una ampliacion."""
    ruido = Image.effect_noise(foto.size, intensidad).convert("L")
    ruido_rgb = Image.merge("RGB", (ruido, ruido, ruido))
    return Image.blend(foto, Image.blend(foto, ruido_rgb, 0.5), 0.06 + intensidad / 600)


def recortar_16_9(foto: Image.Image, ancla: float) -> Image.Image:
    alto = round(foto.width * 9 / 16)
    if alto >= foto.height:
        return foto
    arriba = round((foto.height - alto) * ancla)
    return foto.crop((0, arriba, foto.width, arriba + alto))


def main() -> int:
    originales = sorted(f for f in ORIGINALES.iterdir() if f.stem.startswith("imagen") and f.suffix.lower() in EXTENSIONES)
    if not originales:
        print("No hay fotos en", ORIGINALES)
        return 1
    SALIDA.mkdir(parents=True, exist_ok=True)
    for origen in originales:
        foto = Image.open(origen).convert("RGB")
        ancho0, alto0 = foto.size
        factor = ANCHO_OBJETIVO / ancho0
        if factor > 1:
            foto = ampliar(foto, ANCHO_OBJETIVO)
            if factor > 1.5:   # foto chica: se compensa la suavidad de la ampliacion
                foto = ImageEnhance.Contrast(foto).enhance(1.05)
                foto = ImageEnhance.Color(foto).enhance(1.06)
                foto = grano(foto, intensidad=min(14, round(4 + 4 * factor)))
        elif factor < 1:
            foto = foto.resize((ANCHO_OBJETIVO, round(alto0 * factor)), Image.LANCZOS)
        if origen.name in ENCUADRE_VERTICAL:
            foto = recortar_16_9(foto, ENCUADRE_VERTICAL[origen.name])
        destino = SALIDA / (origen.stem + ".jpg")
        foto.save(destino, "JPEG", quality=88, optimize=True, progressive=True, subsampling=0)
        print("%s  %dx%d -> %dx%d  (x%.1f)  %d KB" % (origen.name, ancho0, alto0, foto.width, foto.height, factor,
                                                      destino.stat().st_size // 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
