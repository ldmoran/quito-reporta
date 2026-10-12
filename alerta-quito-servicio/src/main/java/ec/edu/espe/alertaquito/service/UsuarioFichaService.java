package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.entity.negocio.Usuario;
import ec.edu.espe.alertaquito.repository.negocio.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/** Mantiene en la base de negocio la ficha de cada usuario que existe en la de seguridad. */
@Service
public class UsuarioFichaService {

    private final UsuarioRepository usuarios;

    public UsuarioFichaService(UsuarioRepository usuarios) {
        this.usuarios = usuarios;
    }

    /** Crea la ficha si no existe, o refresca nombre/correo/ultimo acceso si ya existe. */
    @Transactional(transactionManager = "negocioTransactionManager")
    public Usuario sincronizar(Integer idUsuarioSeguridad, String usuario, String nombre, String correo) {
        Usuario ficha = usuarios.findByIdUsuarioSeguridad(idUsuarioSeguridad).orElseGet(Usuario::new);
        ficha.setIdUsuarioSeguridad(idUsuarioSeguridad);
        ficha.setUsuario(usuario);
        ficha.setNombreCompleto(nombre);
        ficha.setCorreo(correo);
        ficha.setUltimoAcceso(LocalDateTime.now());
        return usuarios.save(ficha);
    }
}
