package ec.edu.espe.alertaquito;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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
