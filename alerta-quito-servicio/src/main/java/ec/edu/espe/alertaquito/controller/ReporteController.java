package ec.edu.espe.alertaquito.controller;

import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;
import ec.edu.espe.alertaquito.dto.CrearReporteRequest;
import ec.edu.espe.alertaquito.dto.ReporteDetalleDTO;
import ec.edu.espe.alertaquito.dto.ReporteResumenDTO;
import ec.edu.espe.alertaquito.entity.negocio.EstadoReporte;
import ec.edu.espe.alertaquito.service.ReporteService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/reportes")
public class ReporteController {

    private final ReporteService reportes;

    public ReporteController(ReporteService reportes) {
        this.reportes = reportes;
    }

    /** multipart: parte "datos" (JSON) + parte "foto" (imagen). */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CIUDAD')")
    @ResponseStatus(HttpStatus.CREATED)
    public ReporteDetalleDTO crear(@Valid @RequestPart("datos") CrearReporteRequest datos,
                                   @RequestPart("foto") MultipartFile foto,
                                   @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return reportes.crear(datos, foto, usuario);
    }

    @GetMapping("/mios")
    @PreAuthorize("hasRole('CIUDAD')")
    public List<ReporteResumenDTO> misReportes(@AuthenticationPrincipal UsuarioAutenticado usuario) {
        return reportes.misReportes(usuario);
    }

    @GetMapping("/bandeja")
    @PreAuthorize("hasRole('FUNCIO')")
    public List<ReporteResumenDTO> bandeja(@RequestParam(defaultValue = "false") boolean incluirCerrados,
                                           @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return reportes.bandeja(incluirCerrados, usuario);
    }

    @GetMapping("/{id}")
    public ReporteDetalleDTO detalle(@PathVariable Long id, @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return reportes.detalle(id, usuario);
    }

    /** multipart: "estado", "comentario" opcional y "foto" (obligatoria solo para RESUELTO). */
    @PostMapping(path = "/{id}/estado", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('FUNCIO')")
    public ReporteDetalleDTO cambiarEstado(@PathVariable Long id,
                                           @RequestParam EstadoReporte estado,
                                           @RequestParam(required = false) String comentario,
                                           @RequestPart(value = "foto", required = false) MultipartFile foto,
                                           @AuthenticationPrincipal UsuarioAutenticado usuario) {
        return reportes.cambiarEstado(id, estado, comentario, foto, usuario);
    }

    @GetMapping("/{id}/evidencias/{idEvidencia}/archivo")
    public ResponseEntity<org.springframework.core.io.Resource> archivo(
            @PathVariable Long id, @PathVariable Long idEvidencia,
            @AuthenticationPrincipal UsuarioAutenticado usuario) {
        ReporteService.ArchivoEvidencia a = reportes.archivoEvidencia(id, idEvidencia, usuario);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(a.contentType() == null ? "application/octet-stream" : a.contentType()))
                .body(a.recurso());
    }
}
