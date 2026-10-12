package ec.edu.espe.alertaquito.utils;

import ec.edu.espe.alertaquito.exception.ReglaNegocioException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

class PoliticaPasswordTest {

    @ParameterizedTest
    @ValueSource(strings = {"Clave123*", "Admin123*", "Func123*", "Ciud123*", "Ab1!Ab1!", "Quito-2026#Seguro", "Ñandú9$ñandú"})
    void aceptaClavesQueCumplenTodasLasReglas(String clave) {
        assertTrue(PoliticaPassword.esValida(clave), clave);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "Ab1*", "abcdefg1*", "ABCDEFG1*", "Abcdefgh*", "Abcdefg12", "Abc 1234*"})
    void rechazaClavesQueIncumplenAlgunaRegla(String clave) {
        assertFalse(PoliticaPassword.esValida(clave), clave);
    }

    @Test
    void rechazaNuloYClavesMasLargasQueBcrypt() {
        assertFalse(PoliticaPassword.esValida(null));
        assertFalse(PoliticaPassword.esValida("Aa1*" + "x".repeat(70)));
        assertTrue(PoliticaPassword.esValida("Aa1*" + "x".repeat(68)));   // 72 exactos
    }

    @Test
    void elMensajeDiceExactamenteQueFalta() {
        var faltas = PoliticaPassword.incumplimientos("abc", null);

        assertEquals(4, faltas.size());   // largo, mayuscula, numero, simbolo
        var error = assertThrows(ReglaNegocioException.class, () -> PoliticaPassword.exigir("abc", null));
        assertTrue(error.getMessage().contains("8 y 72 caracteres"));
        assertTrue(error.getMessage().contains("mayúscula"));
        assertTrue(error.getMessage().contains("número"));
        assertTrue(error.getMessage().contains("símbolo"));
    }

    @Test
    void noPermiteQueLaClaveContengaElUsuario() {
        assertFalse(PoliticaPassword.incumplimientos("Maria2026*", "maria").isEmpty());
        assertTrue(PoliticaPassword.incumplimientos("Quito2026*", "maria").isEmpty());
        assertTrue(PoliticaPassword.incumplimientos("Quito2026*", "ab").isEmpty());   // usuarios muy cortos no aplican
    }

    @Test
    void lasClavesTemporalesGeneradasSiemprePasanLaPolitica() {
        for (int i = 0; i < 500; i++) {
            assertTrue(PoliticaPassword.esValida(ClaveTemporal.generar()));
        }
    }
}
