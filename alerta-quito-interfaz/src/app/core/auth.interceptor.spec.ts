import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controlador: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controlador = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => controlador.verify());

  function iniciarSesion(): void {
    auth.login('x', 'y').subscribe();
    controlador.expectOne('/api/auth/login').flush({
      idUsuario: 1, usuario: 'x', nombre: 'X', perfiles: ['CIUDAD'], token: 'abc', expiraEnSegundos: 600,
      debeCambiarPassword: false,
    });
  }

  it('agrega el token a las llamadas al API', () => {
    iniciarSesion();
    http.get('/api/reportes/mios').subscribe();

    expect(controlador.expectOne('/api/reportes/mios').request.headers.get('Authorization')).toBe('Bearer abc');
  });

  it('no manda el token a otros servidores', () => {
    iniciarSesion();
    http.get('https://tile.openstreetmap.org/1/1/1.png').subscribe();

    expect(controlador.expectOne('https://tile.openstreetmap.org/1/1/1.png').request.headers.has('Authorization')).toBeFalse();
  });

  it('un 401 cierra la sesión', () => {
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    iniciarSesion();
    http.get('/api/reportes/mios').subscribe({ error: () => undefined });

    controlador.expectOne('/api/reportes/mios').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.autenticado()).toBeFalse();
  });

  it('un 401 en el login NO cierra nada (solo es clave incorrecta)', () => {
    http.post('/api/auth/login', {}).subscribe({ error: () => undefined });

    controlador.expectOne('/api/auth/login').flush({ mensaje: 'x' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.autenticado()).toBeFalse();
  });

  it('un 403 de clave temporal lleva a cambiar la contraseña', () => {
    const navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    iniciarSesion();
    http.get('/api/reportes/bandeja').subscribe({ error: () => undefined });

    controlador
      .expectOne('/api/reportes/bandeja')
      .flush({ codigo: 'CAMBIO_PASSWORD', mensaje: 'x' }, { status: 403, statusText: 'Forbidden' });

    expect(navegar).toHaveBeenCalledWith(['/cambiar-password']);
    expect(auth.autenticado()).toBeTrue();
  });
});
