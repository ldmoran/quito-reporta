package ec.edu.espe.alertaquito.utils;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.RepeatedTest;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class ClaveTemporalTest {

    @RepeatedTest(50)
    void siempreCumpleLaPoliticaDeComplejidad() {
        String clave = ClaveTemporal.generar();

        assertEquals(12, clave.length());
        assertTrue(clave.chars().anyMatch(Character::isUpperCase), clave);
        assertTrue(clave.chars().anyMatch(Character::isLowerCase), clave);
        assertTrue(clave.chars().anyMatch(Character::isDigit), clave);
        assertTrue(clave.matches(".*[*#@$%].*"), clave);
        assertFalse(clave.matches(".*[0OIl1].*"), "sin caracteres ambiguos: " + clave);
    }

    @Test
    void noRepiteClaves() {
        Set<String> claves = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            claves.add(ClaveTemporal.generar());
        }
        assertEquals(200, claves.size());
    }

    @Test
    void rechazaLongitudesInseguras() {
        assertThrows(IllegalArgumentException.class, () -> ClaveTemporal.generar(7));
        assertEquals(20, ClaveTemporal.generar(20).length());
    }
}
