package ec.edu.espe.alertaquito.controller;

import ec.edu.espe.alertaquito.dto.EntidadDTO;
import ec.edu.espe.alertaquito.dto.TipoIncidenteDTO;
import ec.edu.espe.alertaquito.service.CatalogoService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class CatalogoController {

    private final CatalogoService catalogos;

    public CatalogoController(CatalogoService catalogos) {
        this.catalogos = catalogos;
    }

    /** Opciones del formulario de reporte (RF-06: se elige, no se escribe). */
    @GetMapping("/tipos-incidente")
    public List<TipoIncidenteDTO> tiposIncidente() {
        return catalogos.tiposIncidenteActivos();
    }

    @GetMapping("/entidades")
    public List<EntidadDTO> entidades() {
        return catalogos.entidadesActivas();
    }
}
