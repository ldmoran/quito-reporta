package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.dto.AuditoriaDTO;
import ec.edu.espe.alertaquito.exception.ReglaNegocioException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;

/**
 * Consulta de solo lectura de la tabla AUDITORIA de las dos bases (negocio y seguridad), que alimentan
 * los triggers. Como en el SGFDM, la pantalla es de consulta rapida: muestra solo los ultimos
 * TAMANO_PAGINA * MAX_PAGINAS registros que cumplen el filtro; el historial completo queda en la base.
 */
@Service
public class AuditoriaService {

    public static final int TAMANO_PAGINA = 20;
    public static final int MAX_PAGINAS = 5;
    private static final int MAX_FILAS = TAMANO_PAGINA * MAX_PAGINAS;

    /** Tabla auditada -> [tabla de historial, columna con el id del registro]. Lista blanca: nada del usuario va al SQL. */
    private static final Map<String, String[]> HISTORIALES = Map.of(
            "NEGOCIO/ENTIDAD", new String[]{"entidad_hist", "id_entidad"},
            "NEGOCIO/TIPO_INCIDENTE", new String[]{"tipo_incidente_hist", "id_tipo_incidente"},
            "NEGOCIO/FUNCIONARIO", new String[]{"funcionario_hist", "id_funcionario"},
            "SEGURIDAD/USUARIO", new String[]{"usuario_hist", "id_usuario"},
            "SEGURIDAD/PERFIL", new String[]{"perfil_hist", "id_perfil"});

    private static final String SELECT = """
            SELECT id_auditoria, nombre_tabla, CAST(id_registro AS VARCHAR) AS id_registro, accion,
                   usuario_accion, fecha_accion, descripcion
              FROM auditoria
             WHERE (CAST(:tabla AS VARCHAR) IS NULL OR nombre_tabla = CAST(:tabla AS VARCHAR))
               AND (CAST(:accion AS VARCHAR) IS NULL OR accion = CAST(:accion AS VARCHAR))
               AND (CAST(:usuario AS VARCHAR) IS NULL OR LOWER(usuario_accion) LIKE LOWER(CAST(:usuario AS VARCHAR)))
             ORDER BY fecha_accion DESC, id_auditoria DESC
             LIMIT :limite
            """;

    private final NamedParameterJdbcTemplate negocio;
    private final NamedParameterJdbcTemplate seguridad;

    public AuditoriaService(@Qualifier("negocioDataSource") DataSource negocio,
                            @Qualifier("seguridadDataSource") DataSource seguridad) {
        this.negocio = new NamedParameterJdbcTemplate(negocio);
        this.seguridad = new NamedParameterJdbcTemplate(seguridad);
    }

    public AuditoriaDTO.Pagina buscar(String tabla, String accion, String usuario, int pagina) {
        String filtroTabla = vacioANull(tabla);
        String filtroAccion = vacioANull(accion);
        if (filtroAccion != null && !List.of("INSERT", "UPDATE", "DELETE").contains(filtroAccion)) {
            throw new ReglaNegocioException("Accion invalida: use INSERT, UPDATE o DELETE.");
        }
        String filtroUsuario = vacioANull(usuario) == null ? null : "%" + usuario.trim().replace("%", "") + "%";

        List<AuditoriaDTO> todas = new ArrayList<>();
        todas.addAll(consultar(negocio, "NEGOCIO", filtroTabla, filtroAccion, filtroUsuario));
        todas.addAll(consultar(seguridad, "SEGURIDAD", filtroTabla, filtroAccion, filtroUsuario));
        todas.sort(Comparator.comparing(AuditoriaDTO::fecha).reversed().thenComparing(AuditoriaDTO::id, Comparator.reverseOrder()));
        List<AuditoriaDTO> recientes = todas.size() > MAX_FILAS ? todas.subList(0, MAX_FILAS) : todas;

        int paginaSegura = Math.max(0, Math.min(pagina, MAX_PAGINAS - 1));
        int desde = Math.min(paginaSegura * TAMANO_PAGINA, recientes.size());
        int hasta = Math.min(desde + TAMANO_PAGINA, recientes.size());
        int totalPaginas = Math.max(1, (int) Math.ceil(recientes.size() / (double) TAMANO_PAGINA));
        return new AuditoriaDTO.Pagina(List.copyOf(recientes.subList(desde, hasta)), paginaSegura, totalPaginas,
                recientes.size(), tablasAuditadas());
    }

    /**
     * Las copias sucesivas de un registro (antes/despues de cada cambio), para ver QUE cambio y no solo
     * QUIEN lo hizo. Ej.: origen NEGOCIO, tabla ENTIDAD, id 3.
     */
    public List<Map<String, Object>> historial(String origen, String tabla, String idRegistro) {
        String[] destino = HISTORIALES.get((origen + "/" + tabla).toUpperCase());
        if (destino == null) {
            throw new ReglaNegocioException("Esa tabla no tiene historial de cambios.");
        }
        int id;
        try {
            id = Integer.parseInt(idRegistro);
        } catch (NumberFormatException e) {
            throw new ReglaNegocioException("Identificador de registro invalido.");
        }
        NamedParameterJdbcTemplate plantilla = "SEGURIDAD".equalsIgnoreCase(origen) ? seguridad : negocio;
        // destino[0] y destino[1] salen de la lista blanca de arriba, nunca del usuario.
        List<Map<String, Object>> filas = plantilla.queryForList(
                "SELECT * FROM " + destino[0] + " WHERE " + destino[1] + " = :id ORDER BY id_hist",
                new MapSqlParameterSource("id", id));
        List<Map<String, Object>> resultado = new ArrayList<>();
        for (Map<String, Object> fila : filas) {
            resultado.add(new LinkedHashMap<>(fila));
        }
        return resultado;
    }

    private List<AuditoriaDTO> consultar(NamedParameterJdbcTemplate plantilla, String origen, String tabla, String accion, String usuario) {
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("tabla", tabla).addValue("accion", accion).addValue("usuario", usuario)
                .addValue("limite", MAX_FILAS);
        return plantilla.query(SELECT, p, (rs, n) -> new AuditoriaDTO(origen, rs.getLong("id_auditoria"),
                rs.getString("nombre_tabla"), rs.getString("id_registro"), rs.getString("accion"),
                rs.getString("usuario_accion"), rs.getTimestamp("fecha_accion").toLocalDateTime(),
                rs.getString("descripcion")));
    }

    private List<String> tablasAuditadas() {
        TreeSet<String> nombres = new TreeSet<>();
        nombres.addAll(negocio.getJdbcTemplate().queryForList("SELECT DISTINCT nombre_tabla FROM auditoria", String.class));
        nombres.addAll(seguridad.getJdbcTemplate().queryForList("SELECT DISTINCT nombre_tabla FROM auditoria", String.class));
        return List.copyOf(nombres);
    }

    private String vacioANull(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }
}
