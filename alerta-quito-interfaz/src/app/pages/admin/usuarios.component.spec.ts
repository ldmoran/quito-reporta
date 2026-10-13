import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertasService } from '../../core/alertas.service';
import { AlertasFalso } from '../../testing/alertas-falso';
import { UsuariosComponent } from './usuarios.component';

describe('UsuariosComponent', () => {
  let c: UsuariosComponent;
  let http: HttpTestingController;
  let alertas: AlertasFalso;

  beforeEach(async () => {
    alertas = new AlertasFalso();
    await TestBed.configureTestingModule({
      imports: [UsuariosComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AlertasService, useValue: alertas }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(UsuariosComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('no hace nada si no se escribió un usuario', async () => {
    await c.desbloquear();
    await c.restablecer();

    http.expectNone(() => true);
  });

  it('desbloquear avisa con un mensaje breve', async () => {
    c.form.setValue({ usuario: ' ana.perez ' });
    const accion = c.desbloquear();
    http.expectOne('/api/admin/usuarios/ana.perez/desbloquear').flush(null, { status: 204, statusText: 'No Content' });
    await accion;

    expect(alertas.exito).toHaveBeenCalledWith('ana.perez fue desbloqueado.');
  });

  it('un usuario inexistente muestra el error en una ventana', async () => {
    c.form.setValue({ usuario: 'nadie' });
    const accion = c.desbloquear();
    http.expectOne('/api/admin/usuarios/nadie/desbloquear').flush({ mensaje: 'Usuario inexistente: nadie' }, { status: 404, statusText: 'Not Found' });
    await accion;

    expect(alertas.error).toHaveBeenCalledWith('Usuario inexistente: nadie');
  });

  it('restablecer pide confirmación y muestra la clave temporal', async () => {
    c.form.setValue({ usuario: 'ana.perez' });
    const accion = c.restablecer();
    await Promise.resolve();
    http.expectOne('/api/admin/usuarios/ana.perez/restablecer-password').flush({ usuario: 'ana.perez', passwordTemporal: 'Otra#98765xy', correoEnviado: false });
    await accion;

    expect(alertas.confirmar).toHaveBeenCalled();
    expect(alertas.credencial).toHaveBeenCalledWith({ usuario: 'ana.perez', clave: 'Otra#98765xy', correoEnviado: false });
  });

  it('si no confirma no restablece', async () => {
    alertas.confirmacion = false;
    c.form.setValue({ usuario: 'ana.perez' });
    await c.restablecer();

    http.expectNone(() => true);
  });
});
