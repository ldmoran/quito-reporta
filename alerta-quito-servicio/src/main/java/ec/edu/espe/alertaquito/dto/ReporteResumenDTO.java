package ec.edu.espe.alertaquito.dto;

import ec.edu.espe.alertaquito.entity.negocio.Reporte;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ReporteResumenDTO(Long id, String codigo, String tipoIncidente, String entidad, Short prioridad,
                                String estado, String descripcion, BigDecimal latitud, BigDecimal longitud,
                                String direccion, LocalDateTime fechaCreacion, LocalDateTime fechaActualizacion) {

    public static ReporteResumenDTO desde(Reporte r) {
        return new ReporteResumenDTO(r.getIdReporte(), r.getCodigo(), r.getTipoIncidente().getNombre(),
                r.getTipoIncidente().getEntidad().getCodigo(), r.getPrioridad(), r.getEstado().name(),
                r.getDescripcion(), r.getUbicacion().getLatitud(), r.getUbicacion().getLongitud(),
                r.getUbicacion().getDireccion(), r.getFechaCreacion(), r.getFechaActualizacion());
    }
}
