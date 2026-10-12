package ec.edu.espe.alertaquito.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;

import javax.sql.DataSource;

// Base de SEGURIDAD (alerta_quito_seguridad): usuarios, perfiles, intentos de acceso.
// Equivale al servicio externo de seguridad que usaba el SGFDM.
@Configuration
@EnableJpaRepositories(
        basePackages = "ec.edu.espe.alertaquito.repository.seguridad",
        entityManagerFactoryRef = "seguridadEntityManagerFactory",
        transactionManagerRef = "seguridadTransactionManager"
)
public class SeguridadDataSourceConfig {

    @Bean
    @ConfigurationProperties("spring.seguridad-datasource")
    public DataSourceProperties seguridadDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    public DataSource seguridadDataSource() {
        return seguridadDataSourceProperties().initializeDataSourceBuilder().build();
    }

    @Bean(name = "seguridadEntityManagerFactory")
    public LocalContainerEntityManagerFactoryBean seguridadEntityManagerFactory(
            @Qualifier("seguridadDataSource") DataSource dataSource) {

        LocalContainerEntityManagerFactoryBean em = new LocalContainerEntityManagerFactoryBean();
        em.setDataSource(dataSource);
        em.setPackagesToScan("ec.edu.espe.alertaquito.entity.seguridad");
        em.setPersistenceUnitName("seguridad");
        em.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        em.setJpaPropertyMap(HibernateProps.comunes());
        return em;
    }

    @Bean(name = "seguridadTransactionManager")
    public JpaTransactionManager seguridadTransactionManager(
            @Qualifier("seguridadEntityManagerFactory") LocalContainerEntityManagerFactoryBean emf) {
        return new JpaTransactionManager(emf.getObject());
    }
}
