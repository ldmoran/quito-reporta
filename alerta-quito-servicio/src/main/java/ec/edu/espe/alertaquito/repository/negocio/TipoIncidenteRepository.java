package ec.edu.espe.alertaquito.repository.negocio;

import ec.edu.espe.alertaquito.entity.negocio.TipoIncidente;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TipoIncidenteRepository extends JpaRepository<TipoIncidente, Integer> {

    List<TipoIncidente> findByEstadoOrderByNombre(String estado);
}
