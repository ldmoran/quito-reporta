package ec.edu.espe.alertaquito.utils;

import java.security.SecureRandom;

/** Genera contrasenas temporales legibles: sin caracteres ambiguos (0/O, 1/l/I) y siempre con mayuscula, minuscula, numero y simbolo. */
public final class ClaveTemporal {

    private static final String MAYUSCULAS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private static final String MINUSCULAS = "abcdefghijkmnpqrstuvwxyz";
    private static final String NUMEROS = "23456789";
    private static final String SIMBOLOS = "*#@$%";
    private static final String TODOS = MAYUSCULAS + MINUSCULAS + NUMEROS + SIMBOLOS;
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private ClaveTemporal() {
    }

    public static String generar() {
        return generar(12);
    }

    public static String generar(int longitud) {
        if (longitud < 8) {
            throw new IllegalArgumentException("La clave temporal debe tener al menos 8 caracteres");
        }
        char[] clave = new char[longitud];
        clave[0] = elegir(MAYUSCULAS);
        clave[1] = elegir(MINUSCULAS);
        clave[2] = elegir(NUMEROS);
        clave[3] = elegir(SIMBOLOS);
        for (int i = 4; i < longitud; i++) {
            clave[i] = elegir(TODOS);
        }
        for (int i = longitud - 1; i > 0; i--) {   // Fisher-Yates: no dejar las categorias al inicio
            int j = ALEATORIO.nextInt(i + 1);
            char t = clave[i];
            clave[i] = clave[j];
            clave[j] = t;
        }
        return new String(clave);
    }

    private static char elegir(String conjunto) {
        return conjunto.charAt(ALEATORIO.nextInt(conjunto.length()));
    }
}
