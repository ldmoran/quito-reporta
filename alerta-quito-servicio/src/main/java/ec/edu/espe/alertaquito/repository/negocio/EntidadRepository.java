package ec.edu.espe.alertaquito.repository.negocio;

import ec.edu.espe.alertaquito.entity.negocio.Entidad;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EntidadRepository extends JpaRepository<Entidad, Integer> {

    List<Entidad> findByEstadoOrderByNombre(String estado);
}
