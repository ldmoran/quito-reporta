import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertasService } from '../../core/alertas.service';
import { AlertasFalso } from '../../testing/alertas-falso';
import { EntidadAdmin } from '../../core/modelos';
import { EntidadesComponent } from './entidades.component';

const entidad = (extra: Partial<EntidadAdmin> = {}): EntidadAdmin => ({
  id: 1, codigo: 'EPMMOP', nombre: 'Empresa Publica', descripcion: 'Calles', estado: 'A', tiposActivos: 3, funcionariosActivos: 1, ...extra,
});

describe('EntidadesComponent (mantenimiento con ventanas emergentes)', () => {
  let fixture: ComponentFixture<EntidadesComponent>;
  let c: EntidadesComponent;
  let http: HttpTestingController;
  let alertas: AlertasFalso;

  beforeEach(async () => {
    alertas = new AlertasFalso();
    await TestBed.configureTestingModule({
      imports: [EntidadesComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AlertasService, useValue: alertas }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EntidadesComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/admin/mantenimiento/entidades').flush([entidad(), entidad({ id: 2, codigo: 'OLD', nombre: 'Antigua', estado: 'I', tiposActivos: 0, funcionariosActivos: 0 })]);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const recarga = () => http.expectOne('/api/admin/mantenimiento/entidades').flush([]);

  it('muestra cuántos tipos y funcionarios dependen de cada entidad', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('EPMMOP');
    expect(texto).toContain('Tipos activos');
    expect(c.visibles().length).toBe(2);
  });

  it('Nueva entidad define el formulario con el código en mayúsculas y lo envía con POST', async () => {
    alertas.valores = { codigo: 'ECU911', nombre: 'Servicio Integrado', descripcion: '' };
    const accion = c.nueva();

    const campo = alertas.ultimoFormulario!.campos[0];
    expect(campo.mayusculas).toBeTrue();
    expect(campo.patron!.test('AB_1')).toBeTrue();
    expect(campo.patron!.test('mal codigo!')).toBeFalse();
    expect(campo.patron!.test('A')).toBeFalse();

    const req = http.expectOne('/api/admin/mantenimiento/entidades');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ codigo: 'ECU911', nombre: 'Servicio Integrado', descripcion: '' });
    req.flush(entidad({ id: 9, codigo: 'ECU911' }));
    await accion;
    recarga();

    expect(alertas.exito).toHaveBeenCalledWith('La entidad ECU911 fue creada.');
  });

  it('Editar precarga los datos y guarda con PUT', async () => {
    alertas.valores = { codigo: 'EPMMOP', nombre: 'Nuevo nombre', descripcion: 'Calles' };
    const accion = c.editar(entidad());

    expect(alertas.ultimoFormulario!.campos.find((x) => x.nombre === 'nombre')!.valor).toBe('Empresa Publica');
    const req = http.expectOne('/api/admin/mantenimiento/entidades/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.nombre).toBe('Nuevo nombre');
    req.flush(entidad({ nombre: 'Nuevo nombre' }));
    await accion;
    recarga();

    expect(alertas.exito).toHaveBeenCalledWith('La entidad EPMMOP fue actualizada.');
  });

  it('cancelar el formulario no envía nada', async () => {
    alertas.valores = null;
    await c.nueva();
    await c.editar(entidad());

    http.expectNone((r) => r.url.includes('/entidades/') || r.method === 'POST');
  });

  it('desactivar pide confirmación de peligro y activar no; ambos usan PATCH', async () => {
    let accion = c.cambiarEstado(entidad(), false);
    await Promise.resolve();
    expect(alertas.confirmar.calls.mostRecent().args[0].peligro).toBeTrue();
    let req = http.expectOne('/api/admin/mantenimiento/entidades/1/estado');
    expect(req.request.body).toEqual({ activo: false });
    req.flush(entidad({ estado: 'I' }));
    await Promise.resolve();
    await accion;
    recarga();
    expect(alertas.exito).toHaveBeenCalledWith('La entidad EPMMOP fue desactivada.');

    accion = c.cambiarEstado(entidad({ id: 2, codigo: 'OLD', estado: 'I' }), true);
    await Promise.resolve();
    expect(alertas.confirmar.calls.mostRecent().args[0].peligro).toBeFalse();
    req = http.expectOne('/api/admin/mantenimiento/entidades/2/estado');
    expect(req.request.body).toEqual({ activo: true });
    req.flush(entidad({ id: 2, codigo: 'OLD' }));
    await Promise.resolve();
    await accion;
    recarga();
  });

  it('si el servidor lo impide (tiene tipos activos) muestra el motivo en una ventana de error', async () => {
    const accion = c.cambiarEstado(entidad(), false);
    await Promise.resolve();
    http.expectOne('/api/admin/mantenimiento/entidades/1/estado').flush(
      { mensaje: 'No se puede desactivar EPMMOP: tiene 3 tipo(s) de incidente activo(s).' }, { status: 400, statusText: 'Bad Request' });
    await accion;

    expect(alertas.error).toHaveBeenCalledWith('No se puede desactivar EPMMOP: tiene 3 tipo(s) de incidente activo(s).');
  });

  it('filtra por estado', () => {
    c.estado.set('I');
    expect(c.visibles().map((e) => e.codigo)).toEqual(['OLD']);
  });
});
