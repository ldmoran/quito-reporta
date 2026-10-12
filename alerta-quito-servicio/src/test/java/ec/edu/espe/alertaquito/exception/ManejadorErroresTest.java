package ec.edu.espe.alertaquito.exception;

import org.junit.jupiter.api.Test;
import org.postgresql.util.PSQLException;
import org.postgresql.util.PSQLState;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.TransactionSystemException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ManejadorErroresTest {

    private final ManejadorErrores manejador = new ManejadorErrores();

    @Test
    void unaViolacionDeCheckDeUnTriggerEsUn400ConElMensajeDeLaBase() {
        var causa = new PSQLException("No se puede resolver el reporte RQ-1 sin evidencia", PSQLState.CHECK_VIOLATION);
        var envuelta = new TransactionSystemException("commit fallido", causa);

        var respuesta = manejador.otros(envuelta);

        assertEquals(HttpStatus.BAD_REQUEST, respuesta.getStatusCode());
        assertTrue(respuesta.getBody().get("mensaje").contains("sin evidencia"));
    }

    @Test
    void unaClaveDuplicadaEsUn409() {
        var causa = new PSQLException("duplicate key", PSQLState.UNIQUE_VIOLATION);

        assertEquals(HttpStatus.CONFLICT, manejador.otros(new RuntimeException(causa)).getStatusCode());
    }

    @Test
    void cualquierOtroErrorEsUn500SinFiltrarDetalles() {
        var respuesta = manejador.otros(new IllegalStateException("secreto interno"));

        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, respuesta.getStatusCode());
        assertEquals("Ocurrio un error inesperado.", respuesta.getBody().get("mensaje"));
    }

    @Test
    void reglaDeNegocioEsUn400YNoEncontradoUn404() {
        assertEquals(HttpStatus.BAD_REQUEST, manejador.reglaNegocio(new ReglaNegocioException("x")).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND, manejador.noEncontrado(new RecursoNoEncontradoException("x")).getStatusCode());
    }
}
