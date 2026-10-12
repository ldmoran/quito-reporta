package ec.edu.espe.alertaquito.repository.negocio;

import ec.edu.espe.alertaquito.entity.negocio.Evidencia;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EvidenciaRepository extends JpaRepository<Evidencia, Long> {

    List<Evidencia> findByReporteIdReporteOrderByFecha(Long idReporte);
}
