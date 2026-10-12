package ec.edu.espe.alertaquito;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class AlertaQuitoApplication {

    public static void main(String[] args) {
        SpringApplication.run(AlertaQuitoApplication.class, args);
    }
}
