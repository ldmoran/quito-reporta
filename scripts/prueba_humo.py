"""Prueba de humo de extremo a extremo contra el sistema levantado con docker compose.

    docker compose up -d --build --wait
    python scripts/prueba_humo.py

Recorre el flujo del PDF a traves de nginx (http://localhost:4200/api), igual que el
navegador: el administrador crea un funcionario, la clave temporal llega a Mailpit,
el funcionario debe cambiarla, un ciudadano reporta un asalto con foto, el funcionario
lo atiende y lo cierra con foto, y el ciudadano ve el cambio. Tambien prueba el mantenimiento de entidades y
tipos de incidente, la auditoria y "olvide mi contrasena" (leyendo el enlace desde Mailpit). Al final deja el
sistema como lo encontro: desactiva lo que creo. Sale con codigo 1 si algo falla.
"""
import json
import re
import sys
import time
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

    print("7. Mantenimiento: el administrador agrega una entidad y un tipo de incidente")
    codigo = "H" + uuid.uuid4().hex[:5].upper()
    estado, ent = llamar("POST", BASE + "/admin/mantenimiento/entidades",
                         {"codigo": codigo, "nombre": "Entidad de humo " + codigo}, admin)
    comprobar("entidad creada", estado == 201 and ent["codigo"] == codigo, ent)
    estado, tip = llamar("POST", BASE + "/admin/mantenimiento/tipos-incidente", {
        "nombre": "Tipo de humo " + codigo, "idEntidad": ent["id"], "prioridadBase": 2, "esEmergencia": False}, admin)
    comprobar("tipo de incidente creado en la entidad nueva", estado == 201 and tip["entidadCodigo"] == codigo, tip)
    _, tipos_ciud = llamar("GET", BASE + "/tipos-incidente", token=ciudadano)
    comprobar("el ciudadano ya lo ve en el formulario", any(t["id"] == tip["id"] for t in tipos_ciud))
    estado, dup = llamar("POST", BASE + "/admin/mantenimiento/entidades", {"codigo": codigo.lower(), "nombre": "Repetida"}, admin)
    comprobar("no permite un codigo repetido", estado == 400, dup)

    print("8. Auditoria: queda registrado quien hizo cada cambio")
    estado, aud = llamar("GET", BASE + "/admin/auditoria?tabla=ENTIDAD&usuario=admin", token=admin)
    comprobar("la alta de la entidad figura a nombre de admin",
              estado == 200 and any(f["idRegistro"] == str(ent["id"]) and f["accion"] == "INSERT" for f in aud["items"]), aud)

    print("9. Edicion y alta/baja de un funcionario")
    _, lista = llamar("GET", BASE + "/admin/funcionarios", token=admin)
    mio = next(f for f in lista if f["usuario"] == login)
    estado, edit = llamar("PUT", BASE + "/admin/funcionarios/%d" % mio["id"], {
        "nombreCompleto": "Funcionario Humo Editado", "cedula": "1700000098", "correo": login + "@quito.ec",
        "idEntidad": 4, "cargo": "Jefe de turno"}, admin)
    comprobar("se edita el funcionario", estado == 200 and edit["cargo"] == "Jefe de turno", edit)
    estado, baja = llamar("PATCH", BASE + "/admin/funcionarios/%d/estado" % mio["id"], {"activo": False}, admin)
    comprobar("se da de baja", estado == 200 and baja["estado"] == "I", baja)
    estado, alta = llamar("PATCH", BASE + "/admin/funcionarios/%d/estado" % mio["id"], {"activo": True}, admin)
    comprobar("se vuelve a dar de alta", estado == 200 and alta["estado"] == "A", alta)

    print("10. Olvide mi contrasena: el enlace llega por correo y permite elegir una clave nueva")
    usuario = "olv" + uuid.uuid4().hex[:6]
    estado, _ = llamar("POST", BASE + "/auth/registro", {
        "nombreCompleto": "Ciudadano Olvidadizo", "cedula": "1712345678", "correo": usuario + "@x.ec",
        "usuario": usuario, "password": "ClaveInicial2026*"})
    comprobar("se registra un ciudadano", estado == 201, estado)
    estado, resp = llamar("POST", BASE + "/auth/olvide-password", {"identificador": usuario + "@x.ec"})
    comprobar("la solicitud se acepta", estado == 202, resp)
    token = None
    for _ in range(10):
        _, buzon = llamar("GET", MAILPIT + "/search?query=to:" + usuario + "@x.ec")
        if buzon["messages_count"] >= 1:
            _, mensaje = llamar("GET", MAILPIT + "/message/" + buzon["messages"][0]["ID"])
            coincide = re.search(r"/restablecer\?token=([A-Za-z0-9_-]+)", mensaje["Text"])
            token = coincide.group(1) if coincide else None
            break
        time.sleep(0.5)
    comprobar("llego el correo con el enlace", token is not None)
    estado, resp = llamar("POST", BASE + "/auth/restablecer-password", {"token": token, "passwordNueva": "debil"})
    comprobar("una clave debil se rechaza", estado == 400, resp)
    estado, resp = llamar("POST", BASE + "/auth/restablecer-password", {"token": token, "passwordNueva": "ClaveNueva2026*"})
    comprobar("con una clave valida se restablece", estado == 200, resp)
    estado, _ = llamar("POST", BASE + "/auth/login", {"usuario": usuario, "password": "ClaveNueva2026*"})
    comprobar("entra con la clave nueva", estado == 200, estado)
    estado, _ = llamar("POST", BASE + "/auth/restablecer-password", {"token": token, "passwordNueva": "OtraClave2026*"})
    comprobar("el enlace no se puede usar dos veces", estado == 400, estado)

    print("11. Limpieza: se deja todo como estaba")
    llamar("PATCH", BASE + "/admin/funcionarios/%d/estado" % mio["id"], {"activo": False}, admin)
    llamar("PATCH", BASE + "/admin/mantenimiento/tipos-incidente/%d/estado" % tip["id"], {"activo": False}, admin)
    estado, _ = llamar("PATCH", BASE + "/admin/mantenimiento/entidades/%d/estado" % ent["id"], {"activo": False}, admin)
    comprobar("se desactiva lo creado (el funcionario, el tipo y la entidad)", estado == 200, estado)

    print()
    if fallos:
        print("FALLARON %d comprobaciones: %s" % (len(fallos), "; ".join(fallos)))
        sys.exit(1)
    print("Todo OK")


if __name__ == "__main__":
    main()
