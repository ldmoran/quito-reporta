package ec.edu.espe.alertaquito.entity.seguridad;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "intento_acceso")
@Getter
@Setter
@NoArgsConstructor
public class IntentoAcceso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idIntento;

    private String usuario;

    private Boolean exitoso;

    private String motivo;

    @Column(insertable = false, updatable = false)
    private LocalDateTime fecha;

    public IntentoAcceso(String usuario, boolean exitoso, String motivo) {
        this.usuario = usuario;
        this.exitoso = exitoso;
        this.motivo = motivo;
    }
}
