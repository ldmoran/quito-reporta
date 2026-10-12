package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;
import ec.edu.espe.alertaquito.dto.EntidadRequest;
import ec.edu.espe.alertaquito.dto.TipoIncidenteRequest;
import ec.edu.espe.alertaquito.entity.negocio.Entidad;
import ec.edu.espe.alertaquito.entity.negocio.TipoIncidente;
import ec.edu.espe.alertaquito.exception.RecursoNoEncontradoException;
import ec.edu.espe.alertaquito.exception.ReglaNegocioException;
import ec.edu.espe.alertaquito.repository.negocio.EntidadRepository;
import ec.edu.espe.alertaquito.repository.negocio.FuncionarioRepository;
import ec.edu.espe.alertaquito.repository.negocio.ReporteRepository;
import ec.edu.espe.alertaquito.repository.negocio.TipoIncidenteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MantenimientoServiceTest {

    @Mock EntidadRepository entidades;
    @Mock TipoIncidenteRepository tipos;
    @Mock FuncionarioRepository funcionarios;
    @Mock ReporteRepository reportes;
    @Mock AuditoriaSesionService auditoria;

    MantenimientoService servicio;
    final UsuarioAutenticado admin = new UsuarioAutenticado(1, 1, "admin", "Admin", Set.of("ADMINI"), false);

    @BeforeEach
    void preparar() {
        servicio = new MantenimientoService(entidades, tipos, funcionarios, reportes, auditoria);
        lenient().when(entidades.save(any(Entidad.class))).thenAnswer(i -> i.getArgument(0));
        lenient().when(tipos.save(any(TipoIncidente.class))).thenAnswer(i -> i.getArgument(0));
    }

    private Entidad entidad(int id, String codigo, String estado) {
        Entidad e = new Entidad();
        e.setIdEntidad(id);
        e.setCodigo(codigo);
        e.setNombre("Entidad " + codigo);
        e.setEstado(estado);
        return e;
    }

    private TipoIncidente tipo(int id, Entidad e) {
        TipoIncidente t = new TipoIncidente();
        t.setIdTipoIncidente(id);
        t.setNombre("Tipo " + id);
        t.setEntidad(e);
        t.setPrioridadBase((short) 3);
        t.setEsEmergencia(false);
        t.setEstado("A");
        return t;
    }

    @Test
    void creaUnaEntidadConElCodigoEnMayusculasYMarcaElUsuarioDeLaAuditoria() {
        var dto = servicio.crearEntidad(new EntidadRequest(" ecu911 ", "  Servicio Integrado ", " "), admin);

        assertEquals("ECU911", dto.codigo());
        assertEquals("Servicio Integrado", dto.nombre());
        assertNull(dto.descripcion());
        assertEquals("A", dto.estado());
        verify(auditoria).marcarNegocio("admin");
    }

    @Test
    void noPermiteDosEntidadesConElMismoCodigo() {
        when(entidades.existsByCodigoIgnoreCase("EPMMOP")).thenReturn(true);

        assertThrows(ReglaNegocioException.class, () -> servicio.crearEntidad(new EntidadRequest("epmmop", "X", null), admin));
        verify(entidades, never()).save(any());
    }

    @Test
    void noSePuedeDesactivarUnaEntidadConTiposOFuncionariosActivos() {
        when(entidades.findById(1)).thenReturn(Optional.of(entidad(1, "AMT", "A")));
        when(tipos.countByEntidadIdEntidadAndEstado(1, "A")).thenReturn(2L);

        var error = assertThrows(ReglaNegocioException.class, () -> servicio.cambiarEstadoEntidad(1, false, admin));
        assertTrue(error.getMessage().contains("tipo(s) de incidente activo(s)"));

        when(tipos.countByEntidadIdEntidadAndEstado(1, "A")).thenReturn(0L);
        when(funcionarios.countByEntidadIdEntidadAndEstado(1, "A")).thenReturn(1L);
        error = assertThrows(ReglaNegocioException.class, () -> servicio.cambiarEstadoEntidad(1, false, admin));
        assertTrue(error.getMessage().contains("funcionario(s) activo(s)"));
    }

    @Test
    void desactivaUnaEntidadSinDependencias() {
        Entidad e = entidad(1, "AMT", "A");
        when(entidades.findById(1)).thenReturn(Optional.of(e));

        assertEquals("I", servicio.cambiarEstadoEntidad(1, false, admin).estado());
    }

    @Test
    void unaEmergenciaDebeSerPrioridadCritica() {
        var error = assertThrows(ReglaNegocioException.class,
                () -> servicio.crearTipo(new TipoIncidenteRequest("Incendio", 1, (short) 3, true), admin));
        assertTrue(error.getMessage().contains("prioridad 1"));
    }

    @Test
    void noSeCreaUnTipoEnUnaEntidadInactivaNiInexistente() {
        when(entidades.findById(7)).thenReturn(Optional.of(entidad(7, "OLD", "I")));
        when(entidades.findById(9)).thenReturn(Optional.empty());

        assertThrows(ReglaNegocioException.class, () -> servicio.crearTipo(new TipoIncidenteRequest("A", 7, (short) 2, false), admin));
        assertThrows(RecursoNoEncontradoException.class, () -> servicio.crearTipo(new TipoIncidenteRequest("B", 9, (short) 2, false), admin));
    }

    @Test
    void noSeCambiaLaEntidadDeUnTipoQueYaTieneReportes() {
        Entidad epmmop = entidad(1, "EPMMOP", "A");
        when(tipos.findById(5)).thenReturn(Optional.of(tipo(5, epmmop)));
        when(reportes.countByTipoIncidenteIdTipoIncidente(5)).thenReturn(12L);

        var error = assertThrows(ReglaNegocioException.class,
                () -> servicio.actualizarTipo(5, new TipoIncidenteRequest("Tipo 5", 2, (short) 3, false), admin));

        assertTrue(error.getMessage().contains("12 reporte(s)"));
        verify(tipos, never()).save(any());
    }

    @Test
    void sePuedeEditarNombreYPrioridadDeUnTipoConReportesSiNoCambiaDeEntidad() {
        Entidad epmmop = entidad(1, "EPMMOP", "A");
        when(tipos.findById(5)).thenReturn(Optional.of(tipo(5, epmmop)));
        when(reportes.countByTipoIncidenteIdTipoIncidente(5)).thenReturn(12L);

        var dto = servicio.actualizarTipo(5, new TipoIncidenteRequest("Bache profundo", 1, (short) 2, false), admin);

        assertEquals("Bache profundo", dto.nombre());
        assertEquals((short) 2, dto.prioridadBase());
        assertEquals(12, dto.reportes());
    }

    @Test
    void noSeActivaUnTipoCuyaEntidadEstaInactiva() {
        when(tipos.findById(5)).thenReturn(Optional.of(tipo(5, entidad(1, "OLD", "I"))));

        assertThrows(ReglaNegocioException.class, () -> servicio.cambiarEstadoTipo(5, true, admin));
        // desactivar si se puede siempre
        assertEquals("I", servicio.cambiarEstadoTipo(5, false, admin).estado());
    }

    @Test
    void noPermiteNombresDeTipoDuplicadosSinImportarMayusculas() {
        when(tipos.existsByNombreIgnoreCase("BACHE")).thenReturn(true);

        assertThrows(ReglaNegocioException.class, () -> servicio.crearTipo(new TipoIncidenteRequest("BACHE", 1, (short) 3, false), admin));
    }
}
