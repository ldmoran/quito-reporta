package ec.edu.espe.alertaquito.auth.security;

import ec.edu.espe.alertaquito.config.AppProperties;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private static final String SECRETO = "un-secreto-de-prueba-con-mas-de-32-caracteres!";

    private JwtService servicio(String secreto, long minutos) {
        return new JwtService(new AppProperties(new AppProperties.Jwt(secreto, minutos),
                new AppProperties.Almacenamiento("./x"), new AppProperties.Cors(List.of()),
                new AppProperties.Correo(false, "a@b.ec", "http://x")));
    }

    private UsuarioAutenticado usuario() {
        return new UsuarioAutenticado(7, 3, "func.epmmop", "Funcionario EPMMOP", Set.of("FUNCIO"), true);
    }

    @Test
    void generaYValidaUnToken() {
        JwtService jwt = servicio(SECRETO, 5);

        var recuperado = jwt.validar(jwt.generar(usuario()));

        assertTrue(recuperado.isPresent());
        assertEquals(7, recuperado.get().idUsuario());
        assertEquals(3, recuperado.get().idUsuarioSeguridad());
        assertEquals("func.epmmop", recuperado.get().usuario());
        assertTrue(recuperado.get().tienePerfil("FUNCIO"));
        assertFalse(recuperado.get().tienePerfil("ADMINI"));
    }

    @Test
    void rechazaUnTokenAlterado() {
        JwtService jwt = servicio(SECRETO, 5);
        String token = jwt.generar(usuario());

        assertTrue(jwt.validar(token + "x").isEmpty());
        assertTrue(jwt.validar("no-es-un-jwt").isEmpty());
    }

    @Test
    void rechazaUnTokenFirmadoConOtroSecreto() {
        String token = servicio("otro-secreto-distinto-de-32-caracteres-o-mas", 5).generar(usuario());

        assertTrue(servicio(SECRETO, 5).validar(token).isEmpty());
    }

    @Test
    void rechazaUnTokenVencido() {
        JwtService jwt = servicio(SECRETO, -1);

        assertTrue(jwt.validar(jwt.generar(usuario())).isEmpty());
    }

    @Test
    void exigeUnSecretoDeAlMenos32Caracteres() {
        assertThrows(IllegalStateException.class, () -> servicio("corto", 5));
    }

    @Test
    void expiracionEnSegundos() {
        assertEquals(300, servicio(SECRETO, 5).expiracionSegundos());
    }
}
