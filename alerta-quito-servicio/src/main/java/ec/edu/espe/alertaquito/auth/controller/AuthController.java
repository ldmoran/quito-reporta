package ec.edu.espe.alertaquito.auth.controller;

import ec.edu.espe.alertaquito.auth.dto.AuthResponseDTO;
import ec.edu.espe.alertaquito.auth.dto.CambiarPasswordRequest;
import ec.edu.espe.alertaquito.auth.dto.LoginRequest;
import ec.edu.espe.alertaquito.auth.dto.RegistroCiudadanoRequest;
import ec.edu.espe.alertaquito.auth.security.JwtService;
import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;
import ec.edu.espe.alertaquito.service.UsuarioSeguridadService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UsuarioSeguridadService usuariosSeguridad;

    public AuthController(AuthenticationManager authenticationManager, JwtService jwtService,
                          UsuarioSeguridadService usuariosSeguridad) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.usuariosSeguridad = usuariosSeguridad;
    }

    @PostMapping("/login")
    public AuthResponseDTO login(@Valid @RequestBody LoginRequest req) {
        Authentication auth = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(req.usuario(), req.password()));
        return respuesta((UsuarioAutenticado) auth.getPrincipal());
    }

    /** Autoregistro: solo crea ciudadanos. Funcionarios y administradores los crea el administrador. */
    @PostMapping("/registro")
    @ResponseStatus(HttpStatus.CREATED)
    public void registrar(@Valid @RequestBody RegistroCiudadanoRequest req) {
        usuariosSeguridad.crear(req.nombreCompleto(), req.cedula(), req.correo(), req.usuario(), req.password(),
                UsuarioAutenticado.CIUDADANO, false, req.usuario());
    }

    /** Permitido incluso con la clave temporal; devuelve un token nuevo ya sin la marca de cambio pendiente. */
    @PostMapping("/cambiar-password")
    public AuthResponseDTO cambiarPassword(@Valid @RequestBody CambiarPasswordRequest req,
                                           @AuthenticationPrincipal UsuarioAutenticado u) {
        usuariosSeguridad.cambiarPassword(u.idUsuarioSeguridad(), req.passwordActual(), req.passwordNueva(), u.usuario());
        return respuesta(u.conPasswordCambiada());
    }

    @GetMapping("/yo")
    public AuthResponseDTO yo(@AuthenticationPrincipal UsuarioAutenticado u) {
        return respuesta(u);
    }

    private AuthResponseDTO respuesta(UsuarioAutenticado u) {
        return new AuthResponseDTO(u.idUsuario(), u.usuario(), u.nombre(), List.copyOf(u.perfiles()),
                jwtService.generar(u), jwtService.expiracionSegundos(), u.debeCambiarPassword());
    }
}
