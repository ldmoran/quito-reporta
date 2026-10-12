package ec.edu.espe.alertaquito.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;

/**
 * La app se conecta a Postgres con un unico usuario tecnico, asi que los
 * triggers de historial/auditoria no saben que persona hizo el cambio. Antes
 * de guardar, este servicio ejecuta set_config('app.usuario', login, true)
 * en la MISMA transaccion y los triggers lo leen con fn_usuario_sesion().
 * Es el equivalente de DBMS_SESSION.SET_IDENTIFIER del SGFDM (Oracle).
 *
 * Debe llamarse dentro de una transaccion de la base correspondiente.
 */
@Service
public class AuditoriaSesionService {

    private static final String SQL = "select set_config('app.usuario', :usuario, true)";

    @PersistenceContext(unitName = "negocio")
    private EntityManager negocio;

    @PersistenceContext(unitName = "seguridad")
    private EntityManager seguridad;

    public void marcarNegocio(String usuario) {
        negocio.createNativeQuery(SQL).setParameter("usuario", usuario).getSingleResult();
    }

    public void marcarSeguridad(String usuario) {
        seguridad.createNativeQuery(SQL).setParameter("usuario", usuario).getSingleResult();
    }
}
