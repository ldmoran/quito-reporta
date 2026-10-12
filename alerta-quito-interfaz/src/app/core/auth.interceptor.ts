import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

/** Agrega el JWT a las llamadas al API y cierra la sesión si el servidor responde 401. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const esApi = req.url.startsWith(environment.apiUrl);
  const token = auth.token();

  const peticion = esApi && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(peticion).pipe(
    catchError((error: HttpErrorResponse) => {
      const esLogin = req.url.endsWith('/auth/login');
      if (error.status === 401 && esApi && !esLogin && auth.autenticado()) {
        auth.logout();
      }
      const codigo = (error.error as { codigo?: string } | null)?.codigo;
      if (error.status === 403 && codigo === 'CAMBIO_PASSWORD') {
        void router.navigate(['/cambiar-password']);
      }
      return throwError(() => error);
    }),
  );
};
