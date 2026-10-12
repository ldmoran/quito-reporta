package ec.edu.espe.alertaquito.auth.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String PREFIJO = "Bearer ";
    private static final Set<String> PERMITIDAS_CON_CLAVE_TEMPORAL = Set.of("/api/auth/cambiar-password", "/api/auth/yo");

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String cabecera = request.getHeader("Authorization");
        if (cabecera != null && cabecera.startsWith(PREFIJO)) {
            var usuario = jwtService.validar(cabecera.substring(PREFIJO.length()));
            if (usuario.isPresent()) {
                UsuarioAutenticado u = usuario.get();
                if (u.debeCambiarPassword() && !PERMITIDAS_CON_CLAVE_TEMPORAL.contains(request.getRequestURI())) {
                    response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                    response.setContentType("application/json;charset=UTF-8");
                    response.getWriter().write(
                            "{\"codigo\":\"CAMBIO_PASSWORD\",\"mensaje\":\"Debe cambiar su contraseña temporal antes de continuar.\"}");
                    return;
                }
                var autoridades = u.perfiles().stream()
                        .map(p -> new SimpleGrantedAuthority("ROLE_" + p)).toList();
                SecurityContextHolder.getContext()
                        .setAuthentication(new UsernamePasswordAuthenticationToken(u, null, autoridades));
            }
        }
        chain.doFilter(request, response);
    }
}
