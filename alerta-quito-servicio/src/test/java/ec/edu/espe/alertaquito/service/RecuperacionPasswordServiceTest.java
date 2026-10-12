package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.config.AppProperties;
import ec.edu.espe.alertaquito.entity.seguridad.RestablecimientoPassword;
import ec.edu.espe.alertaquito.entity.seguridad.UsuarioSeguridad;
import ec.edu.espe.alertaquito.exception.ReglaNegocioException;
import ec.edu.espe.alertaquito.repository.seguridad.RestablecimientoPasswordRepository;
import ec.edu.espe.alertaquito.repository.seguridad.UsuarioSeguridadRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RecuperacionPasswordServiceTest {

    @Mock UsuarioSeguridadRepository usuarios;
    @Mock RestablecimientoPasswordRepository enlaces;
    @Mock PasswordEncoder encoder;
    @Mock AuditoriaSesionService auditoria;
    @Mock CorreoService correo;

    RecuperacionPasswordService servicio;

    @BeforeEach
    void preparar() {
        AppProperties props = new AppProperties(new AppProperties.Jwt("x".repeat(40), 5),
                new AppProperties.Almacenamiento("./x"), new AppProperties.Cors(List.of()),
                new AppProperties.Correo(true, "no-reply@alertaquito.ec", "http://localhost:4200/"));
        servicio = new RecuperacionPasswordService(usuarios, enlaces, encoder, auditoria, correo, props);
    }

    private UsuarioSeguridad usuario(String estado) {
        UsuarioSeguridad u = new UsuarioSeguridad();
        u.setIdUsuario(5);
        u.setUsuario("ana.perez");
        u.setNombreCompleto("Ana Perez");
        u.setCorreo("ana@quito.ec");
        u.setEstado(estado);
        u.setBloqueado(true);
        u.setIntentosFallidos((short) 3);
        u.setDebeCambiarPassword(true);
        return u;
    }

    @Test
    void enviaUnEnlaceYGuardaSoloElHashDelToken() {
        when(usuarios.findByUsuario("ana.perez")).thenReturn(Optional.of(usuario("A")));

        servicio.solicitar("ana.perez");

        ArgumentCaptor<RestablecimientoPassword> guardado = ArgumentCaptor.forClass(RestablecimientoPassword.class);
        verify(enlaces).save(guardado.capture());
        ArgumentCaptor<String> enlace = ArgumentCaptor.forClass(String.class);
        verify(correo).enviarRestablecimiento(eq("ana@quito.ec"), eq("Ana Perez"), eq("ana.perez"), enlace.capture(), eq(30));

        String token = enlace.getValue().substring(enlace.getValue().indexOf("token=") + 6);
        assertTrue(enlace.getValue().startsWith("http://localhost:4200/restablecer?token="), "sin barra doble");
        assertTrue(token.length() >= 40, "token largo (256 bits)");
        assertNotEquals(token, guardado.getValue().getTokenHash(), "no se guarda el token en claro");
        assertEquals(RecuperacionPasswordService.hash(token), guardado.getValue().getTokenHash());
        assertEquals(64, guardado.getValue().getTokenHash().length());
        assertTrue(guardado.getValue().getFechaExpiracion().isAfter(LocalDateTime.now().plusMinutes(29)));
        verify(enlaces).anularPendientes(5);
    }

    @Test
    void tambienAceptaElCorreoComoIdentificador() {
        when(usuarios.findByUsuario("ana@quito.ec")).thenReturn(Optional.empty());
        when(usuarios.findByCorreoIgnoreCase("ana@quito.ec")).thenReturn(Optional.of(usuario("A")));

        servicio.solicitar(" ana@quito.ec ");

        verify(correo).enviarRestablecimiento(eq("ana@quito.ec"), any(), any(), anyString(), anyInt());
    }

    @Test
    void unaCuentaInexistenteOInactivaNoRecibeNadaYNoLanzaError() {
        when(usuarios.findByUsuario("nadie")).thenReturn(Optional.empty());
        when(usuarios.findByCorreoIgnoreCase("nadie")).thenReturn(Optional.empty());
        when(usuarios.findByUsuario("baja")).thenReturn(Optional.of(usuario("I")));

        assertDoesNotThrow(() -> servicio.solicitar("nadie"));
        assertDoesNotThrow(() -> servicio.solicitar("baja"));
        assertDoesNotThrow(() -> servicio.solicitar("   "));
        assertDoesNotThrow(() -> servicio.solicitar(null));

        verifyNoInteractions(correo);
        verify(enlaces, never()).save(any());
    }

    @Test
    void limitaLasSolicitudesPorHora() {
        when(usuarios.findByUsuario("ana.perez")).thenReturn(Optional.of(usuario("A")));
        when(enlaces.countByUsuarioIdUsuarioAndFechaCreacionAfter(eq(5), any())).thenReturn(3L);

        servicio.solicitar("ana.perez");

        verifyNoInteractions(correo);
        verify(enlaces, never()).save(any());
    }

    private RestablecimientoPassword enlaceVigente(UsuarioSeguridad u, String token) {
        RestablecimientoPassword r = new RestablecimientoPassword();
        r.setUsuario(u);
        r.setTokenHash(RecuperacionPasswordService.hash(token));
        r.setFechaExpiracion(LocalDateTime.now().plusMinutes(10));
        r.setUsado(false);
        return r;
    }

    @Test
    void restablecerCambiaLaClaveDesbloqueaYAnulaLosEnlaces() {
        UsuarioSeguridad u = usuario("A");
        when(enlaces.findByTokenHash(RecuperacionPasswordService.hash("tok"))).thenReturn(Optional.of(enlaceVigente(u, "tok")));
        when(encoder.encode("Nueva.Clave2026")).thenReturn("hash-nuevo");

        servicio.restablecer("tok", "Nueva.Clave2026");

        assertEquals("hash-nuevo", u.getPasswordHash());
        assertFalse(u.getBloqueado());
        assertEquals((short) 0, u.getIntentosFallidos().shortValue());
        assertFalse(u.getDebeCambiarPassword());
        verify(auditoria).marcarSeguridad("ana.perez");
        verify(enlaces).anularPendientes(5);
    }

    @Test
    void rechazaTokensVencidosUsadosOInexistentes() {
        UsuarioSeguridad u = usuario("A");
        RestablecimientoPassword vencido = enlaceVigente(u, "viejo");
        vencido.setFechaExpiracion(LocalDateTime.now().minusMinutes(1));
        RestablecimientoPassword usado = enlaceVigente(u, "usado");
        usado.setUsado(true);
        when(enlaces.findByTokenHash(RecuperacionPasswordService.hash("viejo"))).thenReturn(Optional.of(vencido));
        when(enlaces.findByTokenHash(RecuperacionPasswordService.hash("usado"))).thenReturn(Optional.of(usado));
        when(enlaces.findByTokenHash(RecuperacionPasswordService.hash("falso"))).thenReturn(Optional.empty());

        for (String token : List.of("viejo", "usado", "falso", "")) {
            var error = assertThrows(ReglaNegocioException.class, () -> servicio.restablecer(token, "Nueva.Clave2026"), token);
            assertTrue(error.getMessage().contains("no es válido o ya venció"));
        }
        verify(usuarios, never()).save(any());
    }

    @Test
    void aplicaLaPoliticaDeContrasenasYNoGastaElEnlaceSiLaClaveEsDebil() {
        UsuarioSeguridad u = usuario("A");
        RestablecimientoPassword r = enlaceVigente(u, "tok");
        when(enlaces.findByTokenHash(RecuperacionPasswordService.hash("tok"))).thenReturn(Optional.of(r));

        assertThrows(ReglaNegocioException.class, () -> servicio.restablecer("tok", "debil"));
        assertThrows(ReglaNegocioException.class, () -> servicio.restablecer("tok", "Ana.perez2026*"));   // contiene el usuario

        assertFalse(r.getUsado());
        verify(usuarios, never()).save(any());
    }

    @Test
    void unUsuarioDadoDeBajaNoPuedeRestablecer() {
        UsuarioSeguridad u = usuario("I");
        when(enlaces.findByTokenHash(RecuperacionPasswordService.hash("tok"))).thenReturn(Optional.of(enlaceVigente(u, "tok")));

        assertThrows(ReglaNegocioException.class, () -> servicio.restablecer("tok", "Nueva.Clave2026"));
    }
}
