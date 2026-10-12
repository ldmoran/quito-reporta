package ec.edu.espe.alertaquito.dto;

import ec.edu.espe.alertaquito.entity.negocio.TipoIncidente;

public record TipoIncidenteAdminDTO(Integer id, String nombre, Integer idEntidad, String entidadCodigo,
                                    String entidadNombre, Short prioridadBase, boolean esEmergencia, String estado,
                                    long reportes) {

    public static TipoIncidenteAdminDTO desde(TipoIncidente t, long reportes) {
        return new TipoIncidenteAdminDTO(t.getIdTipoIncidente(), t.getNombre(), t.getEntidad().getIdEntidad(),
                t.getEntidad().getCodigo(), t.getEntidad().getNombre(), t.getPrioridadBase(),
                Boolean.TRUE.equals(t.getEsEmergencia()), t.getEstado(), reportes);
    }
}
