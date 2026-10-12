package ec.edu.espe.alertaquito.repository.negocio;

import ec.edu.espe.alertaquito.entity.negocio.EstadoReporte;
import ec.edu.espe.alertaquito.entity.negocio.Reporte;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReporteRepository extends JpaRepository<Reporte, Long> {

    @Query("select r from Reporte r join fetch r.tipoIncidente t join fetch r.ubicacion " +
           "where r.ciudadano.idUsuario = :idCiudadano order by r.fechaCreacion desc")
    List<Reporte> buscarDelCiudadano(@Param("idCiudadano") Integer idCiudadano);

    /** Bandeja del funcionario: reportes derivados a su entidad, emergencias primero. */
    @Query("select r from Reporte r join fetch r.tipoIncidente t join fetch r.ubicacion " +
           "where t.entidad.idEntidad = :idEntidad and r.estado in :estados " +
           "order by r.prioridad asc, r.fechaCreacion asc")
    List<Reporte> buscarDeEntidad(@Param("idEntidad") Integer idEntidad,
                                  @Param("estados") List<EstadoReporte> estados);

    @Query("select r.estado, count(r) from Reporte r group by r.estado")
    List<Object[]> contarPorEstado();

    @Query("select t.nombre, count(r) from Reporte r join r.tipoIncidente t group by t.nombre order by count(r) desc")
    List<Object[]> contarPorTipo();
}
