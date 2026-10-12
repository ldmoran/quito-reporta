package ec.edu.espe.alertaquito.utils;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Valida un campo contra {@link PoliticaPassword}. Un valor nulo es valido (usar @NotBlank si es obligatorio). */
@Documented
@Constraint(validatedBy = ClaveSegura.Validador.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface ClaveSegura {

    String message() default PoliticaPassword.RESUMEN;

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validador implements ConstraintValidator<ClaveSegura, String> {
        @Override
        public boolean isValid(String valor, ConstraintValidatorContext contexto) {
            return valor == null || PoliticaPassword.esValida(valor);
        }
    }
}
