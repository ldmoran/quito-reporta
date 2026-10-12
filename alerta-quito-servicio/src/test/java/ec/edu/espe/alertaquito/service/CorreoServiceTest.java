package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.config.AppProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CorreoServiceTest {

    @Mock ObjectProvider<JavaMailSender> proveedor;
    @Mock JavaMailSender sender;

    private CorreoService servicio(boolean habilitado) {
        return new CorreoService(proveedor, new AppProperties(
                new AppProperties.Jwt("x".repeat(40), 5), new AppProperties.Almacenamiento("./x"),
                new AppProperties.Cors(List.of()),
                new AppProperties.Correo(habilitado, "no-reply@alertaquito.ec", "http://localhost:4200")));
    }

    @Test
    void apagadoNoEnviaNada() {
        boolean enviado = servicio(false).enviarCredenciales("a@x.ec", "Ana", "ana", "Temp1234*");

        assertFalse(enviado);
        verifyNoInteractions(sender);
    }

    @Test
    void habilitadoEnviaUsuarioYClaveTemporalAlDestinatario() {
        when(proveedor.getIfAvailable()).thenReturn(sender);
        when(proveedor.getObject()).thenReturn(sender);

        boolean enviado = servicio(true).enviarCredenciales("ana@quito.ec", "Ana Perez", "ana.perez", "Temp1234*");

        assertTrue(enviado);
        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(captor.capture());
        SimpleMailMessage m = captor.getValue();
        assertArrayEquals(new String[]{"ana@quito.ec"}, m.getTo());
        assertEquals("no-reply@alertaquito.ec", m.getFrom());
        assertTrue(m.getText().contains("ana.perez"));
        assertTrue(m.getText().contains("Temp1234*"));
        assertTrue(m.getText().contains("http://localhost:4200"));
    }

    @Test
    void siElServidorSmtpFallaNoSeLanzaLaExcepcion() {
        when(proveedor.getIfAvailable()).thenReturn(sender);
        when(proveedor.getObject()).thenReturn(sender);
        doThrow(new MailSendException("smtp caido")).when(sender).send(any(SimpleMailMessage.class));

        assertFalse(servicio(true).enviarCredenciales("ana@quito.ec", "Ana", "ana", "Temp1234*"));
    }

    @Test
    void habilitadoPeroSinServidorConfiguradoNoEnvia() {
        when(proveedor.getIfAvailable()).thenReturn(null);

        assertFalse(servicio(true).enviarCredenciales("ana@quito.ec", "Ana", "ana", "Temp1234*"));
    }
}
