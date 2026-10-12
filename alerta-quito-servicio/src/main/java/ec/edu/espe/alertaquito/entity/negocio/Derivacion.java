package ec.edu.espe.alertaquito.entity.negocio;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** Solo lectura: la crea el trigger al insertar el reporte. */
@Entity
@Table(name = "derivacion")
@Getter
@Setter
@NoArgsConstructor
public class Derivacion {

    @Id
    private Long idDerivacion;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_reporte", insertable = false, updatable = false)
    private Reporte reporte;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_entidad", insertable = false, updatable = false)
    private Entidad entidad;

    @Column(insertable = false, updatable = false)
    private LocalDateTime fechaDerivacion;
}
