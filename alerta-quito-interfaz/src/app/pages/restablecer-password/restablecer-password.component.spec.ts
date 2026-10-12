import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RestablecerPasswordComponent } from './restablecer-password.component';

describe('RestablecerPasswordComponent', () => {
  let fixture: ComponentFixture<RestablecerPasswordComponent>;
  let c: RestablecerPasswordComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RestablecerPasswordComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RestablecerPasswordComponent);
    c = fixture.componentInstance;
  });

  afterEach(() => http.verify());

  const html = () => fixture.nativeElement as HTMLElement;

  it('sin token en la URL explica que el enlace no es válido', () => {
    c.token = '';
    fixture.detectChanges();

    expect(html().querySelector('[role=alert]')?.textContent).toContain('no es válido');
    expect(html().querySelector('form')).toBeNull();
  });

  it('no permite una clave débil ni que no coincidan', () => {
    c.token = 'tok';
    fixture.detectChanges();

    c.form.setValue({ passwordNueva: 'debil', repetir: 'debil' });
    expect(c.form.invalid).toBeTrue();
    c.form.setValue({ passwordNueva: 'NuevaClave2026*', repetir: 'Otra' });
    expect(c.form.hasError('noCoinciden')).toBeTrue();
    c.form.setValue({ passwordNueva: 'NuevaClave2026*', repetir: 'NuevaClave2026*' });
    expect(c.form.valid).toBeTrue();
  });

  it('envía el token con la clave nueva y muestra el éxito', () => {
    c.token = 'tok-del-correo';
    fixture.detectChanges();
    c.form.setValue({ passwordNueva: 'NuevaClave2026*', repetir: 'NuevaClave2026*' });
    c.guardar();

    const req = http.expectOne('/api/auth/restablecer-password');
    expect(req.request.body).toEqual({ token: 'tok-del-correo', passwordNueva: 'NuevaClave2026*' });
    req.flush({ mensaje: 'Contraseña actualizada. Ya puede iniciar sesión.' });
    fixture.detectChanges();

    expect(html().querySelector('[role=status]')?.textContent).toContain('Contraseña actualizada');
    expect(html().querySelector('a[href="/login"]')).not.toBeNull();
  });

  it('un enlace vencido muestra el motivo y ofrece pedir otro', () => {
    c.token = 'viejo';
    fixture.detectChanges();
    c.form.setValue({ passwordNueva: 'NuevaClave2026*', repetir: 'NuevaClave2026*' });
    c.guardar();
    http.expectOne('/api/auth/restablecer-password').flush(
      { mensaje: 'El enlace no es válido o ya venció. Solicite uno nuevo.' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();

    expect(html().querySelector('[role=alert]')?.textContent).toContain('ya venció');
    expect(html().querySelector('a[href="/olvide-password"]')).not.toBeNull();
  });
});
