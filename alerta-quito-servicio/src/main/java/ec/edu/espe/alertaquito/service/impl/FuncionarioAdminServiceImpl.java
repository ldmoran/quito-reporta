package ec.edu.espe.alertaquito.service.impl;

import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;
import ec.edu.espe.alertaquito.dto.CredencialesTemporalesDTO;
import ec.edu.espe.alertaquito.dto.FuncionarioCreadoDTO;
import ec.edu.espe.alertaquito.dto.FuncionarioDTO;
import ec.edu.espe.alertaquito.dto.RegistrarFuncionarioRequest;
import ec.edu.espe.alertaquito.entity.negocio.Entidad;
import ec.edu.espe.alertaquito.entity.negocio.Funcionario;
import ec.edu.espe.alertaquito.entity.negocio.Usuario;
import ec.edu.espe.alertaquito.entity.seguridad.UsuarioSeguridad;
import ec.edu.espe.alertaquito.exception.RecursoNoEncontradoException;
import ec.edu.espe.alertaquito.repository.negocio.EntidadRepository;
import ec.edu.espe.alertaquito.repository.negocio.FuncionarioRepository;
import ec.edu.espe.alertaquito.repository.negocio.UsuarioRepository;
import ec.edu.espe.alertaquito.service.AuditoriaSesionService;
import ec.edu.espe.alertaquito.service.CorreoService;
import ec.edu.espe.alertaquito.service.FuncionarioAdminService;
import ec.edu.espe.alertaquito.service.UsuarioSeguridadService;
import ec.edu.espe.alertaquito.utils.ClaveTemporal;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

/**
 * Un funcionario vive en DOS bases (usuario en seguridad, designacion en
 * negocio) que no comparten transaccion: se crea primero el usuario y, si la
 * parte de negocio falla, se deshace a mano (compensacion).
 */
@Service
public class FuncionarioAdminServiceImpl implements FuncionarioAdminService {

    private final UsuarioSeguridadService seguridad;
    private final EntidadRepository entidades;
    private final UsuarioRepository usuarios;
    private final FuncionarioRepository funcionarios;
    private final AuditoriaSesionService auditoria;
    private final CorreoService correo;
    private final TransactionTemplate lectura;
    private final TransactionTemplate escritura;

    public FuncionarioAdminServiceImpl(UsuarioSeguridadService seguridad, EntidadRepository entidades,
                                       UsuarioRepository usuarios, FuncionarioRepository funcionarios,
                                       AuditoriaSesionService auditoria, CorreoService correo,
                                       @Qualifier("negocioTransactionManager") PlatformTransactionManager negocioTm) {
        this.seguridad = seguridad;
        this.entidades = entidades;
        this.usuarios = usuarios;
        this.funcionarios = funcionarios;
        this.auditoria = auditoria;
        this.correo = correo;
        this.escritura = new TransactionTemplate(negocioTm);
        this.lectura = new TransactionTemplate(negocioTm);
        this.lectura.setReadOnly(true);
    }

    @Override
    public List<FuncionarioDTO> listar() {
        return lectura.execute(s -> funcionarios.findAllByOrderByIdFuncionarioDesc().stream()
                .map(FuncionarioDTO::desde).toList());
    }

    @Override
    public FuncionarioCreadoDTO registrar(RegistrarFuncionarioRequest datos, UsuarioAutenticado admin) {
        Entidad entidad = lectura.execute(s -> entidades.findById(datos.idEntidad()))
                .filter(e -> "A".equals(e.getEstado()))
                .orElseThrow(() -> new RecursoNoEncontradoException("La entidad no existe o esta inactiva."));

        String clave = datos.password() == null || datos.password().isBlank() ? ClaveTemporal.generar() : datos.password();
        // debeCambiarPassword = true: toda clave puesta por el administrador es temporal.
        UsuarioSeguridad creado = seguridad.crear(datos.nombreCompleto(), datos.cedula(), datos.correo(),
                datos.usuario(), clave, UsuarioAutenticado.FUNCIONARIO, true, admin.usuario());
        FuncionarioDTO dto;
        try {
            dto = escritura.execute(s -> {
                auditoria.marcarNegocio(admin.usuario());
                Usuario ficha = new Usuario();
                ficha.setIdUsuarioSeguridad(creado.getIdUsuario());
                ficha.setUsuario(creado.getUsuario());
                ficha.setNombreCompleto(creado.getNombreCompleto());
                ficha.setCorreo(creado.getCorreo());
                usuarios.save(ficha);

                Funcionario f = new Funcionario();
                f.setUsuario(ficha);
                f.setEntidad(entidades.getReferenceById(entidad.getIdEntidad()));
                f.setCargo(datos.cargo());
                f.setEstado("A");
                funcionarios.saveAndFlush(f);
                return FuncionarioDTO.desde(f);
            });
        } catch (RuntimeException e) {
            seguridad.eliminar(creado.getIdUsuario(), admin.usuario());
            throw e;
        }
        boolean enviado = correo.enviarCredenciales(creado.getCorreo(), creado.getNombreCompleto(), creado.getUsuario(), clave);
        return new FuncionarioCreadoDTO(dto, clave, enviado);
    }

    @Override
    public CredencialesTemporalesDTO restablecerPassword(String usuario, UsuarioAutenticado admin) {
        String clave = ClaveTemporal.generar();
        UsuarioSeguridad u = seguridad.restablecerPassword(usuario, clave, admin.usuario());
        boolean enviado = correo.enviarCredenciales(u.getCorreo(), u.getNombreCompleto(), u.getUsuario(), clave);
        return new CredencialesTemporalesDTO(u.getUsuario(), clave, enviado);
    }

    @Override
    public void darDeBaja(Integer idFuncionario, UsuarioAutenticado admin) {
        Integer idSeguridad = lectura.execute(s -> funcionarios.findById(idFuncionario)
                .orElseThrow(() -> new RecursoNoEncontradoException("Funcionario inexistente."))
                .getUsuario().getIdUsuarioSeguridad());
        // Primero seguridad (corta el acceso), luego la designacion.
        seguridad.cambiarEstado(idSeguridad, false, admin.usuario());
        escritura.executeWithoutResult(s -> {
            auditoria.marcarNegocio(admin.usuario());
            Funcionario f = funcionarios.findById(idFuncionario).orElseThrow();
            f.setEstado("I");
            funcionarios.save(f);
        });
    }

    @Override
    public void desbloquearUsuario(String usuario, UsuarioAutenticado admin) {
        seguridad.desbloquear(usuario, admin.usuario());
    }
}
