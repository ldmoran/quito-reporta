package ec.edu.espe.alertaquito.repository.seguridad;

import ec.edu.espe.alertaquito.entity.seguridad.IntentoAcceso;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IntentoAccesoRepository extends JpaRepository<IntentoAcceso, Long> {
}
