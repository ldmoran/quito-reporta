package ec.edu.espe.alertaquito.entity.negocio;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "entidad")
@Getter
@Setter
@NoArgsConstructor
public class Entidad {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idEntidad;

    private String codigo;

    private String nombre;

    private String descripcion;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 1)
    private String estado;
}
