package ec.edu.espe.alertaquito;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import ec.edu.espe.alertaquito.service.CorreoService;
import org.mockito.ArgumentCaptor;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.sql.DataSource;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Prueba de integracion de punta a punta: levanta DOS Postgres reales (seguridad
 * y negocio), les carga exactamente reset_seguridad.sql y reset_bd.sql (con sus
 * triggers) y recorre el flujo del PDF con HTTP real contra los controladores.
 * Necesita Docker.
 */
@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class FlujoReportesIT {

    static final PostgreSQLContainer<?> SEGURIDAD = new PostgreSQLContainer<>("postgres:16-alpine").withDatabaseName("seg");
    static final PostgreSQLContainer<?> NEGOCIO = new PostgreSQLContainer<>("postgres:16-alpine").withDatabaseName("neg");
    static final Path EVIDENCIAS;

    static {
        SEGURIDAD.start();
        NEGOCIO.start();
        try {
            ejecutarScript(SEGURIDAD, "/reset_seguridad.sql");
            ejecutarScript(NEGOCIO, "/reset_bd.sql");
            EVIDENCIAS = Files.createTempDirectory("evidencias-it");
        } catch (IOException | SQLException e) {
            throw new IllegalStateException(e);
        }
    }

    static void ejecutarScript(PostgreSQLContainer<?> bd, String recurso) throws IOException, SQLException {
        String sql = new String(FlujoReportesIT.class.getResourceAsStream(recurso).readAllBytes(), StandardCharsets.UTF_8);
        try (Connection c = DriverManager.getConnection(bd.getJdbcUrl(), bd.getUsername(), bd.getPassword())) {
            c.createStatement().execute(sql);
        }
    }

    @DynamicPropertySource
    static void propiedades(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", NEGOCIO::getJdbcUrl);
        r.add("spring.datasource.username", NEGOCIO::getUsername);
        r.add("spring.datasource.password", NEGOCIO::getPassword);
        r.add("spring.seguridad-datasource.url", SEGURIDAD::getJdbcUrl);
        r.add("spring.seguridad-datasource.username", SEGURIDAD::getUsername);
        r.add("spring.seguridad-datasource.password", SEGURIDAD::getPassword);
        r.add("app.almacenamiento.directorio", () -> EVIDENCIAS.toString());
    }

    /** El correo se simula: asi la prueba puede leer el enlace de restablecimiento que se habria enviado. */
    @MockBean CorreoService correo;

    @Autowired MockMvc mvc;
    @Autowired @Qualifier("negocioDataSource") DataSource negocio;

    // ------------------------------------------------------------ ayudas

    static final byte[] JPG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x00, 0x01};

    ResultActions login(String usuario, String clave) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"usuario\":\"" + usuario + "\",\"password\":\"" + clave + "\"}"));
    }

    String token(String usuario, String clave) throws Exception {
        String cuerpo = login(usuario, clave).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return JsonPath.read(cuerpo, "$.token");
    }

    String ciudadano() throws Exception {
        return token("ciudadano.demo", "Ciud123*");
    }

    int idTipo(String token, String nombre) throws Exception {
        String cuerpo = mvc.perform(get("/api/tipos-incidente").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        java.util.List<Integer> ids = JsonPath.read(cuerpo, "$[?(@.nombre=='" + nombre + "')].id");
        return ids.get(0);
    }

    ResultActions crearReporte(String token, int idTipo, String lat, String lng) throws Exception {
        String datos = "{\"idTipoIncidente\":" + idTipo + ",\"descripcion\":\"prueba\",\"latitud\":" + lat
                + ",\"longitud\":" + lng + ",\"direccion\":\"Av. 10 de Agosto y Colon\"}";
        return mvc.perform(multipart("/api/reportes")
                .file(new MockMultipartFile("datos", "", "application/json", datos.getBytes(StandardCharsets.UTF_8)))
                .file(new MockMultipartFile("foto", "foto.jpg", "image/jpeg", JPG))
                .header("Authorization", "Bearer " + token));
    }

    long reporteNuevo(String token, String tipo) throws Exception {
        String cuerpo = crearReporte(token, idTipo(token, tipo), "-0.2000", "-78.5000")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return ((Number) JsonPath.read(cuerpo, "$.reporte.id")).longValue();
    }

    ResultActions cambiarEstado(String token, long id, String estado, boolean conFoto) throws Exception {
        MockMultipartHttpServletRequestBuilder req = multipart("/api/reportes/" + id + "/estado");
        req.param("estado", estado).param("comentario", "ok").header("Authorization", "Bearer " + token);
        if (conFoto) {
            req.file(new MockMultipartFile("foto", "solucion.jpg", "image/jpeg", JPG));
        }
        return mvc.perform(req);
    }

    String registrarCiudadano(String usuario) throws Exception {
        String cuerpo = "{\"nombreCompleto\":\"Persona " + usuario + "\",\"cedula\":\"1712345678\",\"correo\":\""
                + usuario + "@x.ec\",\"usuario\":\"" + usuario + "\",\"password\":\"Clave1234*\"}";
        mvc.perform(post("/api/auth/registro").contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isCreated());
        return usuario;
    }

    // ------------------------------------------------------------ pruebas

    @Test
    void elReporteDeUnAsaltoSeDerivaALaPoliciaConPrioridadMaxima() throws Exception {
        String tk = ciudadano();

        String cuerpo = crearReporte(tk, idTipo(tk, "Robo o asalto"), "-0.2000", "-78.5000")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.reporte.estado").value("REGISTRADO"))
                .andExpect(jsonPath("$.reporte.prioridad").value(1))
                .andExpect(jsonPath("$.reporte.entidad").value("POLICIA"))
                .andExpect(jsonPath("$.historial.length()").value(1))
                .andExpect(jsonPath("$.evidencias[0].tipo").value("CREACION"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        String codigo = JsonPath.read(cuerpo, "$.reporte.codigo");
        assertTrue(codigo.matches("RQ-\\d{4}-\\d{6}"), codigo);
    }

    @Test
    void unBacheLlegaSoloALaEpmmopYNoALaPolicia() throws Exception {
        long id = reporteNuevo(ciudadano(), "Bache");
        String epmmop = token("func.epmmop", "Func123*");
        String policia = token("func.policia", "Func123*");

        mvc.perform(get("/api/reportes/bandeja").header("Authorization", "Bearer " + epmmop))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id==" + id + ")]").isNotEmpty());
        mvc.perform(get("/api/reportes/bandeja").header("Authorization", "Bearer " + policia))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id==" + id + ")]").isEmpty());
        mvc.perform(get("/api/reportes/" + id).header("Authorization", "Bearer " + policia))
                .andExpect(status().isForbidden());
    }

    @Test
    void laBandejaPoneLasEmergenciasPrimero() throws Exception {
        String tk = ciudadano();
        reporteNuevo(tk, "Bache");
        reporteNuevo(tk, "Accidente de tránsito");   // AMT
        reporteNuevo(tk, "Semáforo dañado");
        String epmmop = token("func.epmmop", "Func123*");

        String cuerpo = mvc.perform(get("/api/reportes/bandeja").header("Authorization", "Bearer " + epmmop))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        java.util.List<Integer> prioridades = JsonPath.read(cuerpo, "$[*].prioridad");

        assertEquals(prioridades.stream().sorted().toList(), prioridades, "ordenada de mas a menos urgente");
    }

    @Test
    void noSePuedeResolverSinFotoYSiConFoto() throws Exception {
        long id = reporteNuevo(ciudadano(), "Semáforo dañado");
        String epmmop = token("func.epmmop", "Func123*");

        cambiarEstado(epmmop, id, "EN_ATENCION", false).andExpect(status().isOk())
                .andExpect(jsonPath("$.reporte.estado").value("EN_ATENCION"));
        cambiarEstado(epmmop, id, "RESUELTO", false).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("foto")));
        cambiarEstado(epmmop, id, "RESUELTO", true).andExpect(status().isOk())
                .andExpect(jsonPath("$.reporte.estado").value("RESUELTO"))
                .andExpect(jsonPath("$.historial.length()").value(3))
                .andExpect(jsonPath("$.evidencias.length()").value(2));

        // El ciudadano ve el cambio (RF-05).
        mvc.perform(get("/api/reportes/mios").header("Authorization", "Bearer " + ciudadano()))
                .andExpect(jsonPath("$[?(@.id==" + id + ")].estado").value("RESUELTO"));
    }

    @Test
    void unCasoCerradoNoSeReabre() throws Exception {
        long id = reporteNuevo(ciudadano(), "Bache");
        String epmmop = token("func.epmmop", "Func123*");
        cambiarEstado(epmmop, id, "EN_ATENCION", false).andExpect(status().isOk());
        cambiarEstado(epmmop, id, "RESUELTO", true).andExpect(status().isOk());

        cambiarEstado(epmmop, id, "EN_ATENCION", false).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("Transicion")));
    }

    @Test
    void unFuncionarioNoPuedeCambiarReportesDeOtraEntidad() throws Exception {
        long id = reporteNuevo(ciudadano(), "Robo o asalto");

        cambiarEstado(token("func.epmmop", "Func123*"), id, "EN_REVISION", false).andExpect(status().isForbidden());
    }

    @Test
    void unReporteSinFotoOFueraDeQuitoSeRechaza() throws Exception {
        String tk = ciudadano();
        int tipo = idTipo(tk, "Bache");

        crearReporte(tk, tipo, "40.4168", "-3.7038").andExpect(status().isBadRequest());   // Madrid
        String datos = "{\"idTipoIncidente\":" + tipo + ",\"latitud\":-0.2,\"longitud\":-78.5}";
        mvc.perform(multipart("/api/reportes")
                        .file(new MockMultipartFile("datos", "", "application/json", datos.getBytes()))
                        .header("Authorization", "Bearer " + tk))
                .andExpect(status().isBadRequest());
    }

    @Test
    void soloElCiudadanoCreaReportesYSoloElFuncionarioVeLaBandeja() throws Exception {
        String epmmop = token("func.epmmop", "Func123*");

        crearReporte(epmmop, 1, "-0.2", "-78.5").andExpect(status().isForbidden());
        mvc.perform(get("/api/reportes/bandeja").header("Authorization", "Bearer " + ciudadano()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/reportes/mios")).andExpect(status().isUnauthorized());
    }

    @Test
    void solo_el_dueno_y_su_entidad_descargan_la_foto() throws Exception {
        String tk = ciudadano();
        long id = reporteNuevo(tk, "Bache");
        String cuerpo = mvc.perform(get("/api/reportes/" + id).header("Authorization", "Bearer " + tk))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        int idEvidencia = JsonPath.read(cuerpo, "$.evidencias[0].id");
        String url = "/api/reportes/" + id + "/evidencias/" + idEvidencia + "/archivo";
        registrarCiudadano("curioso" + UUID.randomUUID().toString().substring(0, 6));

        mvc.perform(get(url).header("Authorization", "Bearer " + tk)).andExpect(status().isOk())
                .andExpect(content().contentType("image/jpeg"));
        mvc.perform(get(url).header("Authorization", "Bearer " + token("func.epmmop", "Func123*")))
                .andExpect(status().isOk());
        mvc.perform(get(url).header("Authorization", "Bearer " + token("func.policia", "Func123*")))
                .andExpect(status().isForbidden());
    }

    @Test
    void laPoliticaDeContrasenasSeAplicaEnRegistroYEnCambioDeClave() throws Exception {
        String sufijo = UUID.randomUUID().toString().substring(0, 6);
        String[] debiles = {"corta1*", "sinmayuscula1*", "SINMINUSCULA1*", "SinNumeros*", "SinSimbolo123", "Con Espacio1*"};

        for (String clave : debiles) {
            String cuerpo = "{\"nombreCompleto\":\"Persona Debil\",\"cedula\":\"1712345678\",\"correo\":\"d" + sufijo
                    + "@x.ec\",\"usuario\":\"debil" + sufijo + "\",\"password\":\"" + clave + "\"}";
            mvc.perform(post("/api/auth/registro").contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("contraseña")));
        }

        // El usuario no puede estar dentro de la clave.
        String conUsuario = "{\"nombreCompleto\":\"Persona\",\"cedula\":\"1712345678\",\"correo\":\"u" + sufijo
                + "@x.ec\",\"usuario\":\"carlos" + sufijo + "\",\"password\":\"Carlos" + sufijo + "2026*\"}";
        mvc.perform(post("/api/auth/registro").contentType(MediaType.APPLICATION_JSON).content(conUsuario))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("nombre de usuario")));

        // Al cambiar la clave rige la misma politica.
        String usuario = registrarCiudadano("pol" + sufijo);
        String tk = token(usuario, "Clave1234*");
        cambiarPassword(tk, "Clave1234*", "debil").andExpect(status().isBadRequest());
        cambiarPassword(tk, "Clave1234*", "SinSimbolo123").andExpect(status().isBadRequest());
        cambiarPassword(tk, "Clave1234*", "Otra.Clave2026").andExpect(status().isOk());
    }

    @Test
    void elAdministradorNoPuedeAsignarUnaClaveDebilAUnFuncionario() throws Exception {
        String admin = token("admin", "Admin123*");
        String usuario = "dbl" + UUID.randomUUID().toString().substring(0, 6);
        String cuerpo = "{\"nombreCompleto\":\"Funcionario\",\"cedula\":\"1798765434\",\"correo\":\"" + usuario
                + "@quito.ec\",\"usuario\":\"" + usuario + "\",\"password\":\"12345678\",\"idEntidad\":1}";

        mvc.perform(post("/api/admin/funcionarios").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isBadRequest());
        login(usuario, "12345678").andExpect(status().isUnauthorized());   // no se creo nada
    }

    // ------------------------------------------------------------ mantenimiento

    String admin() throws Exception {
        return token("admin", "Admin123*");
    }

    ResultActions json(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req, String token, String cuerpo) throws Exception {
        return mvc.perform(req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(cuerpo == null ? "" : cuerpo));
    }

    int idDe(ResultActions r) throws Exception {
        return JsonPath.read(r.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), "$.id");
    }

    @Test
    void elAdministradorAgregaUnaEntidadYUnTipoDeIncidenteYLosReportesLlegandoAlaNueva() throws Exception {
        String admin = admin();
        String sufijo = UUID.randomUUID().toString().substring(0, 4).toUpperCase();

        int idEntidad = idDe(json(post("/api/admin/mantenimiento/entidades"), admin,
                "{\"codigo\":\"t" + sufijo.toLowerCase() + "\",\"nombre\":\"Entidad de prueba " + sufijo + "\",\"descripcion\":\"Creada en una prueba\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.codigo").value("T" + sufijo))   // se guarda en mayusculas
                .andExpect(jsonPath("$.estado").value("A")));
        int idTipo = idDe(json(post("/api/admin/mantenimiento/tipos-incidente"), admin,
                "{\"nombre\":\"Fuga de gas " + sufijo + "\",\"idEntidad\":" + idEntidad + ",\"prioridadBase\":1,\"esEmergencia\":true}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.entidadCodigo").value("T" + sufijo)));

        // Aparece en el formulario del ciudadano y su reporte llega a la entidad nueva con prioridad critica.
        String ciud = ciudadano();
        mvc.perform(get("/api/tipos-incidente").header("Authorization", "Bearer " + ciud))
                .andExpect(jsonPath("$[?(@.id==" + idTipo + ")].entidadCodigo").value("T" + sufijo));
        crearReporte(ciud, idTipo, "-0.2000", "-78.5000").andExpect(status().isCreated())
                .andExpect(jsonPath("$.reporte.entidad").value("T" + sufijo))
                .andExpect(jsonPath("$.reporte.prioridad").value(1));
    }

    @Test
    void elMantenimientoValidaDuplicadosYReglasDeNegocio() throws Exception {
        String admin = admin();
        // codigo repetido (EPMMOP viene en los datos iniciales), sin importar mayusculas
        json(post("/api/admin/mantenimiento/entidades"), admin, "{\"codigo\":\"epmmop\",\"nombre\":\"Otra\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("EPMMOP")));
        json(post("/api/admin/mantenimiento/entidades"), admin, "{\"codigo\":\"mal codigo!\",\"nombre\":\"X\"}")
                .andExpect(status().isBadRequest());
        // nombre de tipo repetido
        json(post("/api/admin/mantenimiento/tipos-incidente"), admin,
                "{\"nombre\":\"bache\",\"idEntidad\":1,\"prioridadBase\":3,\"esEmergencia\":false}")
                .andExpect(status().isBadRequest());
        // una emergencia debe ser prioridad 1
        json(post("/api/admin/mantenimiento/tipos-incidente"), admin,
                "{\"nombre\":\"Emergencia floja\",\"idEntidad\":1,\"prioridadBase\":3,\"esEmergencia\":true}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("prioridad 1")));
        // prioridad fuera de rango
        json(post("/api/admin/mantenimiento/tipos-incidente"), admin,
                "{\"nombre\":\"Fuera de rango\",\"idEntidad\":1,\"prioridadBase\":9,\"esEmergencia\":false}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void unTipoDesactivadoDejaDeOfrecerseYNoSeCambiaLaEntidadSiYaTieneReportes() throws Exception {
        String admin = admin();
        String ciud = ciudadano();
        String sufijo = UUID.randomUUID().toString().substring(0, 6);
        int idTipo = idDe(json(post("/api/admin/mantenimiento/tipos-incidente"), admin,
                "{\"nombre\":\"Tipo temporal " + sufijo + "\",\"idEntidad\":1,\"prioridadBase\":4,\"esEmergencia\":false}")
                .andExpect(status().isCreated()));
        crearReporte(ciud, idTipo, "-0.2000", "-78.5000").andExpect(status().isCreated());

        // ya tiene un reporte: no se puede pasar a otra entidad
        json(put("/api/admin/mantenimiento/tipos-incidente/" + idTipo), admin,
                "{\"nombre\":\"Tipo temporal " + sufijo + "\",\"idEntidad\":2,\"prioridadBase\":4,\"esEmergencia\":false}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("reporte(s)")));
        // pero si se puede renombrar y cambiar la prioridad
        json(put("/api/admin/mantenimiento/tipos-incidente/" + idTipo), admin,
                "{\"nombre\":\"Tipo renombrado " + sufijo + "\",\"idEntidad\":1,\"prioridadBase\":2,\"esEmergencia\":false}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.prioridadBase").value(2)).andExpect(jsonPath("$.reportes").value(1));

        // desactivar: desaparece del formulario y ya no se puede reportar con el
        json(patch("/api/admin/mantenimiento/tipos-incidente/" + idTipo + "/estado"), admin, "{\"activo\":false}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("I"));
        mvc.perform(get("/api/tipos-incidente").header("Authorization", "Bearer " + ciud))
                .andExpect(jsonPath("$[?(@.id==" + idTipo + ")]").isEmpty());
        crearReporte(ciud, idTipo, "-0.2000", "-78.5000").andExpect(status().isNotFound());
        // el administrador lo sigue viendo y puede reactivarlo
        mvc.perform(get("/api/admin/mantenimiento/tipos-incidente").header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$[?(@.id==" + idTipo + ")].estado").value("I"));
        json(patch("/api/admin/mantenimiento/tipos-incidente/" + idTipo + "/estado"), admin, "{\"activo\":true}")
                .andExpect(jsonPath("$.estado").value("A"));
    }

    @Test
    void noSeDesactivaUnaEntidadConTiposActivosYSiCuandoYaNoTieneNada() throws Exception {
        String admin = admin();
        String sufijo = UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        int idEntidad = idDe(json(post("/api/admin/mantenimiento/entidades"), admin,
                "{\"codigo\":\"d" + sufijo + "\",\"nombre\":\"Temporal " + sufijo + "\"}").andExpect(status().isCreated()));
        int idTipo = idDe(json(post("/api/admin/mantenimiento/tipos-incidente"), admin,
                "{\"nombre\":\"Tipo de la temporal " + sufijo + "\",\"idEntidad\":" + idEntidad + ",\"prioridadBase\":3,\"esEmergencia\":false}")
                .andExpect(status().isCreated()));

        json(patch("/api/admin/mantenimiento/entidades/" + idEntidad + "/estado"), admin, "{\"activo\":false}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("tipo(s) de incidente activo(s)")));

        json(patch("/api/admin/mantenimiento/tipos-incidente/" + idTipo + "/estado"), admin, "{\"activo\":false}").andExpect(status().isOk());
        json(patch("/api/admin/mantenimiento/entidades/" + idEntidad + "/estado"), admin, "{\"activo\":false}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("I"));
        // con la entidad inactiva ya no se puede reactivar el tipo
        json(patch("/api/admin/mantenimiento/tipos-incidente/" + idTipo + "/estado"), admin, "{\"activo\":true}")
                .andExpect(status().isBadRequest());
    }

    @Test
    void elMantenimientoYLaAuditoriaSonSoloParaElAdministrador() throws Exception {
        for (String tk : new String[]{ciudadano(), token("func.epmmop", "Func123*")}) {
            mvc.perform(get("/api/admin/mantenimiento/entidades").header("Authorization", "Bearer " + tk)).andExpect(status().isForbidden());
            mvc.perform(get("/api/admin/mantenimiento/tipos-incidente").header("Authorization", "Bearer " + tk)).andExpect(status().isForbidden());
            mvc.perform(get("/api/admin/auditoria").header("Authorization", "Bearer " + tk)).andExpect(status().isForbidden());
            json(post("/api/admin/mantenimiento/entidades"), tk, "{\"codigo\":\"HACK\",\"nombre\":\"x\"}").andExpect(status().isForbidden());
        }
        mvc.perform(get("/api/admin/auditoria")).andExpect(status().isUnauthorized());
    }

    // ------------------------------------------------------------ auditoria

    @Test
    void laAuditoriaRegistraQuienHizoCadaCambioEnLasDosBasesYMuestraElHistorial() throws Exception {
        String admin = admin();
        String sufijo = UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        int idEntidad = idDe(json(post("/api/admin/mantenimiento/entidades"), admin,
                "{\"codigo\":\"a" + sufijo + "\",\"nombre\":\"Auditada " + sufijo + "\"}").andExpect(status().isCreated()));
        json(put("/api/admin/mantenimiento/entidades/" + idEntidad), admin,
                "{\"codigo\":\"a" + sufijo + "\",\"nombre\":\"Auditada y renombrada " + sufijo + "\",\"descripcion\":\"cambio\"}")
                .andExpect(status().isOk());
        registrarCiudadano("aud" + sufijo.toLowerCase());   // deja huella en la base de SEGURIDAD

        // filtro por tabla y usuario: la alta y la edicion de la entidad, hechas por "admin"
        String cuerpo = mvc.perform(get("/api/admin/auditoria").param("tabla", "ENTIDAD").param("usuario", "admin")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPaginas").isNumber())
                .andExpect(jsonPath("$.tablas").isArray())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        java.util.List<String> acciones = JsonPath.read(cuerpo, "$.items[?(@.idRegistro=='" + idEntidad + "')].accion");
        assertTrue(acciones.contains("INSERT") && acciones.contains("UPDATE"), acciones.toString());
        java.util.List<String> usuarios = JsonPath.read(cuerpo, "$.items[*].usuario");
        assertTrue(usuarios.stream().allMatch("admin"::equals), "el filtro por usuario solo trae a admin");

        // las dos bases: lo de seguridad tambien aparece
        mvc.perform(get("/api/admin/auditoria").param("tabla", "USUARIO").header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$.items[?(@.origen=='SEGURIDAD')]").isNotEmpty());
        // filtro por accion
        mvc.perform(get("/api/admin/auditoria").param("accion", "DELETE").header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$.items[?(@.accion!='DELETE')]").isEmpty());
        mvc.perform(get("/api/admin/auditoria").param("accion", "BORRAR").header("Authorization", "Bearer " + admin))
                .andExpect(status().isBadRequest());

        // historial: las dos versiones del registro (antes y despues del cambio)
        String hist = mvc.perform(get("/api/admin/auditoria/historial").param("origen", "NEGOCIO").param("tabla", "ENTIDAD")
                        .param("idRegistro", String.valueOf(idEntidad)).header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        java.util.List<String> nombres = JsonPath.read(hist, "$[*].nombre");
        assertEquals(java.util.List.of("Auditada " + sufijo, "Auditada y renombrada " + sufijo), nombres);
        java.util.List<String> operaciones = JsonPath.read(hist, "$[*].operacion");
        assertEquals(java.util.List.of("INSERT", "UPDATE"), operaciones);
    }

    @Test
    void laAuditoriaSoloMuestraLosUltimos100RegistrosYRechazaTablasQueNoTienenHistorial() throws Exception {
        String admin = admin();
        mvc.perform(get("/api/admin/auditoria").param("pagina", "99").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagina").value(org.hamcrest.Matchers.lessThanOrEqualTo(4)))
                .andExpect(jsonPath("$.items.length()").value(org.hamcrest.Matchers.lessThanOrEqualTo(20)));
        mvc.perform(get("/api/admin/auditoria/historial").param("origen", "NEGOCIO").param("tabla", "REPORTE; DROP TABLE reporte")
                        .param("idRegistro", "1").header("Authorization", "Bearer " + admin))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/admin/auditoria/historial").param("origen", "NEGOCIO").param("tabla", "ENTIDAD")
                        .param("idRegistro", "no-numero").header("Authorization", "Bearer " + admin))
                .andExpect(status().isBadRequest());
    }

    // ------------------------------------------------------------ "olvide mi contrasena"

    String enlaceEnviado() {
        ArgumentCaptor<String> enlace = ArgumentCaptor.forClass(String.class);
        verify(correo, org.mockito.Mockito.atLeastOnce()).enviarRestablecimiento(anyString(), anyString(), anyString(), enlace.capture(), anyInt());
        return enlace.getValue();
    }

    ResultActions olvide(String identificador) throws Exception {
        return mvc.perform(post("/api/auth/olvide-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"identificador\":\"" + identificador + "\"}"));
    }

    ResultActions restablecer(String token, String clave) throws Exception {
        return mvc.perform(post("/api/auth/restablecer-password").contentType(MediaType.APPLICATION_JSON)
                .content("{\"token\":\"" + token + "\",\"passwordNueva\":\"" + clave + "\"}"));
    }

    @Test
    void unUsuarioQueOlvidoSuClaveRecuperaElAccesoPorCorreoYDesbloqueaLaCuenta() throws Exception {
        String usuario = registrarCiudadano("olv" + UUID.randomUUID().toString().substring(0, 6));
        // la bloquea con 3 intentos fallidos
        for (int i = 0; i < 3; i++) login(usuario, "mala" + i);
        login(usuario, "Clave1234*").andExpect(status().isLocked());

        olvide(usuario).andExpect(status().isAccepted());
        String enlace = enlaceEnviado();
        assertTrue(enlace.contains("/restablecer?token="), enlace);
        String token = enlace.substring(enlace.indexOf("token=") + 6);

        // una clave debil se rechaza y el enlace sigue sirviendo
        restablecer(token, "debil").andExpect(status().isBadRequest());
        restablecer(token, "NuevaClave2026*").andExpect(status().isOk());

        login(usuario, "Clave1234*").andExpect(status().isUnauthorized());           // la anterior ya no sirve
        login(usuario, "NuevaClave2026*").andExpect(status().isOk());                 // y la cuenta quedo desbloqueada
        restablecer(token, "OtraClave2026*").andExpect(status().isBadRequest());     // el enlace sirve una sola vez
    }

    @Test
    void laSolicitudNoRevelaSiLaCuentaExisteYAceptaUsuarioOCorreo() throws Exception {
        String usuario = registrarCiudadano("cor" + UUID.randomUUID().toString().substring(0, 6));

        String existente = olvide(usuario).andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String inexistente = olvide("nadie.existe.jamas").andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertEquals(existente, inexistente, "misma respuesta exista o no la cuenta");

        org.mockito.Mockito.reset(correo);
        olvide(usuario + "@x.ec").andExpect(status().isAccepted());   // por correo (el registro usa usuario@x.ec)
        verify(correo).enviarRestablecimiento(eq(usuario + "@x.ec"), anyString(), eq(usuario), anyString(), eq(30));
        org.mockito.Mockito.reset(correo);
        olvide("nadie.existe.jamas");
        verify(correo, never()).enviarRestablecimiento(any(), any(), any(), any(), anyInt());
    }

    @Test
    void unEnlaceNuevoAnulaAlAnteriorYUnTokenFalsoSeRechaza() throws Exception {
        String usuario = registrarCiudadano("anu" + UUID.randomUUID().toString().substring(0, 6));
        org.mockito.Mockito.reset(correo);

        olvide(usuario);
        String primero = enlaceEnviado();
        org.mockito.Mockito.reset(correo);
        olvide(usuario);
        String segundo = enlaceEnviado();
        assertNotEquals(primero, segundo);

        restablecer(primero.substring(primero.indexOf("token=") + 6), "NuevaClave2026*").andExpect(status().isBadRequest());
        restablecer("token-inventado", "NuevaClave2026*").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("no es válido")));
        restablecer(segundo.substring(segundo.indexOf("token=") + 6), "NuevaClave2026*").andExpect(status().isOk());
    }

    @Test
    void sePuedeUsarElEnlaceSinSesionYElLimiteDeSolicitudesEvitaElAbuso() throws Exception {
        String usuario = registrarCiudadano("lim" + UUID.randomUUID().toString().substring(0, 6));
        org.mockito.Mockito.reset(correo);

        for (int i = 0; i < 6; i++) olvide(usuario).andExpect(status().isAccepted());

        verify(correo, org.mockito.Mockito.times(3)).enviarRestablecimiento(anyString(), anyString(), eq(usuario), anyString(), anyInt());
    }

    // ------------------------------------------------------------ CRUD de funcionarios

    int crearFuncionario(String admin, String usuario, int idEntidad) throws Exception {
        String cuerpo = "{\"nombreCompleto\":\"Funcionario " + usuario + "\",\"cedula\":\"1711111111\",\"correo\":\"" + usuario
                + "@quito.ec\",\"usuario\":\"" + usuario + "\",\"idEntidad\":" + idEntidad + ",\"cargo\":\"Inspector\"}";
        String r = json(post("/api/admin/funcionarios"), admin, cuerpo).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return JsonPath.read(r, "$.funcionario.id");
    }

    @Test
    void elAdministradorEditaUnFuncionarioYSeActualizanLasDosBases() throws Exception {
        String admin = admin();
        String usuario = "edi" + UUID.randomUUID().toString().substring(0, 6);
        int id = crearFuncionario(admin, usuario, 1);

        String editado = json(put("/api/admin/funcionarios/" + id), admin,
                "{\"nombreCompleto\":\"Nombre Corregido\",\"cedula\":\"1722222222\",\"correo\":\"nuevo." + usuario
                        + "@quito.ec\",\"idEntidad\":2,\"cargo\":\"Jefe de turno\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.usuario").value(usuario))                 // el login no cambia
                .andExpect(jsonPath("$.nombreCompleto").value("Nombre Corregido"))
                .andExpect(jsonPath("$.cedula").value("1722222222"))
                .andExpect(jsonPath("$.entidadCodigo").value("AMT"))
                .andExpect(jsonPath("$.cargo").value("Jefe de turno"))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertEquals(id, (int) JsonPath.read(editado, "$.id"));

        // aparece corregido en el listado (la cedula sale de la base de seguridad)
        mvc.perform(get("/api/admin/funcionarios").header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$[?(@.id==" + id + ")].correo").value("nuevo." + usuario + "@quito.ec"))
                .andExpect(jsonPath("$[?(@.id==" + id + ")].cedula").value("1722222222"))
                .andExpect(jsonPath("$[?(@.id==" + id + ")].idEntidad").value(2));

        // y los cambios quedaron en la auditoria con el usuario real
        mvc.perform(get("/api/admin/auditoria").param("tabla", "FUNCIONARIO").param("accion", "UPDATE").param("usuario", "admin")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$.items[?(@.idRegistro=='" + id + "')]").isNotEmpty());
        mvc.perform(get("/api/admin/auditoria").param("tabla", "USUARIO").param("accion", "UPDATE").param("usuario", "admin")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$.items[?(@.origen=='SEGURIDAD')]").isNotEmpty());
    }

    @Test
    void laEdicionValidaCorreoRepetidoEntidadInactivaYDatosInvalidos() throws Exception {
        String admin = admin();
        String a = "va" + UUID.randomUUID().toString().substring(0, 6);
        String b = "vb" + UUID.randomUUID().toString().substring(0, 6);
        int idA = crearFuncionario(admin, a, 1);
        crearFuncionario(admin, b, 1);

        // el correo de B ya existe
        json(put("/api/admin/funcionarios/" + idA), admin,
                "{\"nombreCompleto\":\"X Y\",\"cedula\":\"1711111111\",\"correo\":\"" + b + "@quito.ec\",\"idEntidad\":1}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("ya esta registrado")));
        // datos invalidos
        json(put("/api/admin/funcionarios/" + idA), admin,
                "{\"nombreCompleto\":\"\",\"cedula\":\"12\",\"correo\":\"no-es-correo\",\"idEntidad\":1}")
                .andExpect(status().isBadRequest());
        // entidad inexistente / funcionario inexistente
        json(put("/api/admin/funcionarios/" + idA), admin,
                "{\"nombreCompleto\":\"X Y\",\"cedula\":\"1711111111\",\"correo\":\"" + a + "@quito.ec\",\"idEntidad\":99999}")
                .andExpect(status().isNotFound());
        json(put("/api/admin/funcionarios/99999"), admin,
                "{\"nombreCompleto\":\"X Y\",\"cedula\":\"1711111111\",\"correo\":\"z@quito.ec\",\"idEntidad\":1}")
                .andExpect(status().isNotFound());
        // un ciudadano no puede editar
        json(put("/api/admin/funcionarios/" + idA), ciudadano(),
                "{\"nombreCompleto\":\"X Y\",\"cedula\":\"1711111111\",\"correo\":\"" + a + "@quito.ec\",\"idEntidad\":1}")
                .andExpect(status().isForbidden());
    }

    @Test
    void sePuedeDarDeBajaYVolverADarDeAltaAUnFuncionario() throws Exception {
        String admin = admin();
        String usuario = "alt" + UUID.randomUUID().toString().substring(0, 6);
        int id = crearFuncionario(admin, usuario, 1);
        // le restablece la clave para poder entrar con una conocida
        String temporal = JsonPath.read(json(post("/api/admin/usuarios/" + usuario + "/restablecer-password"), admin, null)
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8), "$.passwordTemporal");
        login(usuario, temporal).andExpect(status().isOk());

        json(patch("/api/admin/funcionarios/" + id + "/estado"), admin, "{\"activo\":false}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("I"));
        login(usuario, temporal).andExpect(status().isForbidden());                       // sin acceso

        json(patch("/api/admin/funcionarios/" + id + "/estado"), admin, "{\"activo\":true}")
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("A"));
        String tk = JsonPath.read(login(usuario, temporal).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.token");
        // el funcionario vuelve a tener su entidad: la bandeja vuelve a responder (con la clave temporal debe cambiarla)
        assertNotNull(tk);
    }

    @Test
    void noSeDaDeAltaAUnFuncionarioCuyaEntidadEstaInactiva() throws Exception {
        String admin = admin();
        String sufijo = UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        int idEntidad = idDe(json(post("/api/admin/mantenimiento/entidades"), admin,
                "{\"codigo\":\"f" + sufijo + "\",\"nombre\":\"Efimera " + sufijo + "\"}").andExpect(status().isCreated()));
        int id = crearFuncionario(admin, "ef" + sufijo.toLowerCase() + "x", idEntidad);

        json(patch("/api/admin/funcionarios/" + id + "/estado"), admin, "{\"activo\":false}").andExpect(status().isOk());
        json(patch("/api/admin/mantenimiento/entidades/" + idEntidad + "/estado"), admin, "{\"activo\":false}").andExpect(status().isOk());

        json(patch("/api/admin/funcionarios/" + id + "/estado"), admin, "{\"activo\":true}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensaje").value(org.hamcrest.Matchers.containsString("inactiva")));
        // pasarlo a otra entidad activa lo desbloquea
        json(put("/api/admin/funcionarios/" + id), admin,
                "{\"nombreCompleto\":\"Funcionario ef\",\"cedula\":\"1711111111\",\"correo\":\"ef" + sufijo.toLowerCase()
                        + "x@quito.ec\",\"idEntidad\":1,\"cargo\":\"Inspector\"}").andExpect(status().isOk());
        json(patch("/api/admin/funcionarios/" + id + "/estado"), admin, "{\"activo\":true}").andExpect(status().isOk());
    }

    @Test
    void tresClavesMalasBloqueanAlUsuarioYSoloElAdministradorLoDesbloquea() throws Exception {
        String usuario = registrarCiudadano("bloq" + UUID.randomUUID().toString().substring(0, 6));

        login(usuario, "mala1").andExpect(status().isUnauthorized());
        login(usuario, "mala2").andExpect(status().isUnauthorized());
        login(usuario, "mala3").andExpect(status().isLocked());
        login(usuario, "Clave1234*").andExpect(status().isLocked());   // ni con la clave correcta

        mvc.perform(post("/api/admin/usuarios/" + usuario + "/desbloquear")
                        .header("Authorization", "Bearer " + ciudadano()))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/usuarios/" + usuario + "/desbloquear")
                        .header("Authorization", "Bearer " + token("admin", "Admin123*")))
                .andExpect(status().isNoContent());
        login(usuario, "Clave1234*").andExpect(status().isOk());
    }

    @Test
    void elAdministradorRegistraYDaDeBajaAFuncionariosYQuedaAuditado() throws Exception {
        String admin = token("admin", "Admin123*");
        String usuario = "func" + UUID.randomUUID().toString().substring(0, 6);
        // Sin "password": el sistema genera una clave temporal.
        String cuerpo = "{\"nombreCompleto\":\"Nuevo Funcionario\",\"cedula\":\"1798765432\",\"correo\":\"" + usuario
                + "@quito.ec\",\"usuario\":\"" + usuario + "\",\"idEntidad\":3,\"cargo\":\"Tecnico\"}";

        String respuesta = mvc.perform(post("/api/admin/funcionarios").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.funcionario.entidadCodigo").value("EEQ"))
                .andExpect(jsonPath("$.passwordTemporal").isNotEmpty())
                .andExpect(jsonPath("$.correoEnviado").value(false))   // correo apagado en pruebas
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        int idFuncionario = JsonPath.read(respuesta, "$.funcionario.id");
        String temporal = JsonPath.read(respuesta, "$.passwordTemporal");

        // El trigger de FUNCIONARIO guardo QUIEN lo hizo (set_config), no el usuario tecnico.
        String quien = new JdbcTemplate(negocio).queryForObject(
                "select usuario_accion from auditoria where nombre_tabla='FUNCIONARIO' and id_registro=? order by id_auditoria desc limit 1",
                String.class, idFuncionario);
        assertEquals("admin", quien);

        mvc.perform(post("/api/admin/funcionarios").header("Authorization", "Bearer " + ciudadano())
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isForbidden());

        mvc.perform(delete("/api/admin/funcionarios/" + idFuncionario).header("Authorization", "Bearer " + admin))
                .andExpect(status().isNoContent());
        login(usuario, temporal).andExpect(status().isForbidden());   // dado de baja: inactivo
    }

    @Test
    void laClaveTemporalObligaACambiarlaAntesDeUsarElSistema() throws Exception {
        String admin = token("admin", "Admin123*");
        String usuario = "temp" + UUID.randomUUID().toString().substring(0, 6);
        String cuerpo = "{\"nombreCompleto\":\"Con Clave Temporal\",\"cedula\":\"1798765433\",\"correo\":\"" + usuario
                + "@quito.ec\",\"usuario\":\"" + usuario + "\",\"idEntidad\":1,\"cargo\":\"Inspector\"}";
        String respuesta = mvc.perform(post("/api/admin/funcionarios").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String temporal = JsonPath.read(respuesta, "$.passwordTemporal");

        // 1) Entra, pero el API le avisa que debe cambiarla.
        String sesion = login(usuario, temporal).andExpect(status().isOk())
                .andExpect(jsonPath("$.debeCambiarPassword").value(true))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String tokenTemporal = JsonPath.read(sesion, "$.token");

        // 2) Con la clave temporal no puede usar nada mas.
        mvc.perform(get("/api/reportes/bandeja").header("Authorization", "Bearer " + tokenTemporal))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.codigo").value("CAMBIO_PASSWORD"));

        // 3) La nueva debe ser distinta y la actual debe ser correcta.
        cambiarPassword(tokenTemporal, temporal, temporal).andExpect(status().isBadRequest());
        cambiarPassword(tokenTemporal, "incorrecta", "NuevaClave123*").andExpect(status().isBadRequest());
        String cambiada = cambiarPassword(tokenTemporal, temporal, "NuevaClave123*").andExpect(status().isOk())
                .andExpect(jsonPath("$.debeCambiarPassword").value(false))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

        // 4) Con el token nuevo ya trabaja normal; la clave temporal dejo de servir.
        mvc.perform(get("/api/reportes/bandeja").header("Authorization", "Bearer " + JsonPath.read(cambiada, "$.token")))
                .andExpect(status().isOk());
        login(usuario, temporal).andExpect(status().isUnauthorized());
        login(usuario, "NuevaClave123*").andExpect(status().isOk())
                .andExpect(jsonPath("$.debeCambiarPassword").value(false));
    }

    @Test
    void elAdministradorRestableceLaClaveDeUnUsuario() throws Exception {
        String admin = token("admin", "Admin123*");
        String usuario = registrarCiudadano("olvido" + UUID.randomUUID().toString().substring(0, 6));

        String respuesta = mvc.perform(post("/api/admin/usuarios/" + usuario + "/restablecer-password")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.usuario").value(usuario))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String temporal = JsonPath.read(respuesta, "$.passwordTemporal");

        login(usuario, "Clave1234*").andExpect(status().isUnauthorized());   // la anterior ya no sirve
        login(usuario, temporal).andExpect(status().isOk()).andExpect(jsonPath("$.debeCambiarPassword").value(true));
        mvc.perform(post("/api/admin/usuarios/" + usuario + "/restablecer-password")
                        .header("Authorization", "Bearer " + ciudadano()))
                .andExpect(status().isForbidden());
    }

    ResultActions cambiarPassword(String token, String actual, String nueva) throws Exception {
        return mvc.perform(post("/api/auth/cambiar-password").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"passwordActual\":\"" + actual + "\",\"passwordNueva\":\"" + nueva + "\"}"));
    }

    @Test
    void elAdministradorVeEstadisticas() throws Exception {
        reporteNuevo(ciudadano(), "Bache");

        mvc.perform(get("/api/admin/estadisticas").header("Authorization", "Bearer " + token("admin", "Admin123*")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").isNumber())
                .andExpect(jsonPath("$.porTipo.Bache").isNumber());
    }
}
