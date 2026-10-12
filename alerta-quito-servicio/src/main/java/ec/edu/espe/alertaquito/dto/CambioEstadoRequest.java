package ec.edu.espe.alertaquito.dto;

/** Activar (true) o desactivar (false) un registro de mantenimiento. Nada se borra: se conserva el historial. */
public record CambioEstadoRequest(boolean activo) {
}
