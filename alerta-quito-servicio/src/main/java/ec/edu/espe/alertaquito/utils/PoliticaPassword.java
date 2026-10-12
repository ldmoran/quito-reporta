package ec.edu.espe.alertaquito.utils;

import ec.edu.espe.alertaquito.exception.ReglaNegocioException;

import java.util.ArrayList;
import java.util.List;

/**
 * Politica de contrasenas del sistema. Se aplica en el API (autoregistro, funcionarios y cambio
 * de clave) y se replica en las pantallas para avisar mientras la persona escribe:
 *
 * <ul>
 *   <li>entre 8 y 72 caracteres (72 es el limite de bcrypt),</li>
 *   <li>al menos una mayuscula, una minuscula, un numero y un simbolo,</li>
 *   <li>sin espacios,</li>
 *   <li>que no contenga el nombre de usuario.</li>
 * </ul>
 */
public final class PoliticaPassword {

    public static final int MINIMO = 8;
    public static final int MAXIMO = 72;
    public static final String RESUMEN =
            "La contraseña debe tener entre 8 y 72 caracteres, con al menos una mayúscula, una minúscula, "
                    + "un número y un símbolo, y sin espacios.";

    private PoliticaPassword() {
    }

    /** @return la lista de reglas que NO cumple (vacia si la clave es valida) */
    public static List<String> incumplimientos(String password, String usuario) {
        List<String> faltas = new ArrayList<>();
        if (password == null || password.length() < MINIMO || password.length() > MAXIMO) {
            faltas.add("tener entre " + MINIMO + " y " + MAXIMO + " caracteres");
        }
        if (password == null) {
            return faltas;
        }
        if (password.chars().noneMatch(Character::isUpperCase)) {
            faltas.add("incluir una letra mayúscula");
        }
        if (password.chars().noneMatch(Character::isLowerCase)) {
            faltas.add("incluir una letra minúscula");
        }
        if (password.chars().noneMatch(Character::isDigit)) {
            faltas.add("incluir un número");
        }
        if (password.chars().noneMatch(c -> !Character.isLetterOrDigit(c) && !Character.isWhitespace(c))) {
            faltas.add("incluir un símbolo (por ejemplo * # @ $ % !)");
        }
        if (password.chars().anyMatch(Character::isWhitespace)) {
            faltas.add("no tener espacios");
        }
        if (usuario != null && usuario.length() >= 3 && password.toLowerCase().contains(usuario.toLowerCase())) {
            faltas.add("no contener el nombre de usuario");
        }
        return faltas;
    }

    public static boolean esValida(String password) {
        return incumplimientos(password, null).isEmpty();
    }

    /** Lanza ReglaNegocioException (400) con el detalle de lo que falta. */
    public static void exigir(String password, String usuario) {
        List<String> faltas = incumplimientos(password, usuario);
        if (!faltas.isEmpty()) {
            throw new ReglaNegocioException("La contraseña debe " + String.join(", ", faltas) + ".");
        }
    }
}
