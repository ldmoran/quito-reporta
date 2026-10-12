package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;
import ec.edu.espe.alertaquito.dto.EntidadAdminDTO;
import ec.edu.espe.alertaquito.dto.EntidadRequest;
import ec.edu.espe.alertaquito.dto.TipoIncidenteAdminDTO;
import ec.edu.espe.alertaquito.dto.TipoIncidenteRequest;
import ec.edu.espe.alertaquito.entity.negocio.Entidad;
import ec.edu.espe.alertaquito.entity.negocio.TipoIncidente;
import ec.edu.espe.alertaquito.exception.RecursoNoEncontradoException;
import ec.edu.espe.alertaquito.exception.ReglaNegocioException;
import ec.edu.espe.alertaquito.repository.negocio.EntidadRepository;
import ec.edu.espe.alertaquito.repository.negocio.FuncionarioRepository;
import ec.edu.espe.alertaquito.repository.negocio.ReporteRepository;
import ec.edu.espe.alertaquito.repository.negocio.TipoIncidenteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Mantenimiento de los catalogos que antes solo se podian cambiar por SQL: entidades de respuesta y
 * tipos de incidente. Nada se borra (se activa/desactiva) para no perder el historial de reportes, y
 * cada cambio queda en las tablas *_HIST y AUDITORIA con el usuario real (ver AuditoriaSesionService).
 */
@Service
@Transactional(transactionManager = "negocioTransactionManager")
public class MantenimientoService {

    private static final String ACTIVO = "A";
    private static final String INACTIVO = "I";

    private final EntidadRepository entidades;
    private final TipoIncidenteRepository tipos;
    private final FuncionarioRepository funcionarios;
    private final ReporteRepository reportes;
    private final AuditoriaSesionService auditoria;

    public MantenimientoService(EntidadRepository entidades, TipoIncidenteRepository tipos,
                                FuncionarioRepository funcionarios, ReporteRepository reportes,
                                AuditoriaSesionService auditoria) {
        this.entidades = entidades;
        this.tipos = tipos;
        this.funcionarios = funcionarios;
        this.reportes = reportes;
        this.auditoria = auditoria;
    }

    // ------------------------------------------------------------ entidades

    @Transactional(transactionManager = "negocioTransactionManager", readOnly = true)
    public List<EntidadAdminDTO> listarEntidades() {
        return entidades.findAllByOrderByNombre().stream().map(this::aDto).toList();
    }

    public EntidadAdminDTO crearEntidad(EntidadRequest datos, UsuarioAutenticado admin) {
        String codigo = datos.codigo().trim().toUpperCase();
        if (entidades.existsByCodigoIgnoreCase(codigo)) {
            throw new ReglaNegocioException("Ya existe una entidad con el codigo " + codigo + ".");
        }
        auditoria.marcarNegocio(admin.usuario());
        Entidad e = new Entidad();
        e.setCodigo(codigo);
        e.setNombre(datos.nombre().trim());
        e.setDescripcion(limpiar(datos.descripcion()));
        e.setEstado(ACTIVO);
        return aDto(entidades.save(e));
    }

    public EntidadAdminDTO actualizarEntidad(Integer id, EntidadRequest datos, UsuarioAutenticado admin) {
        Entidad e = entidad(id);
        String codigo = datos.codigo().trim().toUpperCase();
        if (entidades.existsByCodigoIgnoreCaseAndIdEntidadNot(codigo, id)) {
            throw new ReglaNegocioException("Ya existe otra entidad con el codigo " + codigo + ".");
        }
        auditoria.marcarNegocio(admin.usuario());
        e.setCodigo(codigo);
        e.setNombre(datos.nombre().trim());
        e.setDescripcion(limpiar(datos.descripcion()));
        return aDto(entidades.save(e));
    }

    public EntidadAdminDTO cambiarEstadoEntidad(Integer id, boolean activo, UsuarioAutenticado admin) {
        Entidad e = entidad(id);
        if (!activo) {
            long tiposActivos = tipos.countByEntidadIdEntidadAndEstado(id, ACTIVO);
            long funcionariosActivos = funcionarios.countByEntidadIdEntidadAndEstado(id, ACTIVO);
            if (tiposActivos > 0) {
                throw new ReglaNegocioException("No se puede desactivar " + e.getCodigo() + ": tiene " + tiposActivos
                        + " tipo(s) de incidente activo(s). Desactivelos o pasenlos a otra entidad primero.");
            }
            if (funcionariosActivos > 0) {
                throw new ReglaNegocioException("No se puede desactivar " + e.getCodigo() + ": tiene " + funcionariosActivos
                        + " funcionario(s) activo(s). Dalos de baja primero.");
            }
        }
        auditoria.marcarNegocio(admin.usuario());
        e.setEstado(activo ? ACTIVO : INACTIVO);
        return aDto(entidades.save(e));
    }

    // ------------------------------------------------------------ tipos de incidente

    @Transactional(transactionManager = "negocioTransactionManager", readOnly = true)
    public List<TipoIncidenteAdminDTO> listarTipos() {
        return tipos.findAllByOrderByNombre().stream()
                .map(t -> TipoIncidenteAdminDTO.desde(t, reportes.countByTipoIncidenteIdTipoIncidente(t.getIdTipoIncidente())))
                .toList();
    }

    public TipoIncidenteAdminDTO crearTipo(TipoIncidenteRequest datos, UsuarioAutenticado admin) {
        String nombre = datos.nombre().trim();
        if (tipos.existsByNombreIgnoreCase(nombre)) {
            throw new ReglaNegocioException("Ya existe un tipo de incidente llamado \"" + nombre + "\".");
        }
        validarPrioridad(datos);
        Entidad entidad = entidadActiva(datos.idEntidad());

        auditoria.marcarNegocio(admin.usuario());
        TipoIncidente t = new TipoIncidente();
        t.setNombre(nombre);
        t.setEntidad(entidad);
        t.setPrioridadBase(datos.prioridadBase());
        t.setEsEmergencia(datos.esEmergencia());
        t.setEstado(ACTIVO);
        return TipoIncidenteAdminDTO.desde(tipos.save(t), 0);
    }

    public TipoIncidenteAdminDTO actualizarTipo(Integer id, TipoIncidenteRequest datos, UsuarioAutenticado admin) {
        TipoIncidente t = tipo(id);
        String nombre = datos.nombre().trim();
        if (tipos.existsByNombreIgnoreCaseAndIdTipoIncidenteNot(nombre, id)) {
            throw new ReglaNegocioException("Ya existe otro tipo de incidente llamado \"" + nombre + "\".");
        }
        validarPrioridad(datos);
        long usos = reportes.countByTipoIncidenteIdTipoIncidente(id);
        // Los reportes ya enviados quedaron derivados a la entidad de entonces: cambiarla ahora los dejaria
        // inconsistentes. Para mover un tipo de entidad se crea uno nuevo y se desactiva el anterior.
        if (!t.getEntidad().getIdEntidad().equals(datos.idEntidad()) && usos > 0) {
            throw new ReglaNegocioException("No se puede cambiar la entidad de un tipo que ya tiene " + usos
                    + " reporte(s). Cree un tipo nuevo para la otra entidad y desactive este.");
        }
        Entidad entidad = t.getEntidad().getIdEntidad().equals(datos.idEntidad()) ? t.getEntidad() : entidadActiva(datos.idEntidad());

        auditoria.marcarNegocio(admin.usuario());
        t.setNombre(nombre);
        t.setEntidad(entidad);
        t.setPrioridadBase(datos.prioridadBase());
        t.setEsEmergencia(datos.esEmergencia());
        return TipoIncidenteAdminDTO.desde(tipos.save(t), usos);
    }

    public TipoIncidenteAdminDTO cambiarEstadoTipo(Integer id, boolean activo, UsuarioAutenticado admin) {
        TipoIncidente t = tipo(id);
        if (activo && !ACTIVO.equals(t.getEntidad().getEstado())) {
            throw new ReglaNegocioException("No se puede activar el tipo: su entidad (" + t.getEntidad().getCodigo()
                    + ") esta inactiva. Active la entidad primero.");
        }
        auditoria.marcarNegocio(admin.usuario());
        t.setEstado(activo ? ACTIVO : INACTIVO);
        return TipoIncidenteAdminDTO.desde(tipos.save(t), reportes.countByTipoIncidenteIdTipoIncidente(id));
    }

    // ------------------------------------------------------------ auxiliares

    private EntidadAdminDTO aDto(Entidad e) {
        return EntidadAdminDTO.desde(e, tipos.countByEntidadIdEntidadAndEstado(e.getIdEntidad(), ACTIVO),
                funcionarios.countByEntidadIdEntidadAndEstado(e.getIdEntidad(), ACTIVO));
    }

    private Entidad entidad(Integer id) {
        return entidades.findById(id).orElseThrow(() -> new RecursoNoEncontradoException("La entidad no existe."));
    }

    private Entidad entidadActiva(Integer id) {
        Entidad e = entidad(id);
        if (!ACTIVO.equals(e.getEstado())) {
            throw new ReglaNegocioException("La entidad " + e.getCodigo() + " esta inactiva.");
        }
        return e;
    }

    private TipoIncidente tipo(Integer id) {
        return tipos.findById(id).orElseThrow(() -> new RecursoNoEncontradoException("El tipo de incidente no existe."));
    }

    /** Una emergencia siempre es prioridad 1 (critica): asi las emergencias van primero en la bandeja. */
    private void validarPrioridad(TipoIncidenteRequest datos) {
        if (datos.esEmergencia() && datos.prioridadBase() != 1) {
            throw new ReglaNegocioException("Un tipo marcado como emergencia debe tener prioridad 1 (critica).");
        }
    }

    private String limpiar(String texto) {
        return texto == null || texto.isBlank() ? null : texto.trim();
    }
}
