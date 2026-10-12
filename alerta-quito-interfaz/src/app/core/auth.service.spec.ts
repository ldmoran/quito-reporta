import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { RespuestaAuth } from './modelos';

const respuesta = (perfiles: RespuestaAuth['perfiles'], debeCambiar = false): RespuestaAuth => ({
  idUsuario: 7,
  usuario: 'func.epmmop',
  nombre: 'Funcionario EPMMOP',
  perfiles,
  token: 'jwt-de-prueba',
  expiraEnSegundos: 3600,
  debeCambiarPassword: debeCambiar,
});

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('no tiene sesión al inicio', () => {
    expect(auth.autenticado()).toBeFalse();
    expect(auth.token()).toBeNull();
  });

  it('login guarda la sesión, el token y los perfiles', () => {
    auth.login('func.epmmop', 'Func123*').subscribe();
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ usuario: 'func.epmmop', password: 'Func123*' });
    req.flush(respuesta(['FUNCIO']));

    expect(auth.autenticado()).toBeTrue();
    expect(auth.token()).toBe('jwt-de-prueba');
    expect(auth.tienePerfil('FUNCIO')).toBeTrue();
    expect(auth.tienePerfil('ADMINI')).toBeFalse();
    expect(sessionStorage.getItem('alerta-quito.sesion')).toContain('jwt-de-prueba');
  });

  it('la pantalla de inicio depende del perfil', () => {
    auth.login('x', 'y').subscribe();
    http.expectOne('/api/auth/login').flush(respuesta(['ADMINI']));
    expect(auth.rutaInicio()).toBe('/admin');

    auth.login('x', 'y').subscribe();
    http.expectOne('/api/auth/login').flush(respuesta(['FUNCIO']));
    expect(auth.rutaInicio()).toBe('/bandeja');

    auth.login('x', 'y').subscribe();
    http.expectOne('/api/auth/login').flush(respuesta(['CIUDAD']));
    expect(auth.rutaInicio()).toBe('/mis-reportes');
  });

  it('con clave temporal siempre manda a cambiar la contraseña', () => {
    auth.login('x', 'y').subscribe();
    http.expectOne('/api/auth/login').flush(respuesta(['FUNCIO'], true));

    expect(auth.sesion()?.debeCambiarPassword).toBeTrue();
    expect(auth.rutaInicio()).toBe('/cambiar-password');
  });

  it('cambiarPassword reemplaza la sesión por la nueva, sin la marca de clave temporal', () => {
    auth.login('x', 'y').subscribe();
    http.expectOne('/api/auth/login').flush(respuesta(['FUNCIO'], true));

    auth.cambiarPassword('temporal', 'NuevaClave123*').subscribe();
    const req = http.expectOne('/api/auth/cambiar-password');
    expect(req.request.body).toEqual({ passwordActual: 'temporal', passwordNueva: 'NuevaClave123*' });
    req.flush({ ...respuesta(['FUNCIO'], false), token: 'jwt-nuevo' });

    expect(auth.token()).toBe('jwt-nuevo');
    expect(auth.sesion()?.debeCambiarPassword).toBeFalse();
    expect(auth.rutaInicio()).toBe('/bandeja');
  });

  it('logout borra la sesión y vuelve al login', () => {
    const router = TestBed.inject(Router);
    const navegar = spyOn(router, 'navigate').and.resolveTo(true);
    auth.login('x', 'y').subscribe();
    http.expectOne('/api/auth/login').flush(respuesta(['CIUDAD']));

    auth.logout();

    expect(auth.autenticado()).toBeFalse();
    expect(sessionStorage.getItem('alerta-quito.sesion')).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/login']);
  });

  it('ignora una sesión guardada que ya venció', () => {
    sessionStorage.setItem(
      'alerta-quito.sesion',
      JSON.stringify({ ...respuesta(['CIUDAD']), venceEn: Date.now() - 1000 }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });

    expect(TestBed.inject(AuthService).autenticado()).toBeFalse();
  });
});
