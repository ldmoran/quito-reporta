package ec.edu.espe.alertaquito.dto;

import ec.edu.espe.alertaquito.entity.negocio.Funcionario;

import java.time.LocalDateTime;

public record FuncionarioDTO(Integer id, String usuario, String nombreCompleto, String correo,
                             String entidadCodigo, String entidadNombre, String cargo, String estado,
                             LocalDateTime fechaDesignacion) {

    public static FuncionarioDTO desde(Funcionario f) {
        return new FuncionarioDTO(f.getIdFuncionario(), f.getUsuario().getUsuario(),
                f.getUsuario().getNombreCompleto(), f.getUsuario().getCorreo(),
                f.getEntidad().getCodigo(), f.getEntidad().getNombre(), f.getCargo(), f.getEstado(),
                f.getFechaDesignacion());
    }
}
