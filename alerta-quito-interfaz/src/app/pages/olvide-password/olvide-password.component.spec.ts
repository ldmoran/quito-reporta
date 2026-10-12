import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OlvidePasswordComponent } from './olvide-password.component';

describe('OlvidePasswordComponent', () => {
  let fixture: ComponentFixture<OlvidePasswordComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OlvidePasswordComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OlvidePasswordComponent);
    fixture.detectChanges();
  });

  const html = () => fixture.nativeElement as HTMLElement;
  const boton = () => html().querySelector('button[type=submit]') as HTMLButtonElement;
  function escribir(valor: string): void {
    const input = html().querySelector('#identificador') as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('no deja enviar vacío', () => {
    expect(boton().disabled).toBeTrue();
  });

  it('envía el usuario o correo y muestra la confirmación genérica', () => {
    escribir('  ana@quito.ec ');
    boton().click();

    const req = http.expectOne('/api/auth/olvide-password');
    expect(req.request.body).toEqual({ identificador: 'ana@quito.ec' });
    req.flush({ mensaje: 'Si la cuenta existe, enviamos un correo con las instrucciones.' });
    fixture.detectChanges();

    expect(html().querySelector('[role=status]')?.textContent).toContain('Si la cuenta existe');
    expect(html().querySelector('form')).toBeNull();
  });

  it('si falla la conexión avisa y deja reintentar', () => {
    escribir('ana');
    boton().click();
    http.expectOne('/api/auth/olvide-password').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(html().querySelector('[role=alert]')?.textContent).toContain('conexión');
    expect(html().querySelector('form')).not.toBeNull();
  });
});
