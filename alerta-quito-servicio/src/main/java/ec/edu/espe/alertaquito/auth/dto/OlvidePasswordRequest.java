package ec.edu.espe.alertaquito.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Usuario o correo de la cuenta cuya clave se olvido. */
public record OlvidePasswordRequest(@NotBlank @Size(max = 150) String identificador) {
}
