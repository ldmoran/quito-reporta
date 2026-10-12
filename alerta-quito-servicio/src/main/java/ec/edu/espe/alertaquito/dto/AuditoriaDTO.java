package ec.edu.espe.alertaquito.dto;

import java.time.LocalDateTime;
import java.util.List;

/** Una fila de la tabla AUDITORIA de cualquiera de las dos bases. */
public record AuditoriaDTO(String origen, Long id, String tabla, String idRegistro, String accion, String usuario,
                           LocalDateTime fecha, String descripcion) {

    /** Una pagina de resultados mas los datos para armar los filtros. */
    public record Pagina(List<AuditoriaDTO> items, int pagina, int totalPaginas, int total, List<String> tablas) {
    }
}
