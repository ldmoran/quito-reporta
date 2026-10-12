package ec.edu.espe.alertaquito.config;

import java.util.HashMap;
import java.util.Map;

/**
 * Propiedades de Hibernate compartidas por las dos bases. Las tablas las
 * crean los scripts SQL (reset_bd.sql / reset_seguridad.sql), asi que
 * Hibernate solo VALIDA que las entidades coincidan con ellas.
 */
final class HibernateProps {

    private HibernateProps() {
    }

    static Map<String, Object> comunes() {
        Map<String, Object> props = new HashMap<>();
        props.put("hibernate.hbm2ddl.auto", "validate");
        props.put("hibernate.physical_naming_strategy",
                "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy");
        return props;
    }
}
