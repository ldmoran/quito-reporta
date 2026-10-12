package ec.edu.espe.alertaquito.auth.security;

import java.util.Set;

/**
 * Principal que viaja en el JWT y en el SecurityContext.
 *
 * @param idUsuario          id de la ficha en la base de negocio
 * @param idUsuarioSeguridad id en la base de seguridad
 * @param perfiles           codigos de perfil (CIUDAD, FUNCIO, ADMINI)
 * @param debeCambiarPassword la clave la puso el administrador y debe cambiarse antes de usar el sistema
 */
public record UsuarioAutenticado(Integer idUsuario, Integer idUsuarioSeguridad, String usuario,
                                 String nombre, Set<String> perfiles, boolean debeCambiarPassword) {

    public static final String CIUDADANO = "CIUDAD";
    public static final String FUNCIONARIO = "FUNCIO";
    public static final String ADMINISTRADOR = "ADMINI";

    public UsuarioAutenticado conPasswordCambiada() {
        return new UsuarioAutenticado(idUsuario, idUsuarioSeguridad, usuario, nombre, perfiles, false);
    }

    public boolean tienePerfil(String codigo) {
        return perfiles.contains(codigo);
    }
}
