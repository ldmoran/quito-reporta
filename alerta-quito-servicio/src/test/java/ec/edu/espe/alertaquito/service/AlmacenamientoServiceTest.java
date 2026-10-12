package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.config.AppProperties;
import ec.edu.espe.alertaquito.exception.RecursoNoEncontradoException;
import ec.edu.espe.alertaquito.exception.ReglaNegocioException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AlmacenamientoServiceTest {

    @TempDir
    Path directorio;

    AlmacenamientoService servicio;

    @BeforeEach
    void preparar() {
        servicio = new AlmacenamientoService(new AppProperties(
                new AppProperties.Jwt("x".repeat(40), 5),
                new AppProperties.Almacenamiento(directorio.toString()),
                new AppProperties.Cors(List.of()),
                new AppProperties.Correo(false, "a@b.ec", "http://x")));
    }

    @Test
    void guardaUnaImagenYPuedeVolverALeerla() throws Exception {
        var foto = new MockMultipartFile("foto", "bache.jpg", "image/jpeg", new byte[]{1, 2, 3});

        var guardado = servicio.guardar(foto);

        assertTrue(guardado.ruta().endsWith(".jpg"));
        assertEquals("bache.jpg", guardado.nombreOriginal());
        assertTrue(Files.exists(directorio.resolve(guardado.ruta())));
        assertEquals(3, servicio.cargar(guardado.ruta()).contentLength());
    }

    @Test
    void rechazaArchivosQueNoSonImagen() {
        var texto = new MockMultipartFile("foto", "nota.txt", "text/plain", "hola".getBytes());

        assertThrows(ReglaNegocioException.class, () -> servicio.guardar(texto));
    }

    @Test
    void rechazaUnArchivoVacioOAusente() {
        var vacio = new MockMultipartFile("foto", "a.png", "image/png", new byte[0]);

        assertThrows(ReglaNegocioException.class, () -> servicio.guardar(vacio));
        assertThrows(ReglaNegocioException.class, () -> servicio.guardar(null));
    }

    @Test
    void noPermiteSalirseDeLaCarpetaDeEvidencias() {
        assertThrows(RecursoNoEncontradoException.class, () -> servicio.cargar("../../etc/passwd"));
        assertThrows(RecursoNoEncontradoException.class, () -> servicio.cargar("no-existe.jpg"));
    }
}
