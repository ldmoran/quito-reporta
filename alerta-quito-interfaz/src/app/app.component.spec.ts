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

function guardarSesion(perfiles: string[], debeCambiarPassword = false): void {
  sessionStorage.setItem(
    'alerta-quito.sesion',
    JSON.stringify({
      idUsuario: 1, usuario: 'u', nombre: 'Persona Prueba', perfiles, token: 't',
      venceEn: Date.now() + 60_000, debeCambiarPassword,
    }),
  );
}

function opcionesMenu(html: HTMLElement): (string | undefined)[] {
  return Array.from(html.querySelectorAll('.sidebar-link span')).map((s) => s.textContent?.trim());
}

describe('AppComponent', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('sin sesión no dibuja cabecera ni menú (solo las pantallas de acceso)', () => {
    configurar();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;

    expect(html.querySelector('.top-navbar')).toBeNull();
    expect(html.querySelector('.sidebar')).toBeNull();
  });

  it('el ciudadano ve su menú y no el de funcionario ni administración', () => {
    guardarSesion(['CIUDAD']);
    configurar();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const opciones = opcionesMenu(fixture.nativeElement);

    expect(opciones).toContain('Mis reportes');
    expect(opciones).toContain('Nuevo reporte');
    expect(opciones).not.toContain('Bandeja de reportes');
    expect(opciones).not.toContain('Administración');
  });

  it('el administrador ve Mantenimiento, Usuarios y Auditoría y la cabecera con su nombre', () => {
    guardarSesion(['ADMINI']);
    configurar();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    const submenu = Array.from(html.querySelectorAll('.submenu-link span')).map((x) => x.textContent?.trim());

    expect(opcionesMenu(html)).toEqual(jasmine.arrayContaining(['Estadísticas', 'Mantenimiento', 'Usuarios', 'Auditoría']));
    expect(submenu).toEqual(['Entidades', 'Tipos de incidente', 'Funcionarios']);
    expect(opcionesMenu(html)).not.toContain('Nuevo reporte');
    expect(html.querySelector('.top-navbar')?.textContent).toContain('Persona Prueba');
    expect(html.querySelector('.top-navbar')?.textContent).toContain('Administrador');
  });

  it('el grupo Mantenimiento se puede plegar y desplegar', () => {
    guardarSesion(['ADMINI']);
    configurar();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    const boton = html.querySelector('.sidebar-toggle') as HTMLButtonElement;

    boton.click();
    fixture.detectChanges();
    expect(html.querySelectorAll('.submenu-link').length).toBe(0);

    boton.click();
    fixture.detectChanges();
    expect(html.querySelectorAll('.submenu-link').length).toBe(3);
  });

  it('con clave temporal el menú solo ofrece cambiar la contraseña', () => {
    guardarSesion(['FUNCIO'], true);
    configurar();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(opcionesMenu(fixture.nativeElement)).toEqual(['Cambiar contraseña']);
  });

  it('el botón de la cabecera oculta y muestra el menú lateral', () => {
    guardarSesion(['CIUDAD']);
    configurar();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    const boton = html.querySelector('.hamburger-btn') as HTMLButtonElement;
    const estabaOculto = html.querySelector('.sidebar')!.classList.contains('oculta');

    boton.click();
    fixture.detectChanges();

    expect(html.querySelector('.sidebar')!.classList.contains('oculta')).toBe(!estabaOculto);
  });

  it('un resize en celular (barra del navegador) no cierra el menú abierto', () => {
    guardarSesion(['CIUDAD']);
    configurar();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.menuOculto.set(false);

    window.dispatchEvent(new Event('resize'));

    expect(app.menuOculto()).toBeFalse();
  });
});
