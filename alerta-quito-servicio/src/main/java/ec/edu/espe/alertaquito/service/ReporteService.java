package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;
import ec.edu.espe.alertaquito.dto.CrearReporteRequest;
import ec.edu.espe.alertaquito.dto.ReporteDetalleDTO;
import ec.edu.espe.alertaquito.dto.ReporteResumenDTO;
import ec.edu.espe.alertaquito.entity.negocio.EstadoReporte;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface ReporteService {

    /** RF-01 / RF-04: crea el reporte con su ubicacion y la foto obligatoria. */
    ReporteDetalleDTO crear(CrearReporteRequest datos, MultipartFile foto, UsuarioAutenticado usuario);

    /** RF-05: los reportes del ciudadano con su estado actual. */
    List<ReporteResumenDTO> misReportes(UsuarioAutenticado usuario);

    /** Bandeja del funcionario: reportes derivados a su entidad, emergencias primero. */
    List<ReporteResumenDTO> bandeja(boolean incluirCerrados, UsuarioAutenticado usuario);

    ReporteDetalleDTO detalle(Long idReporte, UsuarioAutenticado usuario);

    /** RF-04: cambia el estado; para RESUELTO exige foto de resolucion. */
    ReporteDetalleDTO cambiarEstado(Long idReporte, EstadoReporte nuevoEstado, String comentario,
                                    MultipartFile foto, UsuarioAutenticado usuario);

    ArchivoEvidencia archivoEvidencia(Long idReporte, Long idEvidencia, UsuarioAutenticado usuario);

    record ArchivoEvidencia(Resource recurso, String contentType) {
    }
}
