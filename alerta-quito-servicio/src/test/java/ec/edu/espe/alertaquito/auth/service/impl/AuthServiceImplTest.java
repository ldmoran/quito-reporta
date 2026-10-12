package ec.edu.espe.alertaquito.auth.service.impl;

import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;
import ec.edu.espe.alertaquito.entity.negocio.Usuario;
import ec.edu.espe.alertaquito.entity.seguridad.Aplicacion;
import ec.edu.espe.alertaquito.entity.seguridad.IntentoAcceso;
import ec.edu.espe.alertaquito.entity.seguridad.Perfil;
import ec.edu.espe.alertaquito.entity.seguridad.UsuarioSeguridad;
import ec.edu.espe.alertaquito.repository.seguridad.IntentoAccesoRepository;
import ec.edu.espe.alertaquito.repository.seguridad.UsuarioSeguridadRepository;
import ec.edu.espe.alertaquito.service.UsuarioFichaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock UsuarioSeguridadRepository usuarios;
    @Mock IntentoAccesoRepository intentos;
    @Mock PasswordEncoder encoder;
    @Mock UsuarioFichaService fichas;

    AuthServiceImpl servicio;

    @BeforeEach
    void preparar() {
        servicio = new AuthServiceImpl(usuarios, intentos, encoder, fichas);
    }

    private UsuarioSeguridad usuario(String estado, boolean bloqueado, int intentosFallidos, String codigoPerfil) {
        Aplicacion app = new Aplicacion();
        app.setCodigo(AuthServiceImpl.APLICACION);
        Perfil perfil = new Perfil();
        perfil.setCodigo(codigoPerfil);
        perfil.setEstado("A");
        perfil.setAplicacion(app);

        UsuarioSeguridad u = new UsuarioSeguridad();
        u.setIdUsuario(10);
        u.setUsuario("ciudadano.demo");
        u.setNombreCompleto("Ciudadano de Prueba");
        u.setCorreo("c@x.ec");
        u.setPasswordHash("hash");
        u.setEstado(estado);
        u.setBloqueado(bloqueado);
        u.setIntentosFallidos((short) intentosFallidos);
        u.getPerfiles().add(perfil);
        return u;
    }

    @Test
    void loginCorrectoDevuelveElUsuarioConSusPerfiles() {
        UsuarioSeguridad u = usuario("A", false, 2, "CIUDAD");
        when(usuarios.findByUsuario("ciudadano.demo")).thenReturn(Optional.of(u));
        when(encoder.matches("Ciud123*", "hash")).thenReturn(true);
        Usuario ficha = new Usuario();
        ficha.setIdUsuario(44);
        when(fichas.sincronizar(10, "ciudadano.demo", "Ciudadano de Prueba", "c@x.ec")).thenReturn(ficha);

        UsuarioAutenticado resultado = servicio.autenticar("ciudadano.demo", "Ciud123*");

        assertEquals(Integer.valueOf(44), resultado.idUsuario());
        assertEquals(Integer.valueOf(10), resultado.idUsuarioSeguridad());
        assertTrue(resultado.tienePerfil("CIUDAD"));
        assertEquals((short) 0, u.getIntentosFallidos().shortValue(), "un login correcto reinicia el contador");
        assertNotNull(u.getUltimoAcceso());
    }

    @Test
    void usuarioInexistenteEsCredencialesInvalidas() {
        when(usuarios.findByUsuario("nadie")).thenReturn(Optional.empty());

        assertThrows(BadCredentialsException.class, () -> servicio.autenticar("nadie", "x"));
        verify(intentos).save(any(IntentoAcceso.class));
    }

    @Test
    void claveIncorrectaSumaUnIntento() {
        UsuarioSeguridad u = usuario("A", false, 0, "CIUDAD");
        when(usuarios.findByUsuario("ciudadano.demo")).thenReturn(Optional.of(u));
        when(encoder.matches(anyString(), anyString())).thenReturn(false);

        assertThrows(BadCredentialsException.class, () -> servicio.autenticar("ciudadano.demo", "mala"));

        assertEquals((short) 1, u.getIntentosFallidos().shortValue());
        verify(usuarios).save(u);
    }

    @Test
    void elTercerIntentoFallidoBloquea() {
        UsuarioSeguridad u = usuario("A", false, 2, "CIUDAD");
        when(usuarios.findByUsuario("ciudadano.demo")).thenReturn(Optional.of(u));
        when(encoder.matches(anyString(), anyString())).thenReturn(false);

        assertThrows(LockedException.class, () -> servicio.autenticar("ciudadano.demo", "mala"));

        assertEquals((short) 3, u.getIntentosFallidos().shortValue());
    }

    @Test
    void unUsuarioBloqueadoNoEntraNiConLaClaveCorrecta() {
        UsuarioSeguridad u = usuario("A", true, 3, "CIUDAD");
        when(usuarios.findByUsuario("ciudadano.demo")).thenReturn(Optional.of(u));

        assertThrows(LockedException.class, () -> servicio.autenticar("ciudadano.demo", "Ciud123*"));

        verify(encoder, never()).matches(anyString(), anyString());
    }

    @Test
    void unUsuarioInactivoNoEntra() {
        when(usuarios.findByUsuario("ciudadano.demo")).thenReturn(Optional.of(usuario("I", false, 0, "CIUDAD")));

        assertThrows(DisabledException.class, () -> servicio.autenticar("ciudadano.demo", "Ciud123*"));
    }

    @Test
    void sinPerfilEnLaAplicacionNoEntra() {
        UsuarioSeguridad u = usuario("A", false, 0, "CIUDAD");
        u.getPerfiles().iterator().next().getAplicacion().setCodigo("OTRA");
        when(usuarios.findByUsuario("ciudadano.demo")).thenReturn(Optional.of(u));
        when(encoder.matches("Ciud123*", "hash")).thenReturn(true);

        var error = assertThrows(BadCredentialsException.class, () -> servicio.autenticar("ciudadano.demo", "Ciud123*"));

        assertTrue(error.getMessage().contains("permisos"));
        ArgumentCaptor<IntentoAcceso> captor = ArgumentCaptor.forClass(IntentoAcceso.class);
        verify(intentos).save(captor.capture());
        assertFalse(captor.getValue().getExitoso());
        verifyNoInteractions(fichas);
    }
}
