package ec.edu.espe.alertaquito.entity.seguridad;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "aplicacion")
@Getter
@Setter
@NoArgsConstructor
public class Aplicacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer idAplicacion;

    private String codigo;

    private String nombre;

    @JdbcTypeCode(SqlTypes.CHAR)
    @Column(length = 1)
    private String estado;
}
