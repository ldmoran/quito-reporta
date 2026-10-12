package ec.edu.espe.alertaquito.dto;

import ec.edu.espe.alertaquito.entity.negocio.Entidad;

/** Entidad tal como la ve el administrador: incluye las inactivas y cuántas cosas dependen de ella. */
public record EntidadAdminDTO(Integer id, String codigo, String nombre, String descripcion, String estado,
                              long tiposActivos, long funcionariosActivos) {

    public static EntidadAdminDTO desde(Entidad e, long tiposActivos, long funcionariosActivos) {
        return new EntidadAdminDTO(e.getIdEntidad(), e.getCodigo(), e.getNombre(), e.getDescripcion(), e.getEstado(),
                tiposActivos, funcionariosActivos);
    }
}
