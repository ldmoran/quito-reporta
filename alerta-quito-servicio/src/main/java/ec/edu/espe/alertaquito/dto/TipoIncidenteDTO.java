package ec.edu.espe.alertaquito.dto;

public record TipoIncidenteDTO(Integer id, String nombre, String entidadCodigo, String entidadNombre,
                               Short prioridad, boolean esEmergencia) {
}
