package ec.edu.espe.alertaquito.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import ec.edu.espe.alertaquito.utils.ClaveSegura;

public record RegistrarFuncionarioRequest(
        @NotBlank @Size(max = 150) String nombreCompleto,
        @Pattern(regexp = "\\d{10,13}", message = "La cedula debe tener entre 10 y 13 digitos") String cedula,
        @NotBlank @Email @Size(max = 150) String correo,
        @NotBlank @Size(min = 4, max = 50)
        @Pattern(regexp = "[A-Za-z0-9._-]+", message = "Solo letras, numeros, punto, guion y guion bajo") String usuario,
        /** Opcional: si no se envia, el sistema genera una clave temporal. */
        @ClaveSegura String password,
        @NotNull Integer idEntidad,
        @Size(max = 100) String cargo) {
}
