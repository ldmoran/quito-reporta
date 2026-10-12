package ec.edu.espe.alertaquito.auth.security;

import ec.edu.espe.alertaquito.auth.service.AuthService;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

/**
 * Igual que en el SGFDM: Spring Security delega el login en AuthService, que
 * consulta la base de seguridad y devuelve el usuario con sus perfiles; cada
 * perfil se convierte en la autoridad ROLE_codigo.
 */
@Component
public class CustomAuthenticationProvider implements AuthenticationProvider {

    private final AuthService authService;

    public CustomAuthenticationProvider(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public Authentication authenticate(Authentication authentication) throws AuthenticationException {
        UsuarioAutenticado u = authService.autenticar(
                authentication.getName(), String.valueOf(authentication.getCredentials()));
        var autoridades = u.perfiles().stream().map(p -> new SimpleGrantedAuthority("ROLE_" + p)).toList();
        return new UsernamePasswordAuthenticationToken(u, null, autoridades);
    }

    @Override
    public boolean supports(Class<?> authentication) {
        return UsernamePasswordAuthenticationToken.class.isAssignableFrom(authentication);
    }
}
