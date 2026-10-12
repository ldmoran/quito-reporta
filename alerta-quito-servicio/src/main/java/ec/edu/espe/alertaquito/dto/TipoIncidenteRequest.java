package ec.edu.espe.alertaquito.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** prioridadBase: 1 = critica, 2 = alta, 3 = media, 4 = baja. */
public record TipoIncidenteRequest(
        @NotBlank @Size(max = 100) String nombre,
        @NotNull Integer idEntidad,
        @NotNull @Min(1) @Max(4) Short prioridadBase,
        boolean esEmergencia) {
}
