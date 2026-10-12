"""Prueba de humo de extremo a extremo contra el sistema levantado con docker compose.

    docker compose up -d --build --wait
    python scripts/prueba_humo.py

Recorre el flujo del PDF a traves de nginx (http://localhost:4200/api), igual que el
navegador: el administrador crea un funcionario, la clave temporal llega a Mailpit,
el funcionario debe cambiarla, un ciudadano reporta un asalto con foto, el funcionario
lo atiende y lo cierra con foto, y el ciudadano ve el cambio. Sale con codigo 1 si algo falla.
"""
import json
import sys
import urllib.error
import urllib.request
import uuid

BASE = "http://localhost:4200/api"
MAILPIT = "http://localhost:8025/api/v1"
JPG = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00]) + b"\x00" * 64


def llamar(metodo, url, cuerpo=None, token=None, cabeceras=None):
    datos = cuerpo if isinstance(cuerpo, (bytes, type(None))) else json.dumps(cuerpo).encode()
    req = urllib.request.Request(url, data=datos, method=metodo)
    if isinstance(cuerpo, (dict, list)):
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    for k, v in (cabeceras or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            texto = r.read().decode()
            try:
                return r.status, (json.loads(texto) if texto else None)
            except ValueError:
                return r.status, texto   # p. ej. la portada HTML
    except urllib.error.HTTPError as e:
        texto = e.read().decode()
        try:
            return e.code, json.loads(texto)
        except ValueError:
            return e.code, texto


def multipart(partes):
    """partes: lista de (nombre, nombre_archivo|None, content_type|None, bytes)."""
    limite = "----humo" + uuid.uuid4().hex
    cuerpo = b""
    for nombre, archivo, tipo, contenido in partes:
        cuerpo += ("--%s\r\n" % limite).encode()
        disp = 'Content-Disposition: form-data; name="%s"' % nombre
        if archivo:
            disp += '; filename="%s"' % archivo
        cuerpo += (disp + "\r\n").encode()
        if tipo:
            cuerpo += ("Content-Type: %s\r\n" % tipo).encode()
        cuerpo += b"\r\n" + contenido + b"\r\n"
    cuerpo += ("--%s--\r\n" % limite).encode()
    return cuerpo, {"Content-Type": "multipart/form-data; boundary=" + limite}


fallos = []


def comprobar(descripcion, condicion, detalle=""):
    print(("  OK   " if condicion else "  FALLO ") + descripcion + ("" if condicion else "  -> " + str(detalle)))
    if not condicion:
        fallos.append(descripcion)


def main():
    sufijo = uuid.uuid4().hex[:6]
    print("1. Salud y login")
    estado, _ = llamar("GET", "http://localhost:4200/")
    comprobar("la interfaz responde", estado == 200, estado)
    estado, adm = llamar("POST", BASE + "/auth/login", {"usuario": "admin", "password": "Admin123*"})
    comprobar("login del administrador", estado == 200 and "ADMINI" in adm["perfiles"], adm)
    admin = adm["token"]

    print("2. El administrador crea un funcionario (clave temporal + correo)")
    login = "func" + sufijo
    estado, creado = llamar("POST", BASE + "/admin/funcionarios", {
        "nombreCompleto": "Funcionario Humo", "cedula": "1700000099", "correo": login + "@quito.ec",
        "usuario": login, "idEntidad": 4, "cargo": "Despachador"}, admin)
    comprobar("funcionario creado", estado == 201, creado)
    temporal = creado["passwordTemporal"]
    comprobar("el correo salio hacia Mailpit", creado["correoEnviado"] is True, creado)
    _, buzon = llamar("GET", MAILPIT + "/search?query=to:" + login + "@quito.ec")
    comprobar("el correo contiene la clave temporal",
              buzon["messages_count"] >= 1, buzon)

    print("3. El funcionario debe cambiar la clave temporal")
    estado, ses = llamar("POST", BASE + "/auth/login", {"usuario": login, "password": temporal})
    comprobar("entra con la temporal y se le avisa", estado == 200 and ses["debeCambiarPassword"] is True, ses)
    estado, resp = llamar("GET", BASE + "/reportes/bandeja", token=ses["token"])
    comprobar("no puede usar el sistema todavia (403 CAMBIO_PASSWORD)",
              estado == 403 and resp.get("codigo") == "CAMBIO_PASSWORD", resp)
    estado, nueva = llamar("POST", BASE + "/auth/cambiar-password",
                           {"passwordActual": temporal, "passwordNueva": "ClaveNueva2026*"}, ses["token"])
    comprobar("cambia la clave", estado == 200 and nueva["debeCambiarPassword"] is False, nueva)
    func = nueva["token"]

    print("4. Un ciudadano reporta un asalto")
    estado, ciud = llamar("POST", BASE + "/auth/login", {"usuario": "ciudadano.demo", "password": "Ciud123*"})
    comprobar("login del ciudadano", estado == 200, ciud)
    ciudadano = ciud["token"]
    _, tipos = llamar("GET", BASE + "/tipos-incidente", token=ciudadano)
    asalto = next(t for t in tipos if t["nombre"] == "Robo o asalto")
    datos = json.dumps({"idTipoIncidente": asalto["id"], "descripcion": "prueba de humo", "latitud": -0.2,
                        "longitud": -78.5, "direccion": "Av. 10 de Agosto y Colon"}).encode()
    cuerpo, cab = multipart([("datos", None, "application/json", datos), ("foto", "foto.jpg", "image/jpeg", JPG)])
    estado, rep = llamar("POST", BASE + "/reportes", cuerpo, ciudadano, cab)
    comprobar("reporte creado con codigo y prioridad critica",
              estado == 201 and rep["reporte"]["prioridad"] == 1 and rep["reporte"]["entidad"] == "POLICIA", rep)
    id_reporte = rep["reporte"]["id"]

    print("5. El funcionario de la Policia lo atiende y lo cierra")
    estado, bandeja = llamar("GET", BASE + "/reportes/bandeja", token=func)
    comprobar("el asalto esta primero en su bandeja", estado == 200 and bandeja[0]["id"] == id_reporte, bandeja)

    def cambiar(estado_nuevo, foto):
        partes = [("estado", None, None, estado_nuevo.encode()), ("comentario", None, None, b"humo")]
        if foto:
            partes.append(("foto", "solucion.jpg", "image/jpeg", JPG))
        c, h = multipart(partes)
        return llamar("POST", BASE + "/reportes/%d/estado" % id_reporte, c, func, h)

    estado, r = cambiar("EN_ATENCION", False)
    comprobar("pasa a En atencion", estado == 200 and r["reporte"]["estado"] == "EN_ATENCION", r)
    estado, r = cambiar("RESUELTO", False)
    comprobar("no se puede resolver sin foto", estado == 400, r)
    estado, r = cambiar("RESUELTO", True)
    comprobar("se resuelve con foto", estado == 200 and r["reporte"]["estado"] == "RESUELTO", r)

    print("6. El ciudadano ve el cambio")
    _, mios = llamar("GET", BASE + "/reportes/mios", token=ciudadano)
    estado_visto = next(x["estado"] for x in mios if x["id"] == id_reporte)
    comprobar("su reporte figura como RESUELTO", estado_visto == "RESUELTO", estado_visto)

    print()
    if fallos:
        print("FALLARON %d comprobaciones: %s" % (len(fallos), "; ".join(fallos)))
        sys.exit(1)
    print("Todo OK")


if __name__ == "__main__":
    main()
