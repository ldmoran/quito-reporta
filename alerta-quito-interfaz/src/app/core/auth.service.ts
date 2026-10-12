import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Perfil, RegistroCiudadano, RespuestaAuth, Sesion } from './modelos';

const CLAVE = 'alerta-quito.sesion';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _sesion = signal<Sesion | null>(this.leer());

  readonly sesion = this._sesion.asReadonly();
  readonly autenticado = computed(() => this._sesion() !== null);

  login(usuario: string, password: string): Observable<RespuestaAuth> {
    return this.http
      .post<RespuestaAuth>(`${environment.apiUrl}/auth/login`, { usuario, password })
      .pipe(tap((r) => this.guardar(r)));
  }

  /** Devuelve un token nuevo, ya sin la marca de clave temporal. */
  cambiarPassword(passwordActual: string, passwordNueva: string): Observable<RespuestaAuth> {
    return this.http
      .post<RespuestaAuth>(`${environment.apiUrl}/auth/cambiar-password`, { passwordActual, passwordNueva })
      .pipe(tap((r) => this.guardar(r)));
  }

  /** "Olvide mi contraseña": la respuesta es siempre la misma exista o no la cuenta. */
  olvidePassword(identificador: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${environment.apiUrl}/auth/olvide-password`, { identificador });
  }

  /** Fija una clave nueva con el token del enlace recibido por correo. */
  restablecerPassword(token: string, passwordNueva: string): Observable<{ mensaje: string }> {
    return this.http.post<{ mensaje: string }>(`${environment.apiUrl}/auth/restablecer-password`, { token, passwordNueva });
  }

  registrar(datos: RegistroCiudadano): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/auth/registro`, datos);
  }

  logout(): void {
    this._sesion.set(null);
    try {
      sessionStorage.removeItem(CLAVE);
    } catch {
      /* sin almacenamiento disponible */
    }
    void this.router.navigate(['/login']);
  }

  token(): string | null {
    return this._sesion()?.token ?? null;
  }

  tienePerfil(perfil: Perfil): boolean {
    return this._sesion()?.perfiles.includes(perfil) ?? false;
  }

  /** Pantalla de inicio según el perfil de la persona. */
  rutaInicio(): string {
    if (this._sesion()?.debeCambiarPassword) return '/cambiar-password';
    if (this.tienePerfil('ADMINI')) return '/admin/estadisticas';
    if (this.tienePerfil('FUNCIO')) return '/bandeja';
    return '/mis-reportes';
  }

  private guardar(r: RespuestaAuth): void {
    const sesion: Sesion = {
      idUsuario: r.idUsuario,
      usuario: r.usuario,
      nombre: r.nombre,
      perfiles: r.perfiles,
      token: r.token,
      venceEn: Date.now() + r.expiraEnSegundos * 1000,
      debeCambiarPassword: r.debeCambiarPassword,
    };
    this._sesion.set(sesion);
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify(sesion));
    } catch {
      /* la sesion vive solo en memoria */
    }
  }

  private leer(): Sesion | null {
    try {
      const crudo = sessionStorage.getItem(CLAVE);
      if (!crudo) return null;
      const sesion = JSON.parse(crudo) as Sesion;
      return sesion.venceEn > Date.now() ? sesion : null;
    } catch {
      return null;
    }
  }
}
