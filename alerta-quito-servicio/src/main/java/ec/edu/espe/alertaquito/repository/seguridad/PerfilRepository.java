package ec.edu.espe.alertaquito.repository.seguridad;

import ec.edu.espe.alertaquito.entity.seguridad.Perfil;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PerfilRepository extends JpaRepository<Perfil, Integer> {

    Optional<Perfil> findByAplicacionCodigoAndCodigo(String codigoAplicacion, String codigoPerfil);
}
