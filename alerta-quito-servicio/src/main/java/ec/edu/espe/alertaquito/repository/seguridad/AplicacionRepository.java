package ec.edu.espe.alertaquito.repository.seguridad;

import ec.edu.espe.alertaquito.entity.seguridad.Aplicacion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AplicacionRepository extends JpaRepository<Aplicacion, Integer> {

    Optional<Aplicacion> findByCodigo(String codigo);
}
