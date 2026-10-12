package ec.edu.espe.alertaquito.repository.negocio;

import ec.edu.espe.alertaquito.entity.negocio.Funcionario;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FuncionarioRepository extends JpaRepository<Funcionario, Integer> {

    Optional<Funcionario> findByUsuarioIdUsuarioAndEstado(Integer idUsuario, String estado);

    List<Funcionario> findAllByOrderByIdFuncionarioDesc();

    long countByEntidadIdEntidadAndEstado(Integer idEntidad, String estado);
}
