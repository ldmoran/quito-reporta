package ec.edu.espe.alertaquito.dto;

/**
 * Resultado de crear un funcionario. La clave temporal viaja UNA sola vez en esta
 * respuesta (no se guarda en claro en ningun lado) para que el administrador la
 * entregue si el correo no esta habilitado o fallo.
 */
public record FuncionarioCreadoDTO(FuncionarioDTO funcionario, String passwordTemporal, boolean correoEnviado) {
}
