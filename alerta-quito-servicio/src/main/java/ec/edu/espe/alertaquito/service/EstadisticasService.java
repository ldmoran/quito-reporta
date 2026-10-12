package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.dto.EstadisticasDTO;
import ec.edu.espe.alertaquito.repository.negocio.ReporteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class EstadisticasService {

    private final ReporteRepository reportes;

    public EstadisticasService(ReporteRepository reportes) {
        this.reportes = reportes;
    }

    @Transactional(transactionManager = "negocioTransactionManager", readOnly = true)
    public EstadisticasDTO resumen() {
        Map<String, Long> porEstado = new LinkedHashMap<>();
        reportes.contarPorEstado().forEach(f -> porEstado.put(f[0].toString(), (Long) f[1]));
        Map<String, Long> porTipo = new LinkedHashMap<>();
        reportes.contarPorTipo().forEach(f -> porTipo.put((String) f[0], (Long) f[1]));
        long total = porEstado.values().stream().mapToLong(Long::longValue).sum();
        return new EstadisticasDTO(total, porEstado, porTipo);
    }
}
