# Alerta Quito

Sistema de reporte de incidentes viales y de seguridad en Quito. El ciudadano reporta con **tipo, foto y ubicación**
(sin llamar por teléfono); el sistema lo **deriva automáticamente** a la entidad competente (EPMMOP, AMT, EEQ, Policía,
Bomberos), prioriza las emergencias y deja al ciudadano **seguir el estado** de su reporte hasta que se resuelve con
evidencia.

Proyecto de Construcción y Evolución de Software (ESPE, NRC 36846) · *Propuesta SI*.

## Estructura

```
AlertaQuito/
├── alerta-quito-servicio/    Spring Boot 3 · Java 21 · JPA · Spring Security + JWT   (lógica y API REST)
├── alerta-quito-interfaz/    Angular 19 · Leaflet                                    (pantallas)
├── base-de-datos/
│   ├── reset_seguridad.sql   BD de seguridad: usuarios, perfiles, intentos de acceso (el "login")
│   └── reset_bd.sql          BD de negocio: reportes, entidades, tipos de incidente, funcionarios
├── scripts/
│   ├── prueba_humo.py        Recorre el flujo completo contra el sistema levantado
│   └── reiniciar_bases.py    Borra y recarga las dos bases con los datos iniciales
├── docker-compose.yml        Todo el sistema local con un comando
├── .env.example              Plantilla para activar un correo real (copiar como .env)
├── render.yaml               Despliegue en Render (comentado: 3er parcial)
└── .github/workflows/ci.yml  Pipeline: pruebas + build + sistema completo
```

### Arquitectura (MVC por capas, igual que SGFDM)

`controller` (REST) → `service` / `service/impl` → `repository` → `entity`, con `dto`, `config`, `auth` y `exception`.
La **vista** es Angular, que consume la API. Hay **dos bases de datos**, cada una con su `DataSource`, `EntityManager`
y transacciones propias (`NegocioDataSourceConfig`, `SeguridadDataSourceConfig`):

| Base | Script | Qué guarda |
|---|---|---|
| `alerta_quito_seguridad` | `reset_seguridad.sql` | usuarios, contraseñas (bcrypt), perfiles/roles, bloqueos, bitácora de ingresos |
| `alerta_quito` | `reset_bd.sql` | ficha del usuario, entidades, funcionarios, tipos de incidente, reportes, ubicación, derivación, historial de estados, evidencias |

El login funciona como en el SGFDM: `CustomAuthenticationProvider` → `AuthService` valida contra la base de seguridad y
cada perfil (`CIUDAD`, `FUNCIO`, `ADMINI`) se convierte en `ROLE_<código>`.

## Cómo correrlo

### Opción A — Docker (recomendada)

```bash
docker compose up --build
```

| | URL |
|---|---|
| Interfaz | http://localhost:4200 |
| API (salud) | http://localhost:8080/actuator/health |
| Correos de prueba (Mailpit) | http://localhost:8025 |
| BD negocio (DBeaver) | `localhost:5432` · `alerta_quito` · `postgres`/`postgres` |
| BD seguridad (DBeaver) | `localhost:5433` · `alerta_quito_seguridad` · `postgres`/`postgres` |

Para verificar que todo funciona: `python scripts/prueba_humo.py`.

### Conectarse con DBeaver

*Nueva conexión → PostgreSQL* y use estos datos (con `docker compose up` corriendo):

| | Base de **negocio** | Base de **seguridad** |
|---|---|---|
| Host | `localhost` | `localhost` |
| Puerto | `5432` | `5433` |
| Base de datos | `alerta_quito` | `alerta_quito_seguridad` |
| Usuario / clave | `postgres` / `postgres` | `postgres` / `postgres` |

(Credenciales de desarrollo, solo accesibles desde su computador.) Las tablas están en *Schemas → public → Tables*.

### Reiniciar las bases cuando haga falta

| Quiero... | Comando |
|---|---|
| Dejar las dos bases como nuevas (usuarios, reportes y auditoría se pierden; los contenedores siguen) | `python scripts/reiniciar_bases.py` |
| Lo mismo desde DBeaver | abrir `base-de-datos/reset_bd.sql` (en la base `alerta_quito`) y `reset_seguridad.sql` (en `alerta_quito_seguridad`) y ejecutar el script completo (Alt+X) |
| Recrear también los contenedores y sus discos | `docker compose down -v` y luego `docker compose up -d --build` |

Cada `reset_*.sql` empieza borrando todo (`DROP`), así que se puede ejecutar las veces que haga falta. Tras reiniciar,
cierre la sesión (*Salir*) del navegador: los usuarios se volvieron a crear.

### Opción B — sin Docker para el código

1. Dos bases Postgres (por ejemplo las de `docker compose up db-seguridad db-negocio`) o crearlas a mano y ejecutar
   en DBeaver `reset_seguridad.sql` y `reset_bd.sql` (Execute script · Alt+X) cada una en su base.
2. Servicio: `cd alerta-quito-servicio && mvn spring-boot:run`
3. Interfaz: `cd alerta-quito-interfaz && npm install && npm start` (el proxy envía `/api` al puerto 8080).

## Diseño y marca

La interfaz sigue el lenguaje visual del SGFDM: Bootstrap 5, íconos Font Awesome 4.7, fuente Cabin, cabecera azul,
menú lateral blanco y un login con imágenes de fondo y panel curvo.

Los archivos de marca viven en `alerta-quito-interfaz/public/images/` (**no** en `dist/`, que se borra al compilar) y sus
nombres se configuran en `alerta-quito-interfaz/src/app/core/marca.ts`:

| Archivo | Uso |
|---|---|
| `imagen1.jpg` … `imagen5.jpg` | Fotos que rotan de fondo en el login y el registro. **Las que no existan se omiten solas.** Para cambiarlas: ponga los originales (`.png`, `.jpg` o `.webp`, 16:9 y de 1920 px de ancho o más; el sujeto hacia la derecha porque el panel del login tapa el tercio izquierdo) en `alerta-quito-interfaz/fotos-originales/` con esos nombres y ejecute `python scripts/preparar_fotos.py`, que los optimiza y los deja en `public/images/`. |
| `slide1..4.svg` | Ilustraciones de respaldo: solo se usan si no existe ninguna foto |
| `logo.svg` (o `.png`) | Logo vertical del panel de acceso (fondo claro) |
| `logo_horizontal.svg` | Logo blanco de la cabecera azul |
| `favicon.svg` | Ícono de la pestaña |

El logo actual es un marcador de posición generado para el proyecto.

## Usuarios de demostración

Se crean en `reset_seguridad.sql` (**solo desarrollo**, cambiar antes de producción).

| Perfil | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin` | `Admin123*` |
| Funcionario EPMMOP | `func.epmmop` | `Func123*` |
| Funcionario Policía | `func.policia` | `Func123*` |
| Ciudadano | `ciudadano.demo` | `Ciud123*` |

## Flujo de usuarios y contraseñas

**Política de contraseñas** (se valida en el API y se muestra en vivo en las pantallas de registro y cambio de clave):
entre 8 y 72 caracteres, al menos una mayúscula, una minúscula, un número y un símbolo, sin espacios y sin contener el
nombre de usuario. Aplica al autoregistro, al cambio de clave y a cualquier clave que asigne el administrador; las
temporales que genera el sistema siempre la cumplen (`PoliticaPassword`, `ClaveSegura`, `core/validadores.ts`).

* **Ciudadano:** se registra solo (`/registro`).
* **Funcionario:** lo crea el **administrador** (*Mantenimiento → Funcionarios*) indicando su entidad. El sistema genera
  una **contraseña temporal**, la envía por correo y la muestra una vez al administrador. Mientras no la cambie, el API
  solo le permite `/api/auth/cambiar-password` (debe escribir la temporal y una nueva); al cambiarla ya trabaja normal.
* **Olvidó su clave (autoservicio):** en el login, *¿Olvidó su contraseña?* → escribe su usuario o correo → recibe un
  enlace que vence en 30 minutos y sirve una sola vez → elige una clave nueva (que también desbloquea la cuenta). Del
  enlace solo se guarda el hash del token; la respuesta es igual exista o no la cuenta; máximo 3 solicitudes por hora.
* **Olvidó su clave (por el administrador):** *Restablecer clave* en Funcionarios o Usuarios → nueva temporal + cambio obligatorio.
* **Bloqueo:** 3 intentos fallidos bloquean al usuario (trigger en la base); lo desbloquea el administrador o el enlace
  de recuperación.

### Correo

El sistema envía correos con Spring Mail (claves temporales y enlaces de recuperación). Por defecto, en Docker, va a
**Mailpit** (http://localhost:8025): un buzón falso que muestra los correos *sin entregarlos a nadie*. Para que lleguen
a bandejas reales **no hace falta tener un servidor propio**: se usa el SMTP de un proveedor (Gmail con contraseña de
aplicación o Brevo, ambos gratis). Copie `.env.example` como `.env`, descomente la opción elegida, complete usuario y
clave y reinicie con `docker compose up -d`. El detalle paso a paso está dentro de `.env.example`.

Con `CORREO_HABILITADO=false` no se envía nada: el administrador ve la clave temporal en pantalla y entrega el enlace
de recuperación por otro medio.

## Mantenimiento y auditoría (administrador)

Como en el SGFDM, el administrador gestiona los catálogos desde la aplicación, sin tocar la base:

| Pantalla | Qué permite |
|---|---|
| *Mantenimiento → Entidades* | Alta, edición y activar/desactivar entidades de respuesta. No se desactiva una entidad con tipos o funcionarios activos. |
| *Mantenimiento → Tipos de incidente* | Alta y edición: nombre, entidad que lo atiende, prioridad (1 a 4) y si es emergencia (siempre prioridad 1). Un tipo nuevo aparece enseguida en el formulario del ciudadano y sus reportes se derivan a la entidad elegida. A un tipo con reportes no se le cambia la entidad. |
| *Mantenimiento → Funcionarios* | Alta, **edición** (nombre, cédula, correo, cargo, entidad), baja y **nueva alta**, restablecer clave, búsqueda y filtro por estado. |
| *Usuarios* | Desbloquear cuentas y restablecer claves. |
| *Auditoría* | Últimos 100 movimientos de las dos bases con filtros por tabla, acción y usuario; *Ver cambios* muestra cada versión del registro y resalta lo que cambió. |
| *Estadísticas* | Reportes por estado y por tipo. |

Nada se borra: se activa o desactiva, para conservar el historial. Todo cambio queda en las tablas `*_hist` y `auditoria`
con el usuario real.

## Reglas que garantiza la base de datos (triggers)

| Regla del PDF | Dónde |
|---|---|
| Número de reporte `RQ-2026-000001`, prioridad según el tipo | `fn_reporte_antes_insertar` |
| Derivación automática a la entidad del tipo (bache → EPMMOP, asalto → Policía) | `fn_reporte_despues_insertar` |
| Un reporte sin foto no existe | `fn_reporte_exige_foto` (constraint trigger diferido) |
| Solo transiciones válidas; no se resuelve sin foto de resolución; un caso cerrado no se reabre | `fn_reporte_antes_actualizar` |
| Cada cambio de estado con fecha y responsable | `fn_reporte_despues_actualizar` → `historial_estado` |
| Ubicación solo dentro de Quito | `CHECK` en `ubicacion` |
| La evidencia no se edita ni se borra | `fn_evidencia_inmutable` |
| Bloqueo tras 3 intentos fallidos | `fn_usuario_bloqueo` (BD de seguridad) |
| **Mantenimiento:** historial (`*_hist`) y auditoría de entidades, tipos de incidente, funcionarios, usuarios y perfiles | `fn_*_audit` → `auditoria` |

El API envía el usuario real a los triggers con `set_config('app.usuario', …)` (equivale al `DBMS_SESSION.SET_IDENTIFIER`
del SGFDM), así la auditoría dice **quién** hizo el cambio y no solo "postgres".

## Pruebas

```bash
cd alerta-quito-servicio && mvn verify      # unitarias + integración (Testcontainers, requiere Docker)
cd alerta-quito-interfaz && npm test        # Karma/Jasmine (Chrome)
python scripts/prueba_humo.py               # extremo a extremo (con docker compose arriba)
```

La prueba de integración (`FlujoReportesIT`) levanta **dos Postgres reales** y les carga los mismos `reset_*.sql`, de modo
que los triggers se prueban de verdad: bache solo a la EPMMOP, asalto con prioridad máxima, resolver sin foto, reporte
fuera de Quito, bloqueo, clave temporal, recuperación de contraseña por enlace, mantenimiento de entidades, tipos y
funcionarios (con altas, bajas y ediciones), auditoría con el usuario correcto, etc.

El pipeline (`.github/workflows/ci.yml`) ejecuta las tres cosas en cada push y pull request.

## Pendiente (mejoras del PDF)

Conexión real con el ECU 911 (se simula), reportes en otros idiomas, agrupar reportes repetidos, calificar la atención,
tiempos máximos por tipo de incidente, y el despliegue en Render (`render.yaml` y el job `desplegar` del CI, comentados).
