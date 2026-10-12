package ec.edu.espe.alertaquito.entity.seguridad;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "perfil")
@Getter
@Setter
@NoArgsConstructor
public class Perfil {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idPerfil;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_aplicacion")
    private Aplicacion aplicacion;

    /** Codigo de 6 letras: se convierte en la autoridad ROLE_<codigo>. */
    private String codigo;

    private String nombre;

    private String descripcion;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 1)
    private String estado;
}
