package ec.edu.espe.alertaquito.auth.dto;

import jakarta.validation.constraints.NotBlank;
import ec.edu.espe.alertaquito.utils.ClaveSegura;

public record CambiarPasswordRequest(@NotBlank String passwordActual,
                                     @NotBlank @ClaveSegura String passwordNueva) {
}
