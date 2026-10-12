package ec.edu.espe.alertaquito.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * Los limites de latitud/longitud encierran el Distrito Metropolitano de Quito;
 * son los mismos que el CHECK de la tabla UBICACION.
 */
public record CrearReporteRequest(
        @NotNull Integer idTipoIncidente,
        @Size(max = 500) String descripcion,
        @NotNull @DecimalMin("-0.45") @DecimalMax("0.20") BigDecimal latitud,
        @NotNull @DecimalMin("-78.80") @DecimalMax("-78.20") BigDecimal longitud,
        @Size(max = 250) String direccion,
        @Size(max = 250) String referencia) {
}
