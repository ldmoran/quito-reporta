package ec.edu.espe.alertaquito.repository.negocio;

import ec.edu.espe.alertaquito.entity.negocio.Derivacion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DerivacionRepository extends JpaRepository<Derivacion, Long> {

    Optional<Derivacion> findFirstByReporteIdReporteOrderByIdDerivacionDesc(Long idReporte);
}
