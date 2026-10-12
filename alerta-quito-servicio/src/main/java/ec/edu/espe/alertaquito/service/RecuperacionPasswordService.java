package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.config.AppProperties;
import ec.edu.espe.alertaquito.entity.seguridad.RestablecimientoPassword;
import ec.edu.espe.alertaquito.entity.seguridad.UsuarioSeguridad;
import ec.edu.espe.alertaquito.exception.ReglaNegocioException;
import ec.edu.espe.alertaquito.repository.seguridad.RestablecimientoPasswordRepository;
import ec.edu.espe.alertaquito.repository.seguridad.UsuarioSeguridadRepository;
import ec.edu.espe.alertaquito.utils.PoliticaPassword;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

/**
 * "Olvide mi contrasena": la persona pide un enlace, le llega por correo y con el elige una clave nueva
 * sin intervencion del administrador.
 *
 * <ul>
 *   <li>El token es aleatorio (256 bits) y solo se guarda su hash SHA-256.</li>
 *   <li>Sirve una sola vez y vence a los {@value #MINUTOS_VALIDEZ} minutos; pedir otro anula los anteriores.</li>
 *   <li>La respuesta de "solicitar" es siempre la misma exista o no la cuenta (no revela quien tiene cuenta).</li>
 *   <li>Maximo {@value #MAX_SOLICITUDES_POR_HORA} solicitudes por cuenta por hora (evita llenar buzones ajenos).</li>
 *   <li>Restablecer tambien desbloquea la cuenta: demuestra que la persona controla su correo.</li>
 * </ul>
 */
@Service
public class RecuperacionPasswordService {

    public static final int MINUTOS_VALIDEZ = 30;
    public static final int MAX_SOLICITUDES_POR_HORA = 3;
    private static final Logger log = LoggerFactory.getLogger(RecuperacionPasswordService.class);
    private static final String TM = "seguridadTransactionManager";
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final UsuarioSeguridadRepository usuarios;
    private final RestablecimientoPasswordRepository enlaces;
    private final PasswordEncoder encoder;
    private final AuditoriaSesionService auditoria;
    private final CorreoService correo;
    private final AppProperties props;

    public RecuperacionPasswordService(UsuarioSeguridadRepository usuarios, RestablecimientoPasswordRepository enlaces,
                                       PasswordEncoder encoder, AuditoriaSesionService auditoria,
                                       CorreoService correo, AppProperties props) {
        this.usuarios = usuarios;
        this.enlaces = enlaces;
        this.encoder = encoder;
        this.auditoria = auditoria;
        this.correo = correo;
        this.props = props;
    }

    /** @param identificador nombre de usuario o correo. No devuelve nada a proposito: la respuesta es siempre la misma. */
    @Transactional(transactionManager = TM)
    public void solicitar(String identificador) {
        String id = identificador == null ? "" : identificador.trim();
        if (id.isEmpty()) {
            return;
        }
        Optional<UsuarioSeguridad> encontrado = usuarios.findByUsuario(id);
        if (encontrado.isEmpty()) {
            encontrado = usuarios.findByCorreoIgnoreCase(id);
        }
        if (encontrado.isEmpty() || !encontrado.get().estaActivo()) {
            return;
        }
        UsuarioSeguridad u = encontrado.get();
        long recientes = enlaces.countByUsuarioIdUsuarioAndFechaCreacionAfter(u.getIdUsuario(), LocalDateTime.now().minusHours(1));
        if (recientes >= MAX_SOLICITUDES_POR_HORA) {
            log.warn("Demasiadas solicitudes de restablecimiento para el usuario {}", u.getUsuario());
            return;
        }

        String token = generarToken();
        enlaces.anularPendientes(u.getIdUsuario());
        RestablecimientoPassword r = new RestablecimientoPassword();
        r.setUsuario(u);
        r.setTokenHash(hash(token));
        r.setFechaCreacion(LocalDateTime.now());
        r.setFechaExpiracion(LocalDateTime.now().plusMinutes(MINUTOS_VALIDEZ));
        r.setUsado(false);
        enlaces.save(r);

        String enlace = props.correo().urlSistema().replaceAll("/+$", "") + "/restablecer?token=" + token;
        correo.enviarRestablecimiento(u.getCorreo(), u.getNombreCompleto(), u.getUsuario(), enlace, MINUTOS_VALIDEZ);
    }

    @Transactional(transactionManager = TM)
    public void restablecer(String token, String passwordNueva) {
        RestablecimientoPassword r = enlaces.findByTokenHash(hash(token == null ? "" : token.trim()))
                .filter(x -> !Boolean.TRUE.equals(x.getUsado()) && x.getFechaExpiracion().isAfter(LocalDateTime.now()))
                .orElseThrow(() -> new ReglaNegocioException("El enlace no es válido o ya venció. Solicite uno nuevo."));
        UsuarioSeguridad u = r.getUsuario();
        if (!u.estaActivo()) {
            throw new ReglaNegocioException("El enlace no es válido o ya venció. Solicite uno nuevo.");
        }
        PoliticaPassword.exigir(passwordNueva, u.getUsuario());

        auditoria.marcarSeguridad(u.getUsuario());
        u.setPasswordHash(encoder.encode(passwordNueva));
        u.setDebeCambiarPassword(false);
        u.setIntentosFallidos((short) 0);
        u.setBloqueado(false);
        usuarios.save(u);
        enlaces.anularPendientes(u.getIdUsuario());
    }

    static String generarToken() {
        byte[] bytes = new byte[32];
        ALEATORIO.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
