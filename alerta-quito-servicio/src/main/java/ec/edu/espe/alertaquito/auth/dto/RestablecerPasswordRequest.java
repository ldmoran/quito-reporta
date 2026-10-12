package ec.edu.espe.alertaquito.auth.dto;

import ec.edu.espe.alertaquito.utils.ClaveSegura;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RestablecerPasswordRequest(@NotBlank @Size(max = 200) String token,
                                         @NotBlank @ClaveSegura String passwordNueva) {
}
