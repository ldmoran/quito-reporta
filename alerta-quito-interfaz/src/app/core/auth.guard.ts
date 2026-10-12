import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Perfil } from './modelos';

/** Login y registro: quien ya tiene sesión va directo a su pantalla de inicio. */
export const soloInvitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.autenticado() ? inject(Router).createUrlTree([auth.rutaInicio()]) : true;
};

/** Cualquier persona con sesión (incluso con clave temporal): se usa en "cambiar contraseña". */
export const sesionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.autenticado() ? true : inject(Router).createUrlTree(['/login']);
};

/** Deja pasar solo a quien tenga sesión, ya haya cambiado su clave temporal y tenga alguno de los perfiles. */
export const perfilGuard =
  (...perfiles: Perfil[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.autenticado()) {
      return router.createUrlTree(['/login']);
    }
    if (auth.sesion()?.debeCambiarPassword) {
      return router.createUrlTree(['/cambiar-password']);
    }
    if (perfiles.some((p) => auth.tienePerfil(p))) {
      return true;
    }
    return router.createUrlTree([auth.rutaInicio()]);
  };
