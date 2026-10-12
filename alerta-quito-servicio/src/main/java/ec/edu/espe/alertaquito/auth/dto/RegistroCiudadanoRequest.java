package ec.edu.espe.alertaquito.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegistroCiudadanoRequest(
        @NotBlank @Size(max = 150) String nombreCompleto,
        @Pattern(regexp = "\\d{10,13}", message = "La cedula debe tener entre 10 y 13 digitos") String cedula,
        @NotBlank @Email @Size(max = 150) String correo,
        @NotBlank @Size(min = 4, max = 50)
        @Pattern(regexp = "[A-Za-z0-9._-]+", message = "Solo letras, numeros, punto, guion y guion bajo") String usuario,
        @NotBlank @Size(min = 8, max = 72) String password) {
}
