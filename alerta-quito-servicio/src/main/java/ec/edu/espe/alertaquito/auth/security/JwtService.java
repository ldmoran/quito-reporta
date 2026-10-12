package ec.edu.espe.alertaquito.auth.security;

import ec.edu.espe.alertaquito.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;

@Service
public class JwtService {

    private final SecretKey clave;
    private final long expiracionMinutos;

    public JwtService(AppProperties props) {
        byte[] bytes = props.jwt().secreto().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("app.jwt.secreto debe tener al menos 32 caracteres");
        }
        this.clave = Keys.hmacShaKeyFor(bytes);
        this.expiracionMinutos = props.jwt().expiracionMinutos();
    }

    public String generar(UsuarioAutenticado u) {
        Instant ahora = Instant.now();
        return Jwts.builder()
                .subject(u.usuario())
                .claim("uid", u.idUsuario())
                .claim("sid", u.idUsuarioSeguridad())
                .claim("nom", u.nombre())
                .claim("perfiles", List.copyOf(u.perfiles()))
                .claim("cp", u.debeCambiarPassword())
                .issuedAt(Date.from(ahora))
                .expiration(Date.from(ahora.plus(expiracionMinutos, ChronoUnit.MINUTES)))
                .signWith(clave)
                .compact();
    }

    public long expiracionSegundos() {
        return expiracionMinutos * 60;
    }

    /** Devuelve el usuario del token, o vacio si esta vencido, alterado o mal formado. */
    @SuppressWarnings("unchecked")
    public Optional<UsuarioAutenticado> validar(String token) {
        try {
            Claims c = Jwts.parser().verifyWith(clave).build().parseSignedClaims(token).getPayload();
            List<String> perfiles = c.get("perfiles", List.class);
            return Optional.of(new UsuarioAutenticado(
                    c.get("uid", Integer.class), c.get("sid", Integer.class), c.getSubject(),
                    c.get("nom", String.class), new HashSet<>(perfiles),
                    Boolean.TRUE.equals(c.get("cp", Boolean.class))));
        } catch (JwtException | IllegalArgumentException | ClassCastException | NullPointerException e) {
            return Optional.empty();
        }
    }
}
