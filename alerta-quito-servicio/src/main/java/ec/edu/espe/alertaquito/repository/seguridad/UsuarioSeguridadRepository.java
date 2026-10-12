package ec.edu.espe.alertaquito.repository.seguridad;

import ec.edu.espe.alertaquito.entity.seguridad.UsuarioSeguridad;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UsuarioSeguridadRepository extends JpaRepository<UsuarioSeguridad, Integer> {

    Optional<UsuarioSeguridad> findByUsuario(String usuario);

    boolean existsByUsuario(String usuario);

    boolean existsByCorreo(String correo);
}
