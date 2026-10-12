package ec.edu.espe.alertaquito.entity.negocio;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** Solo lectura: lo escribe el trigger en cada cambio de estado. */
@Entity
@Table(name = "historial_estado")
@Getter
@Setter
@NoArgsConstructor
public class HistorialEstado {

    @Id
    private Long idHistorial;

    @Column(name = "id_reporte", insertable = false, updatable = false)
    private Long idReporte;

    @Column(insertable = false, updatable = false)
    private String estadoAnterior;

    @Column(insertable = false, updatable = false)
    private String estadoNuevo;

    @Column(insertable = false, updatable = false)
    private String usuarioAccion;

    @Column(insertable = false, updatable = false)
    private String comentario;

    @Column(insertable = false, updatable = false)
    private LocalDateTime fecha;
}
