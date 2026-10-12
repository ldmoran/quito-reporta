package ec.edu.espe.alertaquito.controller;

import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;
import ec.edu.espe.alertaquito.dto.ActualizarFuncionarioRequest;
import ec.edu.espe.alertaquito.dto.CambioEstadoRequest;
import ec.edu.espe.alertaquito.dto.CredencialesTemporalesDTO;
import ec.edu.espe.alertaquito.dto.EstadisticasDTO;
import ec.edu.espe.alertaquito.dto.FuncionarioCreadoDTO;
import ec.edu.espe.alertaquito.dto.FuncionarioDTO;
import ec.edu.espe.alertaquito.dto.RegistrarFuncionarioRequest;
import ec.edu.espe.alertaquito.service.EstadisticasService;
import ec.edu.espe.alertaquito.service.FuncionarioAdminService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMINI')")
public class AdminController {

    private final FuncionarioAdminService funcionarios;
    private final EstadisticasService estadisticas;

    public AdminController(FuncionarioAdminService funcionarios, EstadisticasService estadisticas) {
        this.funcionarios = funcionarios;
        this.estadisticas = estadisticas;
    }

    @GetMapping("/funcionarios")
    public List<FuncionarioDTO> listar() {
        return funcionarios.listar();
    }

    @PostMapping("/funcionarios")
    @ResponseStatus(HttpStatus.CREATED)
    public FuncionarioCreadoDTO registrar(@Valid @RequestBody RegistrarFuncionarioRequest datos,
                                    @AuthenticationPrincipal UsuarioAutenticado admin) {
        return funcionarios.registrar(datos, admin);
    }

    @PutMapping("/funcionarios/{id}")
    public FuncionarioDTO actualizar(@PathVariable Integer id, @Valid @RequestBody ActualizarFuncionarioRequest datos,
                                     @AuthenticationPrincipal UsuarioAutenticado admin) {
        return funcionarios.actualizar(id, datos, admin);
    }

    /** activo = false: dar de baja; activo = true: volver a dar de alta. */
    @PatchMapping("/funcionarios/{id}/estado")
    public FuncionarioDTO cambiarEstado(@PathVariable Integer id, @RequestBody CambioEstadoRequest cambio,
                                        @AuthenticationPrincipal UsuarioAutenticado admin) {
        if (cambio.activo()) {
            return funcionarios.darDeAlta(id, admin);
        }
        funcionarios.darDeBaja(id, admin);
        return funcionarios.listar().stream().filter(f -> f.id().equals(id)).findFirst().orElseThrow();
    }

    @DeleteMapping("/funcionarios/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void darDeBaja(@PathVariable Integer id, @AuthenticationPrincipal UsuarioAutenticado admin) {
        funcionarios.darDeBaja(id, admin);
    }

    @PostMapping("/usuarios/{usuario}/desbloquear")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desbloquear(@PathVariable String usuario, @AuthenticationPrincipal UsuarioAutenticado admin) {
        funcionarios.desbloquearUsuario(usuario, admin);
    }

    @PostMapping("/usuarios/{usuario}/restablecer-password")
    public CredencialesTemporalesDTO restablecerPassword(@PathVariable String usuario,
                                                         @AuthenticationPrincipal UsuarioAutenticado admin) {
        return funcionarios.restablecerPassword(usuario, admin);
    }

    @GetMapping("/estadisticas")
    public EstadisticasDTO estadisticas() {
        return estadisticas.resumen();
    }
}
