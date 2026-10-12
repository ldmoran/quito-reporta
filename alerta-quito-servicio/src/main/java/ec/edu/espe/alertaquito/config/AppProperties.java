package ec.edu.espe.alertaquito.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, Almacenamiento almacenamiento, Cors cors, Correo correo) {

    public record Jwt(String secreto, long expiracionMinutos) {
    }

    public record Almacenamiento(String directorio) {
    }

    public record Cors(List<String> origenesPermitidos) {
    }

    public record Correo(boolean habilitado, String remitente, String urlSistema) {
    }
}
