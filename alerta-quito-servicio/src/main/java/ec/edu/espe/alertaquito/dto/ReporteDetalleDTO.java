package ec.edu.espe.alertaquito.dto;

import java.time.LocalDateTime;
import java.util.List;

public record ReporteDetalleDTO(ReporteResumenDTO reporte, String referencia, String ciudadano,
                                String entidadNombre, List<Historial> historial, List<Evidencia> evidencias) {

    public record Historial(String estadoAnterior, String estadoNuevo, String usuario, String comentario,
                            LocalDateTime fecha) {
    }

    public record Evidencia(Long id, String tipo, String nombreArchivo, String subidoPor, LocalDateTime fecha) {
    }
}
