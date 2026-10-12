package ec.edu.espe.alertaquito.auth.service;

import ec.edu.espe.alertaquito.auth.security.UsuarioAutenticado;

public interface AuthService {

    /** Valida usuario y clave contra la base de seguridad. Lanza AuthenticationException si falla. */
    UsuarioAutenticado autenticar(String usuario, String password);
}
