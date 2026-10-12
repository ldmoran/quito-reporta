package ec.edu.espe.alertaquito.exception;

/** Una regla del negocio no se cumple (400). */
public class ReglaNegocioException extends RuntimeException {

    public ReglaNegocioException(String mensaje) {
        super(mensaje);
    }
}
