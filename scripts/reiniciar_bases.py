"""Reinicia las dos bases de datos (borra TODO y vuelve a cargar los datos iniciales).

    python scripts/reiniciar_bases.py

Ejecuta base-de-datos/reset_seguridad.sql y base-de-datos/reset_bd.sql dentro de los contenedores de Postgres
(docker compose debe estar levantado). Es lo mismo que hacer "Execute script" de esos archivos en DBeaver, pero
con un solo comando. Cuando quiera empezar de cero: usuarios, reportes, funcionarios y auditoria se pierden.

Si ademas quiere recrear los contenedores y sus discos:   docker compose down -v && docker compose up -d --build
"""
import pathlib
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent

BASES = [
    ("db-seguridad", "alerta_quito_seguridad", RAIZ / "base-de-datos" / "reset_seguridad.sql"),
    ("db-negocio", "alerta_quito", RAIZ / "base-de-datos" / "reset_bd.sql"),
]


def main() -> int:
    for servicio, base, script in BASES:
        print("-> %s (%s): %s" % (base, servicio, script.name))
        resultado = subprocess.run(
            ["docker", "compose", "exec", "-T", servicio, "psql", "-U", "postgres", "-d", base,
             "-v", "ON_ERROR_STOP=1", "-q"],
            input=script.read_bytes(), cwd=RAIZ, capture_output=True,
        )
        if resultado.returncode != 0:
            print(resultado.stderr.decode("utf-8", "replace"))
            print("FALLO al reiniciar %s. Esta levantado docker compose? (docker compose up -d)" % base)
            return 1
    print()
    print("Listo: las dos bases quedaron como nuevas con los datos iniciales.")
    print("IMPORTANTE: si tenia la aplicacion abierta en el navegador, cierre la sesion (Salir) o abra una")
    print("ventana nueva: los usuarios se volvieron a crear y la sesion anterior ya no corresponde.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
