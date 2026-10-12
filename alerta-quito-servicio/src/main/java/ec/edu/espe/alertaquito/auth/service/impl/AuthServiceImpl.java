package ec.edu.espe.alertaquito.auth.service.impl;

import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;
import ec.edu.espe.alertaquito.auth.service.AuthService;
import ec.edu.espe.alertaquito.entity.negocio.Usuario;
import ec.edu.espe.alertaquito.entity.seguridad.IntentoAcceso;
import ec.edu.espe.alertaquito.entity.seguridad.UsuarioSeguridad;
import ec.edu.espe.alertaquito.repository.seguridad.IntentoAccesoRepository;
import ec.edu.espe.alertaquito.repository.seguridad.UsuarioSeguridadRepository;
import ec.edu.espe.alertaquito.service.UsuarioFichaService;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AuthServiceImpl implements AuthService {

    public static final String APLICACION = "ALQ";
    public static final int MAX_INTENTOS = 3;
    private static final String MENSAJE_CREDENCIALES = "Usuario y/o contraseña incorrectos.";
    private static final String MENSAJE_BLOQUEADO =
            "Usuario bloqueado por intentos fallidos. Contacte al administrador.";

    private final UsuarioSeguridadRepository usuarios;
    private final IntentoAccesoRepository intentos;
    private final PasswordEncoder encoder;
    private final UsuarioFichaService fichas;

    public AuthServiceImpl(UsuarioSeguridadRepository usuarios, IntentoAccesoRepository intentos,
                           PasswordEncoder encoder, UsuarioFichaService fichas) {
        this.usuarios = usuarios;
        this.intentos = intentos;
        this.encoder = encoder;
        this.fichas = fichas;
    }

    /**
     * noRollbackFor: cuando el login falla se lanza una excepcion, pero el
     * contador de intentos y la bitacora SI deben quedar guardados.
     */
    @Override
    @Transactional(transactionManager = "seguridadTransactionManager", noRollbackFor = AuthenticationException.class)
    public UsuarioAutenticado autenticar(String login, String password) {
        UsuarioSeguridad u = usuarios.findByUsuario(login == null ? "" : login.trim()).orElse(null);
        if (u == null) {
            intentos.save(new IntentoAcceso(String.valueOf(login), false, "Usuario inexistente"));
            throw new BadCredentialsException(MENSAJE_CREDENCIALES);
        }
        if (!u.estaActivo()) {
            intentos.save(new IntentoAcceso(u.getUsuario(), false, "Usuario inactivo"));
            throw new DisabledException("El usuario esta inactivo.");
        }
        if (Boolean.TRUE.equals(u.getBloqueado())) {
            intentos.save(new IntentoAcceso(u.getUsuario(), false, "Usuario bloqueado"));
            throw new LockedException(MENSAJE_BLOQUEADO);
        }
        if (password == null || !encoder.matches(password, u.getPasswordHash())) {
            int n = u.getIntentosFallidos() + 1;
            u.setIntentosFallidos((short) n);   // el trigger fn_usuario_bloqueo bloquea al llegar a 3
            usuarios.save(u);
            intentos.save(new IntentoAcceso(u.getUsuario(), false, "Clave incorrecta (" + n + ")"));
            if (n >= MAX_INTENTOS) {
                throw new LockedException(MENSAJE_BLOQUEADO);
            }
            throw new BadCredentialsException(MENSAJE_CREDENCIALES);
        }

        Set<String> perfiles = u.getPerfiles().stream()
                .filter(p -> "A".equals(p.getEstado()) && APLICACION.equals(p.getAplicacion().getCodigo()))
                .map(p -> p.getCodigo())
                .collect(Collectors.toSet());
        if (perfiles.isEmpty()) {
            intentos.save(new IntentoAcceso(u.getUsuario(), false, "Sin perfiles en la aplicacion"));
            throw new BadCredentialsException("No tiene permisos para ingresar a este sistema.");
        }

        u.setIntentosFallidos((short) 0);
        u.setUltimoAcceso(LocalDateTime.now());
        usuarios.save(u);
        intentos.save(new IntentoAcceso(u.getUsuario(), true, null));

        Usuario ficha = fichas.sincronizar(u.getIdUsuario(), u.getUsuario(), u.getNombreCompleto(), u.getCorreo());
        return new UsuarioAutenticado(ficha.getIdUsuario(), u.getIdUsuario(), u.getUsuario(),
                u.getNombreCompleto(), perfiles, Boolean.TRUE.equals(u.getDebeCambiarPassword()));
    }
}
