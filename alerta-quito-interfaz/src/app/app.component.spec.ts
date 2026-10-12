import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

function configurar(): void {
  TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
}

function guardarSesion(perfiles: string[]): void {
  sessionStorage.setItem(
    'alerta-quito.sesion',
    JSON.stringify({
      idUsuario: 1, usuario: 'u', nombre: 'Persona Prueba', perfiles, token: 't',
      venceEn: Date.now() + 60_000, debeCambiarPassword: false,
    }),
  );
}

describe('AppComponent', () => {
  beforeEach(() => sessionStorage.clear());

  it('muestra solo la marca cuando no hay sesión', () => {
    configurar();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('.marca')?.textContent).toContain('Alerta Quito');
    expect(html.querySelector('nav')).toBeNull();
  });

  it('el ciudadano ve su menú y no el de funcionario ni administración', () => {
    guardarSesion(['CIUDAD']);
    configurar();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const enlaces = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).map((a) => a.textContent?.trim());

    expect(enlaces).toContain('Nuevo reporte');
    expect(enlaces).toContain('Mis reportes');
    expect(enlaces).not.toContain('Bandeja');
    expect(enlaces).not.toContain('Administración');
  });

  it('el administrador ve la opción Administración', () => {
    guardarSesion(['ADMINI']);
    configurar();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const enlaces = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).map((a) => a.textContent?.trim());

    expect(enlaces).toContain('Administración');
    expect(enlaces).not.toContain('Nuevo reporte');
  });
});
