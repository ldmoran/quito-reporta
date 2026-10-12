package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.config.AppProperties;
import ec.edu.espe.alertaquito.exception.RecursoNoEncontradoException;
import ec.edu.espe.alertaquito.exception.ReglaNegocioException;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

/**
 * Guarda las fotos en disco (la base solo guarda la ruta). Ojo en Render: el
 * disco del plan gratuito es efimero; para produccion montar un Disk o usar S3.
 */
@Service
public class AlmacenamientoService {

    private static final Map<String, String> EXTENSIONES = Map.of(
            "image/jpeg", ".jpg", "image/png", ".png", "image/webp", ".webp");

    private final Path raiz;

    public AlmacenamientoService(AppProperties props) {
        this.raiz = Path.of(props.almacenamiento().directorio()).toAbsolutePath().normalize();
    }

    /** @return ruta relativa a la raiz, la que se guarda en la tabla EVIDENCIA */
    public Guardado guardar(MultipartFile archivo) {
        if (archivo == null || archivo.isEmpty()) {
            throw new ReglaNegocioException("La foto es obligatoria.");
        }
        String extension = EXTENSIONES.get(archivo.getContentType());
        if (extension == null) {
            throw new ReglaNegocioException("La evidencia debe ser una imagen JPG, PNG o WEBP.");
        }
        String nombre = UUID.randomUUID() + extension;
        try {
            Files.createDirectories(raiz);
            archivo.transferTo(raiz.resolve(nombre));
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo guardar la evidencia", e);
        }
        return new Guardado(nombre, archivo.getOriginalFilename() == null ? nombre : archivo.getOriginalFilename(),
                archivo.getContentType());
    }

    public Resource cargar(String ruta) {
        Path destino = raiz.resolve(ruta).normalize();
        if (!destino.startsWith(raiz) || !Files.isReadable(destino)) {
            throw new RecursoNoEncontradoException("El archivo de la evidencia no esta disponible.");
        }
        return new FileSystemResource(destino);
    }

    public record Guardado(String ruta, String nombreOriginal, String contentType) {
    }
}
