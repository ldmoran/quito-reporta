package ec.edu.espe.alertaquito.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** El nombre de usuario (login) no se edita: es la identidad de la cuenta y aparece en la auditoria. */
public record ActualizarFuncionarioRequest(
        @NotBlank @Size(max = 150) String nombreCompleto,
        @Pattern(regexp = "\\d{10,13}", message = "La cedula debe tener entre 10 y 13 digitos") String cedula,
        @NotBlank @Email @Size(max = 150) String correo,
        @NotNull Integer idEntidad,
        @Size(max = 100) String cargo) {
}
