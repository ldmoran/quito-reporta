package ec.edu.espe.alertaquito.dto;

import ec.edu.espe.alertaquito.entity.negocio.Funcionario;

import java.time.LocalDateTime;

public record FuncionarioDTO(Integer id, String usuario, String nombreCompleto, String cedula, String correo,
                             Integer idEntidad, String entidadCodigo, String entidadNombre, String cargo,
                             String estado, LocalDateTime fechaDesignacion) {

    /** La cedula vive en la base de seguridad; quien arma el DTO la busca y la pasa aqui (puede ser null). */
    public static FuncionarioDTO desde(Funcionario f, String cedula) {
        return new FuncionarioDTO(f.getIdFuncionario(), f.getUsuario().getUsuario(),
                f.getUsuario().getNombreCompleto(), cedula, f.getUsuario().getCorreo(),
                f.getEntidad().getIdEntidad(), f.getEntidad().getCodigo(), f.getEntidad().getNombre(),
                f.getCargo(), f.getEstado(), f.getFechaDesignacion());
    }
}
