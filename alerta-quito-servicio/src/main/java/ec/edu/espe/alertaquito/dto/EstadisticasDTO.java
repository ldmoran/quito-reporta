package ec.edu.espe.alertaquito.dto;

import java.util.Map;

public record EstadisticasDTO(long total, Map<String, Long> porEstado, Map<String, Long> porTipo) {
}
