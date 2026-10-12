# 🚨 Alerta Quito

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
├── scripts/prueba_humo.py    Recorre el flujo completo contra el sistema levantado
├── docker-compose.yml        Todo el sistema local con un comando
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

Empezar de cero (vuelve a ejecutar los `reset_*.sql`): `docker compose down -v`.
Para verificar que todo funciona: `python scripts/prueba_humo.py`.

### Opción B — sin Docker para el código

1. Dos bases Postgres (por ejemplo las de `docker compose up db-seguridad db-negocio`) o crearlas a mano y ejecutar
   en DBeaver `reset_seguridad.sql` y `reset_bd.sql` (Execute script · Alt+X) cada una en su base.
2. Servicio: `cd alerta-quito-servicio && mvn spring-boot:run`
3. Interfaz: `cd alerta-quito-interfaz && npm install && npm start` (el proxy envía `/api` al puerto 8080).

## Usuarios de demostración

Se crean en `reset_seguridad.sql` (**solo desarrollo**, cambiar antes de producción).

| Perfil | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin` | `Admin123*` |
| Funcionario EPMMOP | `func.epmmop` | `Func123*` |
| Funcionario Policía | `func.policia` | `Func123*` |
| Ciudadano | `ciudadano.demo` | `Ciud123*` |

## Flujo de usuarios y contraseñas

* **Ciudadano:** se registra solo (`/registro`).
* **Funcionario:** lo crea el **administrador** (menú *Administración*) indicando su entidad. El sistema genera una
  **contraseña temporal**, la envía por correo y la muestra una vez al administrador. Mientras no la cambie, el API solo le
  permite `/api/auth/cambiar-password`; al cambiarla recibe un token nuevo y ya trabaja normal.
* **Olvidó su clave:** el administrador usa *Restablecer clave* → nueva temporal + cambio obligatorio.
* **Bloqueo:** 3 intentos fallidos bloquean al usuario (trigger en la base); solo el administrador lo desbloquea.
* **Correo:** apagado por defecto. Con `CORREO_HABILITADO=true` usa SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USUARIO`,
  `SMTP_CLAVE`, `SMTP_AUTH`, `SMTP_STARTTLS`). En Docker se conecta a **Mailpit**, que muestra los correos sin enviarlos.

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
fuera de Quito, bloqueo, clave temporal, auditoría con el usuario correcto, etc.

El pipeline (`.github/workflows/ci.yml`) ejecuta las tres cosas en cada push y pull request.

## Pendiente (mejoras del PDF)

Conexión real con el ECU 911 (se simula), reportes en otros idiomas, agrupar reportes repetidos, calificar la atención,
tiempos máximos por tipo de incidente, y el despliegue en Render (`render.yaml` y el job `desplegar` del CI, comentados).
