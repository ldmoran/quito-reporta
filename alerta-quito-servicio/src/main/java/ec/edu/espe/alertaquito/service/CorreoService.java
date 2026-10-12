package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

/**
 * Envio de credenciales por correo. Apagado por defecto (app.correo.habilitado=false):
 * en desarrollo se usa Mailpit (docker-compose) y en produccion un SMTP real.
 * Un fallo al enviar NUNCA tumba la operacion: se registra y devuelve false para
 * que el administrador entregue la clave por otro medio.
 */
@Service
public class CorreoService {

    private static final Logger log = LoggerFactory.getLogger(CorreoService.class);

    private final ObjectProvider<JavaMailSender> sender;
    private final AppProperties.Correo config;

    public CorreoService(ObjectProvider<JavaMailSender> sender, AppProperties props) {
        this.sender = sender;
        this.config = props.correo();
    }

    public boolean habilitado() {
        return config.habilitado() && sender.getIfAvailable() != null;
    }

    /** Enlace para elegir una clave nueva ("olvide mi contrasena"). */
    public boolean enviarRestablecimiento(String destino, String nombre, String usuario, String enlace, int minutos) {
        if (!habilitado()) {
            log.warn("Correo deshabilitado: no se envio el enlace de restablecimiento a {}", destino);
            return false;
        }
        SimpleMailMessage mensaje = new SimpleMailMessage();
        mensaje.setFrom(config.remitente());
        mensaje.setTo(destino);
        mensaje.setSubject("Alerta Quito: restablecer su contraseña");
        mensaje.setText("""
                Hola %s,

                Recibimos una solicitud para restablecer la contraseña del usuario %s.
                Para elegir una nueva abra este enlace (vence en %d minutos y sirve una sola vez):

                %s

                Si usted no lo solicitó, ignore este mensaje: su contraseña actual no cambia.
                """.formatted(nombre, usuario, minutos, enlace));
        try {
            sender.getObject().send(mensaje);
            return true;
        } catch (RuntimeException e) {
            log.warn("No se pudo enviar el enlace de restablecimiento a {}: {}", destino, e.getMessage());
            return false;
        }
    }

    /** @return true si el correo salio hacia el servidor SMTP */
    public boolean enviarCredenciales(String destino, String nombre, String usuario, String claveTemporal) {
        if (!habilitado()) {
            return false;
        }
        SimpleMailMessage mensaje = new SimpleMailMessage();
        mensaje.setFrom(config.remitente());
        mensaje.setTo(destino);
        mensaje.setSubject("Alerta Quito: sus credenciales de acceso");
        mensaje.setText("""
                Hola %s,

                El administrador de Alerta Quito creo o restablecio su acceso.

                Sistema:        %s
                Usuario:        %s
                Clave temporal: %s

                Por seguridad, el sistema le pedira cambiar esta clave en su primer ingreso.
                Si no esperaba este mensaje, ignorelo y avise al administrador.
                """.formatted(nombre, config.urlSistema(), usuario, claveTemporal));
        try {
            sender.getObject().send(mensaje);
            return true;
        } catch (RuntimeException e) {
            log.warn("No se pudo enviar el correo de credenciales a {}: {}", destino, e.getMessage());
            return false;
        }
    }
}
