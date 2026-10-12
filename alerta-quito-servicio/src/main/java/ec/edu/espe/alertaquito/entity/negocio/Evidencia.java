package ec.edu.espe.alertaquito.entity.negocio;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "evidencia")
@Getter
@Setter
@NoArgsConstructor
public class Evidencia {

    public static final String CREACION = "CREACION";
    public static final String RESOLUCION = "RESOLUCION";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idEvidencia;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_reporte", updatable = false)
    private Reporte reporte;

    /** CREACION (foto del ciudadano) o RESOLUCION (foto del funcionario). */
    private String tipo;

    private String nombreArchivo;

    private String rutaArchivo;

    private String contentType;

    private String subidoPor;

    @Column(insertable = false, updatable = false)
    private LocalDateTime fecha;
}
