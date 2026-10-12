package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.auth.service.impl.AuthServiceImpl;
import ec.edu.espe.alertaquito.entity.seguridad.Perfil;
import ec.edu.espe.alertaquito.entity.seguridad.UsuarioSeguridad;
import ec.edu.espe.alertaquito.exception.RecursoNoEncontradoException;
import ec.edu.espe.alertaquito.exception.ReglaNegocioException;
import ec.edu.espe.alertaquito.repository.seguridad.PerfilRepository;
import ec.edu.espe.alertaquito.repository.seguridad.UsuarioSeguridadRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Altas, bajas y desbloqueos en la base de SEGURIDAD. */
@Service
public class UsuarioSeguridadService {

    private static final String TM = "seguridadTransactionManager";

    private final UsuarioSeguridadRepository usuarios;
    private final PerfilRepository perfiles;
    private final PasswordEncoder encoder;
    private final AuditoriaSesionService auditoria;

    public UsuarioSeguridadService(UsuarioSeguridadRepository usuarios, PerfilRepository perfiles,
                                   PasswordEncoder encoder, AuditoriaSesionService auditoria) {
        this.usuarios = usuarios;
        this.perfiles = perfiles;
        this.encoder = encoder;
        this.auditoria = auditoria;
    }

    @Transactional(transactionManager = TM)
    public UsuarioSeguridad crear(String nombreCompleto, String cedula, String correo, String login,
                                  String password, String codigoPerfil, boolean debeCambiarPassword, String actor) {
        if (usuarios.existsByUsuario(login)) {
            throw new ReglaNegocioException("El nombre de usuario '" + login + "' ya esta en uso.");
        }
        if (usuarios.existsByCorreo(correo)) {
            throw new ReglaNegocioException("El correo '" + correo + "' ya esta registrado.");
        }
        Perfil perfil = perfiles.findByAplicacionCodigoAndCodigo(AuthServiceImpl.APLICACION, codigoPerfil)
                .orElseThrow(() -> new RecursoNoEncontradoException("Perfil inexistente: " + codigoPerfil));

        auditoria.marcarSeguridad(actor);
        UsuarioSeguridad u = new UsuarioSeguridad();
        u.setUsuario(login);
        u.setNombreCompleto(nombreCompleto);
        u.setCedula(cedula);
        u.setCorreo(correo);
        u.setPasswordHash(encoder.encode(password));
        u.setEstado("A");
        u.setIntentosFallidos((short) 0);
        u.setBloqueado(false);
        u.setDebeCambiarPassword(debeCambiarPassword);
        u.getPerfiles().add(perfil);
        return usuarios.save(u);
    }

    @Transactional(transactionManager = TM)
    public void cambiarEstado(Integer idUsuarioSeguridad, boolean activo, String actor) {
        UsuarioSeguridad u = buscar(idUsuarioSeguridad);
        auditoria.marcarSeguridad(actor);
        u.setEstado(activo ? "A" : "I");
        usuarios.save(u);
    }

    @Transactional(transactionManager = TM)
    public void desbloquear(String login, String actor) {
        UsuarioSeguridad u = usuarios.findByUsuario(login)
                .orElseThrow(() -> new RecursoNoEncontradoException("Usuario inexistente: " + login));
        auditoria.marcarSeguridad(actor);
        u.setBloqueado(false);      // el trigger reinicia intentos_fallidos
        usuarios.save(u);
    }

    /** El propio usuario cambia su clave (la temporal o la que ya tenia). */
    @Transactional(transactionManager = TM)
    public void cambiarPassword(Integer idUsuarioSeguridad, String actual, String nueva, String actor) {
        UsuarioSeguridad u = buscar(idUsuarioSeguridad);
        if (!encoder.matches(actual, u.getPasswordHash())) {
            throw new ReglaNegocioException("La contraseña actual no es correcta.");
        }
        if (actual.equals(nueva)) {
            throw new ReglaNegocioException("La contraseña nueva debe ser distinta de la actual.");
        }
        auditoria.marcarSeguridad(actor);
        u.setPasswordHash(encoder.encode(nueva));
        u.setDebeCambiarPassword(false);
        usuarios.save(u);
    }

    /** El administrador asigna una clave temporal nueva (olvido de clave) y la persona debera cambiarla. */
    @Transactional(transactionManager = TM)
    public UsuarioSeguridad restablecerPassword(String login, String claveTemporal, String actor) {
        UsuarioSeguridad u = usuarios.findByUsuario(login)
                .orElseThrow(() -> new RecursoNoEncontradoException("Usuario inexistente: " + login));
        auditoria.marcarSeguridad(actor);
        u.setPasswordHash(encoder.encode(claveTemporal));
        u.setDebeCambiarPassword(true);
        return usuarios.save(u);
    }

    /** Compensacion si la parte de negocio falla despues de crear el usuario (son 2 bases, sin transaccion comun). */
    @Transactional(transactionManager = TM)
    public void eliminar(Integer idUsuarioSeguridad, String actor) {
        UsuarioSeguridad u = buscar(idUsuarioSeguridad);
        auditoria.marcarSeguridad(actor);
        u.getPerfiles().clear();
        usuarios.saveAndFlush(u);
        usuarios.delete(u);
    }

    private UsuarioSeguridad buscar(Integer id) {
        return usuarios.findById(id)
                .orElseThrow(() -> new RecursoNoEncontradoException("Usuario inexistente: " + id));
    }
}
