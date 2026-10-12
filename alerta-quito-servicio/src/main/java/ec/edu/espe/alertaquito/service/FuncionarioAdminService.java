package ec.edu.espe.alertaquito.service;

import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;
import ec.edu.espe.alertaquito.dto.CredencialesTemporalesDTO;
import ec.edu.espe.alertaquito.dto.FuncionarioCreadoDTO;
import ec.edu.espe.alertaquito.dto.FuncionarioDTO;
import ec.edu.espe.alertaquito.dto.RegistrarFuncionarioRequest;

import java.util.List;

public interface FuncionarioAdminService {

    List<FuncionarioDTO> listar();

    /** RF-02: el administrador crea el usuario (base de seguridad) y lo designa a una entidad (base de negocio). */
    FuncionarioCreadoDTO registrar(RegistrarFuncionarioRequest datos, UsuarioAutenticado administrador);

    /** Corrige nombre, cedula, correo, cargo o entidad. El nombre de usuario no cambia. */
    FuncionarioDTO actualizar(Integer idFuncionario, ec.edu.espe.alertaquito.dto.ActualizarFuncionarioRequest datos,
                              UsuarioAutenticado administrador);

    /** Da de baja al funcionario: queda inactivo y ya no puede iniciar sesion. */
    void darDeBaja(Integer idFuncionario, UsuarioAutenticado administrador);

    /** Vuelve a dar de alta a un funcionario dado de baja (su entidad debe estar activa). */
    FuncionarioDTO darDeAlta(Integer idFuncionario, UsuarioAutenticado administrador);

    void desbloquearUsuario(String usuario, UsuarioAutenticado administrador);

    /** Olvido de clave: genera una temporal, obliga a cambiarla y la envia por correo si esta habilitado. */
    CredencialesTemporalesDTO restablecerPassword(String usuario, UsuarioAutenticado administrador);
}
