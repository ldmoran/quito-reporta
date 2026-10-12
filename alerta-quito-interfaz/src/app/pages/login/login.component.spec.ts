import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let http: HttpTestingController;
  let navegar: jasmine.Spy;

  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
  });

  const html = () => fixture.nativeElement as HTMLElement;
  const boton = () => html().querySelector('button[type=submit]') as HTMLButtonElement;

  function escribir(usuario: string, clave: string): void {
    const u = html().querySelector('#usuario') as HTMLInputElement;
    const p = html().querySelector('#password') as HTMLInputElement;
    u.value = usuario;
    u.dispatchEvent(new Event('input'));
    p.value = clave;
    p.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('el botón está deshabilitado mientras falten datos', () => {
    expect(boton().disabled).toBeTrue();
    escribir('ciudadano.demo', 'Ciud123*');
    expect(boton().disabled).toBeFalse();
  });

  it('un login correcto navega a la pantalla de inicio del perfil', () => {
    escribir('ciudadano.demo', 'Ciud123*');
    boton().click();

    http.expectOne('/api/auth/login').flush({
      idUsuario: 4, usuario: 'ciudadano.demo', nombre: 'Ciudadano', perfiles: ['CIUDAD'], token: 't',
      expiraEnSegundos: 600, debeCambiarPassword: false,
    });

    expect(navegar).toHaveBeenCalledWith(['/mis-reportes']);
  });

  it('muestra el mensaje del servidor cuando las credenciales fallan', () => {
    escribir('ciudadano.demo', 'mala');
    boton().click();

    http.expectOne('/api/auth/login').flush({ mensaje: 'Usuario y/o contraseña incorrectos.' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(html().querySelector('[role=alert]')?.textContent).toContain('incorrectos');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('muestra el aviso de bloqueo (423)', () => {
    escribir('ciudadano.demo', 'mala');
    boton().click();

    http.expectOne('/api/auth/login').flush({ mensaje: 'Usuario bloqueado por intentos fallidos. Contacte al administrador.' }, { status: 423, statusText: 'Locked' });
    fixture.detectChanges();

    expect(html().querySelector('[role=alert]')?.textContent).toContain('bloqueado');
  });
});
