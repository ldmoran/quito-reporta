package ec.edu.espe.alertaquito.exception;

import org.postgresql.util.PSQLException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
public class ManejadorErrores {

    private static final Logger log = LoggerFactory.getLogger(ManejadorErrores.class);
    private static final String CHECK_VIOLATION = "23514";
    private static final String UNIQUE_VIOLATION = "23505";

    @ExceptionHandler(ReglaNegocioException.class)
    public ResponseEntity<Map<String, String>> reglaNegocio(ReglaNegocioException e) {
        return error(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(RecursoNoEncontradoException.class)
    public ResponseEntity<Map<String, String>> noEncontrado(RecursoNoEncontradoException e) {
        return error(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> validacion(MethodArgumentNotValidException e) {
        String detalle = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return error(HttpStatus.BAD_REQUEST, detalle);
    }

    @ExceptionHandler({MissingServletRequestPartException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<Map<String, String>> faltaParametro(Exception e) {
        return error(HttpStatus.BAD_REQUEST, "Falta un dato obligatorio en la solicitud: " + e.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> archivoGrande(MaxUploadSizeExceededException e) {
        return error(HttpStatus.PAYLOAD_TOO_LARGE, "La foto supera el tamaño maximo de 5 MB.");
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, String>> credenciales(BadCredentialsException e) {
        return error(HttpStatus.UNAUTHORIZED, e.getMessage());
    }

    @ExceptionHandler(LockedException.class)
    public ResponseEntity<Map<String, String>> bloqueado(LockedException e) {
        return error(HttpStatus.LOCKED, e.getMessage());
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<Map<String, String>> inactivo(DisabledException e) {
        return error(HttpStatus.FORBIDDEN, e.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> prohibido(AccessDeniedException e) {
        return error(HttpStatus.FORBIDDEN, "No tiene permisos para realizar esta accion.");
    }

    /**
     * Cualquier otro error: si en el fondo es un RAISE EXCEPTION de un trigger o un
     * CHECK de la base (SQLSTATE 23514) o una clave duplicada (23505), se devuelve 400
     * con el mensaje de la base; lo demas es un 500 generico.
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> otros(Exception e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof PSQLException p && p.getSQLState() != null) {
                if (CHECK_VIOLATION.equals(p.getSQLState())) {
                    return error(HttpStatus.BAD_REQUEST, primeraLinea(p.getServerErrorMessage() != null
                            ? p.getServerErrorMessage().getMessage() : p.getMessage()));
                }
                if (UNIQUE_VIOLATION.equals(p.getSQLState())) {
                    return error(HttpStatus.CONFLICT, "Ya existe un registro con esos datos.");
                }
            }
        }
        log.error("Error no controlado", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "Ocurrio un error inesperado.");
    }

    private static String primeraLinea(String texto) {
        return texto == null ? "" : texto.lines().findFirst().orElse(texto);
    }

    private static ResponseEntity<Map<String, String>> error(HttpStatus estado, String mensaje) {
        return ResponseEntity.status(estado).body(Map.of("mensaje", mensaje == null ? "" : mensaje));
    }
}
