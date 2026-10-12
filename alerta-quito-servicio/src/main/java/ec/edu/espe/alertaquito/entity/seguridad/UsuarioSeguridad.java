package ec.edu.espe.alertaquito.entity.seguridad;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "usuario")
@Getter
@Setter
@NoArgsConstructor
public class UsuarioSeguridad {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idUsuario;

    private String usuario;

    private String nombreCompleto;

    private String cedula;

    private String correo;

    private String passwordHash;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 1)
    private String estado;

    private Short intentosFallidos;

    private Boolean bloqueado;

    private Boolean debeCambiarPassword;

    private LocalDateTime ultimoAcceso;

    @Column(insertable = false, updatable = false)
    private LocalDateTime fechaCreacion;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(name = "usuario_perfil",
            joinColumns = @JoinColumn(name = "id_usuario"),
            inverseJoinColumns = @JoinColumn(name = "id_perfil"))
    private Set<Perfil> perfiles = new HashSet<>();

    public boolean estaActivo() {
        return "A".equals(estado);
    }
}
