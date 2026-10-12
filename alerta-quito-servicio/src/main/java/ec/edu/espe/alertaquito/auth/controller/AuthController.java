package ec.edu.espe.alertaquito.auth.controller;

import ec.edu.espe.alertaquito.auth.dto.AuthResponseDTO;
import ec.edu.espe.alertaquito.auth.dto.CambiarPasswordRequest;
import ec.edu.espe.alertaquito.auth.dto.LoginRequest;
import ec.edu.espe.alertaquito.auth.dto.OlvidePasswordRequest;
import ec.edu.espe.alertaquito.auth.dto.RestablecerPasswordRequest;
import ec.edu.espe.alertaquito.auth.dto.RegistroCiudadanoRequest;
import ec.edu.espe.alertaquito.auth.security.JwtService;
import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;
import ec.edu.espe.alertaquito.service.RecuperacionPasswordService;
import ec.edu.espe.alertaquito.service.UsuarioSeguridadService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UsuarioSeguridadService usuariosSeguridad;
    private final RecuperacionPasswordService recuperacion;

    public AuthController(AuthenticationManager authenticationManager, JwtService jwtService,
                          UsuarioSeguridadService usuariosSeguridad, RecuperacionPasswordService recuperacion) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.usuariosSeguridad = usuariosSeguridad;
        this.recuperacion = recuperacion;
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

    /** "Olvide mi contrasena": siempre responde lo mismo, exista o no la cuenta (no revela quien esta registrado). */
    @PostMapping("/olvide-password")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public Map<String, String> olvidePassword(@Valid @RequestBody OlvidePasswordRequest req) {
        recuperacion.solicitar(req.identificador());
        return Map.of("mensaje", "Si la cuenta existe, enviamos un correo con las instrucciones. El enlace vence en "
                + RecuperacionPasswordService.MINUTOS_VALIDEZ + " minutos.");
    }

    /** Fija una clave nueva con el enlace recibido por correo. */
    @PostMapping("/restablecer-password")
    public Map<String, String> restablecerPassword(@Valid @RequestBody RestablecerPasswordRequest req) {
        recuperacion.restablecer(req.token(), req.passwordNueva());
        return Map.of("mensaje", "Contraseña actualizada. Ya puede iniciar sesión.");
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
