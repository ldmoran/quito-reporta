package ec.edu.espe.alertaquito.service.impl;

import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;
import ec.edu.espe.alertaquito.dto.CrearReporteRequest;
import ec.edu.espe.alertaquito.dto.ReporteDetalleDTO;
import ec.edu.espe.alertaquito.dto.ReporteResumenDTO;
import ec.edu.espe.alertaquito.entity.negocio.*;
import ec.edu.espe.alertaquito.exception.RecursoNoEncontradoException;
import ec.edu.espe.alertaquito.exception.ReglaNegocioException;
import ec.edu.espe.alertaquito.repository.negocio.*;
import ec.edu.espe.alertaquito.service.AlmacenamientoService;
import ec.edu.espe.alertaquito.service.AuditoriaSesionService;
import ec.edu.espe.alertaquito.service.ReporteService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Service
@Transactional(transactionManager = "negocioTransactionManager")
public class ReporteServiceImpl implements ReporteService {

    private static final List<EstadoReporte> ABIERTOS =
            List.of(EstadoReporte.REGISTRADO, EstadoReporte.EN_REVISION, EstadoReporte.EN_ATENCION);
    private static final int MAX_COMENTARIO = 500;

    @PersistenceContext(unitName = "negocio")
    private EntityManager em;

    private final ReporteRepository reportes;
    private final TipoIncidenteRepository tipos;
    private final UsuarioRepository usuarios;
    private final EvidenciaRepository evidencias;
    private final HistorialEstadoRepository historial;
    private final FuncionarioRepository funcionarios;
    private final AlmacenamientoService almacenamiento;
    private final AuditoriaSesionService auditoria;

    public ReporteServiceImpl(ReporteRepository reportes, TipoIncidenteRepository tipos, UsuarioRepository usuarios,
                              EvidenciaRepository evidencias, HistorialEstadoRepository historial,
                              FuncionarioRepository funcionarios, AlmacenamientoService almacenamiento,
                              AuditoriaSesionService auditoria) {
        this.reportes = reportes;
        this.tipos = tipos;
        this.usuarios = usuarios;
        this.evidencias = evidencias;
        this.historial = historial;
        this.funcionarios = funcionarios;
        this.almacenamiento = almacenamiento;
        this.auditoria = auditoria;
    }

    @Override
    public ReporteDetalleDTO crear(CrearReporteRequest datos, MultipartFile foto, UsuarioAutenticado usuario) {
        if (foto == null || foto.isEmpty()) {
            throw new ReglaNegocioException("La foto es obligatoria para crear un reporte.");
        }
        TipoIncidente tipo = tipos.findById(datos.idTipoIncidente())
                .filter(t -> "A".equals(t.getEstado()))
                .orElseThrow(() -> new RecursoNoEncontradoException("El tipo de incidente no existe o esta inactivo."));

        Reporte r = new Reporte();
        r.setCiudadano(usuarios.getReferenceById(usuario.idUsuario()));
        r.setTipoIncidente(tipo);
        r.setDescripcion(datos.descripcion());

        Ubicacion ubicacion = new Ubicacion();
        ubicacion.setReporte(r);
        ubicacion.setLatitud(datos.latitud());
        ubicacion.setLongitud(datos.longitud());
        ubicacion.setDireccion(datos.direccion());
        ubicacion.setReferencia(datos.referencia());
        r.setUbicacion(ubicacion);

        reportes.saveAndFlush(r);   // aqui actuan los triggers: codigo, prioridad, derivacion, historial
        guardarEvidencia(r, foto, Evidencia.CREACION, usuario.usuario());
        return armarDetalle(r);
    }

    @Override
    @Transactional(transactionManager = "negocioTransactionManager", readOnly = true)
    public List<ReporteResumenDTO> misReportes(UsuarioAutenticado usuario) {
        return reportes.buscarDelCiudadano(usuario.idUsuario()).stream().map(ReporteResumenDTO::desde).toList();
    }

    @Override
    @Transactional(transactionManager = "negocioTransactionManager", readOnly = true)
    public List<ReporteResumenDTO> bandeja(boolean incluirCerrados, UsuarioAutenticado usuario) {
        Funcionario f = funcionarioActivo(usuario);
        List<EstadoReporte> estados = incluirCerrados ? List.of(EstadoReporte.values()) : ABIERTOS;
        return reportes.buscarDeEntidad(f.getEntidad().getIdEntidad(), estados).stream()
                .map(ReporteResumenDTO::desde).toList();
    }

    @Override
    @Transactional(transactionManager = "negocioTransactionManager", readOnly = true)
    public ReporteDetalleDTO detalle(Long idReporte, UsuarioAutenticado usuario) {
        Reporte r = buscar(idReporte);
        verificarAcceso(r, usuario);
        return armarDetalle(r);
    }

    @Override
    public ReporteDetalleDTO cambiarEstado(Long idReporte, EstadoReporte nuevoEstado, String comentario,
                                           MultipartFile foto, UsuarioAutenticado usuario) {
        Funcionario f = funcionarioActivo(usuario);
        Reporte r = buscar(idReporte);
        if (!r.getTipoIncidente().getEntidad().getIdEntidad().equals(f.getEntidad().getIdEntidad())) {
            throw new AccessDeniedException("El reporte pertenece a otra entidad.");
        }
        if (comentario != null && comentario.length() > MAX_COMENTARIO) {
            throw new ReglaNegocioException("El comentario no puede superar " + MAX_COMENTARIO + " caracteres.");
        }
        if (nuevoEstado == EstadoReporte.RESUELTO && (foto == null || foto.isEmpty())) {
            throw new ReglaNegocioException("No se puede resolver un reporte sin foto de evidencia.");
        }

        auditoria.marcarNegocio(usuario.usuario());
        if (foto != null && !foto.isEmpty()) {
            // La evidencia va ANTES del cambio de estado: el trigger la exige para RESOLVER.
            guardarEvidencia(r, foto, Evidencia.RESOLUCION, usuario.usuario());
            evidencias.flush();
        }
        r.setEstado(nuevoEstado);
        r.setComentarioEstado(comentario);
        r.setActualizadoPor(usuario.usuario());
        reportes.saveAndFlush(r);   // aqui actuan los triggers: transicion valida e historial
        em.refresh(r);              // relee fecha_actualizacion, que cambia por trigger
        return armarDetalle(r);
    }

    @Override
    @Transactional(transactionManager = "negocioTransactionManager", readOnly = true)
    public ArchivoEvidencia archivoEvidencia(Long idReporte, Long idEvidencia, UsuarioAutenticado usuario) {
        Reporte r = buscar(idReporte);
        verificarAcceso(r, usuario);
        Evidencia e = evidencias.findById(idEvidencia)
                .filter(ev -> ev.getReporte().getIdReporte().equals(idReporte))
                .orElseThrow(() -> new RecursoNoEncontradoException("Evidencia inexistente."));
        return new ArchivoEvidencia(almacenamiento.cargar(e.getRutaArchivo()), e.getContentType());
    }

    // ------------------------------------------------------------------

    private void guardarEvidencia(Reporte r, MultipartFile foto, String tipo, String usuario) {
        AlmacenamientoService.Guardado g = almacenamiento.guardar(foto);
        Evidencia e = new Evidencia();
        e.setReporte(r);
        e.setTipo(tipo);
        e.setNombreArchivo(g.nombreOriginal());
        e.setRutaArchivo(g.ruta());
        e.setContentType(g.contentType());
        e.setSubidoPor(usuario);
        evidencias.save(e);
    }

    private Reporte buscar(Long id) {
        return reportes.findById(id).orElseThrow(() -> new RecursoNoEncontradoException("Reporte inexistente."));
    }

    private Funcionario funcionarioActivo(UsuarioAutenticado usuario) {
        return funcionarios.findByUsuarioIdUsuarioAndEstado(usuario.idUsuario(), "A")
                .orElseThrow(() -> new AccessDeniedException("No es un funcionario activo."));
    }

    /** Dueño del reporte, funcionario de la entidad competente o administrador. */
    private void verificarAcceso(Reporte r, UsuarioAutenticado usuario) {
        if (usuario.tienePerfil(UsuarioAutenticado.ADMINISTRADOR)
                || r.getCiudadano().getIdUsuario().equals(usuario.idUsuario())) {
            return;
        }
        if (usuario.tienePerfil(UsuarioAutenticado.FUNCIONARIO)) {
            boolean esDeSuEntidad = funcionarios.findByUsuarioIdUsuarioAndEstado(usuario.idUsuario(), "A")
                    .map(f -> f.getEntidad().getIdEntidad().equals(r.getTipoIncidente().getEntidad().getIdEntidad()))
                    .orElse(false);
            if (esDeSuEntidad) {
                return;
            }
        }
        throw new AccessDeniedException("No puede ver este reporte.");
    }

    private ReporteDetalleDTO armarDetalle(Reporte r) {
        var hist = historial.findByIdReporteOrderByIdHistorial(r.getIdReporte()).stream()
                .map(h -> new ReporteDetalleDTO.Historial(h.getEstadoAnterior(), h.getEstadoNuevo(),
                        h.getUsuarioAccion(), h.getComentario(), h.getFecha()))
                .toList();
        var evid = evidencias.findByReporteIdReporteOrderByFecha(r.getIdReporte()).stream()
                .map(e -> new ReporteDetalleDTO.Evidencia(e.getIdEvidencia(), e.getTipo(), e.getNombreArchivo(),
                        e.getSubidoPor(), e.getFecha()))
                .toList();
        return new ReporteDetalleDTO(ReporteResumenDTO.desde(r), r.getUbicacion().getReferencia(),
                r.getCiudadano().getNombreCompleto(), r.getTipoIncidente().getEntidad().getNombre(), hist, evid);
    }
}
