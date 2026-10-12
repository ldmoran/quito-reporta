package ec.edu.espe.alertaquito.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.jdbc.DataSourceProperties;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.LocalContainerEntityManagerFactoryBean;
import org.springframework.orm.jpa.vendor.HibernateJpaVendorAdapter;

import javax.sql.DataSource;

// Base de NEGOCIO (alerta_quito): reportes, entidades, tipos de incidente, funcionarios.
@Configuration
@EnableJpaRepositories(
        basePackages = "ec.edu.espe.alertaquito.repository.negocio",
        entityManagerFactoryRef = "negocioEntityManagerFactory",
        transactionManagerRef = "negocioTransactionManager"
)
public class NegocioDataSourceConfig {

    @Bean
    @Primary
    @ConfigurationProperties("spring.datasource")
    public DataSourceProperties negocioDataSourceProperties() {
        return new DataSourceProperties();
    }

    @Bean
    @Primary
    public DataSource negocioDataSource() {
        return negocioDataSourceProperties().initializeDataSourceBuilder().build();
    }

    @Bean(name = "negocioEntityManagerFactory")
    @Primary
    public LocalContainerEntityManagerFactoryBean negocioEntityManagerFactory(
            @Qualifier("negocioDataSource") DataSource dataSource) {

        LocalContainerEntityManagerFactoryBean em = new LocalContainerEntityManagerFactoryBean();
        em.setDataSource(dataSource);
        em.setPackagesToScan("ec.edu.espe.alertaquito.entity.negocio");
        em.setPersistenceUnitName("negocio");
        em.setJpaVendorAdapter(new HibernateJpaVendorAdapter());
        em.setJpaPropertyMap(HibernateProps.comunes());
        return em;
    }

    @Bean(name = "negocioTransactionManager")
    @Primary
    public JpaTransactionManager negocioTransactionManager(
            @Qualifier("negocioEntityManagerFactory") LocalContainerEntityManagerFactoryBean emf) {
        return new JpaTransactionManager(emf.getObject());
    }
}
