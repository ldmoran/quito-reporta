package ec.edu.espe.alertaquito.entity.negocio;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "tipo_incidente")
@Getter
@Setter
@NoArgsConstructor
public class TipoIncidente {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idTipoIncidente;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_entidad")
    private Entidad entidad;

    private String nombre;

    private Short prioridadBase;

    private Boolean esEmergencia;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 1)
    private String estado;
}
