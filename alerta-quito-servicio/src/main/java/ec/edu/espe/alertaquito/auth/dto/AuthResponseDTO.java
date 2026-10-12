package ec.edu.espe.alertaquito.auth.dto;

import java.util.List;

public record AuthResponseDTO(Integer idUsuario, String usuario, String nombre, List<String> perfiles,
                              String token, long expiraEnSegundos, boolean debeCambiarPassword) {
}
