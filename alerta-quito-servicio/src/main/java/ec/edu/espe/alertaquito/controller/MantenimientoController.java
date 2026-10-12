package ec.edu.espe.alertaquito.controller;

import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;
import ec.edu.espe.alertaquito.dto.CambioEstadoRequest;
import ec.edu.espe.alertaquito.dto.EntidadAdminDTO;
import ec.edu.espe.alertaquito.dto.EntidadRequest;
import ec.edu.espe.alertaquito.dto.TipoIncidenteAdminDTO;
import ec.edu.espe.alertaquito.dto.TipoIncidenteRequest;
import ec.edu.espe.alertaquito.service.MantenimientoService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Mantenimiento de catalogos: solo el administrador. Nada se borra, se activa o desactiva. */
@RestController
@RequestMapping("/api/admin/mantenimiento")
@PreAuthorize("hasRole('ADMINI')")
public class MantenimientoController {

    private final MantenimientoService mantenimiento;

    public MantenimientoController(MantenimientoService mantenimiento) {
        this.mantenimiento = mantenimiento;
    }

    @GetMapping("/entidades")
    public List<EntidadAdminDTO> entidades() {
        return mantenimiento.listarEntidades();
    }

    @PostMapping("/entidades")
    @ResponseStatus(HttpStatus.CREATED)
    public EntidadAdminDTO crearEntidad(@Valid @RequestBody EntidadRequest datos, @AuthenticationPrincipal UsuarioAutenticado admin) {
        return mantenimiento.crearEntidad(datos, admin);
    }

    @PutMapping("/entidades/{id}")
    public EntidadAdminDTO actualizarEntidad(@PathVariable Integer id, @Valid @RequestBody EntidadRequest datos,
                                             @AuthenticationPrincipal UsuarioAutenticado admin) {
        return mantenimiento.actualizarEntidad(id, datos, admin);
    }

    @PatchMapping("/entidades/{id}/estado")
    public EntidadAdminDTO estadoEntidad(@PathVariable Integer id, @RequestBody CambioEstadoRequest cambio,
                                         @AuthenticationPrincipal UsuarioAutenticado admin) {
        return mantenimiento.cambiarEstadoEntidad(id, cambio.activo(), admin);
    }

    @GetMapping("/tipos-incidente")
    public List<TipoIncidenteAdminDTO> tipos() {
        return mantenimiento.listarTipos();
    }

    @PostMapping("/tipos-incidente")
    @ResponseStatus(HttpStatus.CREATED)
    public TipoIncidenteAdminDTO crearTipo(@Valid @RequestBody TipoIncidenteRequest datos, @AuthenticationPrincipal UsuarioAutenticado admin) {
        return mantenimiento.crearTipo(datos, admin);
    }

    @PutMapping("/tipos-incidente/{id}")
    public TipoIncidenteAdminDTO actualizarTipo(@PathVariable Integer id, @Valid @RequestBody TipoIncidenteRequest datos,
                                                @AuthenticationPrincipal UsuarioAutenticado admin) {
        return mantenimiento.actualizarTipo(id, datos, admin);
    }

    @PatchMapping("/tipos-incidente/{id}/estado")
    public TipoIncidenteAdminDTO estadoTipo(@PathVariable Integer id, @RequestBody CambioEstadoRequest cambio,
                                            @AuthenticationPrincipal UsuarioAutenticado admin) {
        return mantenimiento.cambiarEstadoTipo(id, cambio.activo(), admin);
    }
}
