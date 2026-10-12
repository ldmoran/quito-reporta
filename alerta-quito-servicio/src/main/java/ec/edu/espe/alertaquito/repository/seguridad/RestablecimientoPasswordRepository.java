package ec.edu.espe.alertaquito.repository.seguridad;

import ec.edu.espe.alertaquito.entity.seguridad.RestablecimientoPassword;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface RestablecimientoPasswordRepository extends JpaRepository<RestablecimientoPassword, Long> {

    Optional<RestablecimientoPassword> findByTokenHash(String tokenHash);

    long countByUsuarioIdUsuarioAndFechaCreacionAfter(Integer idUsuario, LocalDateTime desde);

    /** Anula los enlaces pendientes de un usuario (al pedir uno nuevo o al cambiar la clave). */
    @Modifying
    @Query("update RestablecimientoPassword r set r.usado = true where r.usuario.idUsuario = :idUsuario and r.usado = false")
    int anularPendientes(@Param("idUsuario") Integer idUsuario);
}
