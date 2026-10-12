package ec.edu.espe.alertaquito.entity.negocio;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.LocalDateTime;

/**
 * Los campos marcados @Generated los calcula la base con triggers
 * (codigo, prioridad, estado inicial y fechas); Hibernate los lee de vuelta.
 */
@Entity
@Table(name = "reporte")
@Getter
@Setter
@NoArgsConstructor
public class Reporte {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idReporte;

    @Generated(event = EventType.INSERT)
    @Column(insertable = false, updatable = false)
    private String codigo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_ciudadano", updatable = false)
    private Usuario ciudadano;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_tipo_incidente", updatable = false)
    private TipoIncidente tipoIncidente;

    private String descripcion;

    @Generated(event = EventType.INSERT)
    @Column(insertable = false, updatable = false)
    private Short prioridad;

    /** Al insertar, el trigger lo fuerza a REGISTRADO sea cual sea el valor enviado. */
    @Enumerated(EnumType.STRING)
    private EstadoReporte estado = EstadoReporte.REGISTRADO;

    /** Los llena la app al cambiar de estado; el trigger los copia al historial. */
    private String comentarioEstado;

    private String actualizadoPor;

    @Generated(event = EventType.INSERT)
    @Column(insertable = false, updatable = false)
    private LocalDateTime fechaCreacion;

    /** El trigger la actualiza en cada UPDATE; el servicio hace refresh() tras guardar. */
    @Generated(event = EventType.INSERT)
    @Column(insertable = false, updatable = false)
    private LocalDateTime fechaActualizacion;

    @OneToOne(mappedBy = "reporte", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private Ubicacion ubicacion;
}
