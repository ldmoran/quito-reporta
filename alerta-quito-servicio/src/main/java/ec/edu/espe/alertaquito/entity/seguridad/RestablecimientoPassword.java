package ec.edu.espe.alertaquito.entity.seguridad;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** Enlace de "olvide mi contrasena". Solo se guarda el hash del token. */
@Entity
@Table(name = "restablecimiento_password")
@Getter
@Setter
@NoArgsConstructor
public class RestablecimientoPassword {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idRestablecimiento;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_usuario")
    private UsuarioSeguridad usuario;

    @Column(length = 64)
    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.CHAR)
    private String tokenHash;

    private LocalDateTime fechaCreacion;

    private LocalDateTime fechaExpiracion;

    private Boolean usado;
}
