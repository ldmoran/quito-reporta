package ec.edu.espe.alertaquito.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record EntidadRequest(
        @NotBlank @Size(min = 2, max = 10)
        @Pattern(regexp = "[A-Za-z0-9_]+", message = "El codigo solo admite letras, numeros y guion bajo") String codigo,
        @NotBlank @Size(max = 150) String nombre,
        @Size(max = 300) String descripcion) {
}
