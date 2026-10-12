package ec.edu.espe.alertaquito.entity.negocio;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** Ficha local del usuario; las credenciales viven en la base de seguridad. */
@Entity
@Table(name = "usuario")
@Getter
@Setter
@NoArgsConstructor
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idUsuario;

    private Integer idUsuarioSeguridad;

    private String usuario;

    private String nombreCompleto;

    private String correo;

    private LocalDateTime ultimoAcceso;
}
