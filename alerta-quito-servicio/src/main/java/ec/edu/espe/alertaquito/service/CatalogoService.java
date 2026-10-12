package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.dto.EntidadDTO;
import ec.edu.espe.alertaquito.dto.TipoIncidenteDTO;
import ec.edu.espe.alertaquito.repository.negocio.EntidadRepository;
import ec.edu.espe.alertaquito.repository.negocio.TipoIncidenteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CatalogoService {

    private final TipoIncidenteRepository tipos;
    private final EntidadRepository entidades;

    public CatalogoService(TipoIncidenteRepository tipos, EntidadRepository entidades) {
        this.tipos = tipos;
        this.entidades = entidades;
    }

    @Transactional(transactionManager = "negocioTransactionManager", readOnly = true)
    public List<TipoIncidenteDTO> tiposIncidenteActivos() {
        return tipos.findByEstadoOrderByNombre("A").stream()
                .map(t -> new TipoIncidenteDTO(t.getIdTipoIncidente(), t.getNombre(), t.getEntidad().getCodigo(),
                        t.getEntidad().getNombre(), t.getPrioridadBase(), Boolean.TRUE.equals(t.getEsEmergencia())))
                .toList();
    }

    @Transactional(transactionManager = "negocioTransactionManager", readOnly = true)
    public List<EntidadDTO> entidadesActivas() {
        return entidades.findByEstadoOrderByNombre("A").stream()
                .map(e -> new EntidadDTO(e.getIdEntidad(), e.getCodigo(), e.getNombre(), e.getDescripcion()))
                .toList();
    }
}
