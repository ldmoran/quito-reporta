package ec.edu.espe.alertaquito.controller;

import ec.edu.espe.alertaquito.dto.AuditoriaDTO;
import ec.edu.espe.alertaquito.service.AuditoriaService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** Solo lectura: la tabla AUDITORIA la alimentan los triggers de las dos bases. */
@RestController
@RequestMapping("/api/admin/auditoria")
@PreAuthorize("hasRole('ADMINI')")
public class AuditoriaController {

    private final AuditoriaService auditoria;

    public AuditoriaController(AuditoriaService auditoria) {
        this.auditoria = auditoria;
    }

    @GetMapping
    public AuditoriaDTO.Pagina buscar(@RequestParam(required = false) String tabla,
                                      @RequestParam(required = false) String accion,
                                      @RequestParam(required = false) String usuario,
                                      @RequestParam(defaultValue = "0") int pagina) {
        return auditoria.buscar(tabla, accion, usuario, pagina);
    }

    /** Que cambio exactamente en un registro: las copias sucesivas guardadas por los triggers. */
    @GetMapping("/historial")
    public List<Map<String, Object>> historial(@RequestParam String origen, @RequestParam String tabla,
                                               @RequestParam String idRegistro) {
        return auditoria.historial(origen, tabla, idRegistro);
    }
}
