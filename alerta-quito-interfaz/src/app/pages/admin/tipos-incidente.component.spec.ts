import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertasService } from '../../core/alertas.service';
import { AlertasFalso } from '../../testing/alertas-falso';
import { TipoIncidenteAdmin } from '../../core/modelos';
import { TiposIncidenteComponent, alCambiarEmergencia } from './tipos-incidente.component';

const tipo = (extra: Partial<TipoIncidenteAdmin> = {}): TipoIncidenteAdmin => ({
  id: 1, nombre: 'Bache', idEntidad: 1, entidadCodigo: 'EPMMOP', entidadNombre: 'EPMMOP', prioridadBase: 3, esEmergencia: false,
  estado: 'A', reportes: 0, ...extra,
});

describe('TiposIncidenteComponent (mantenimiento con ventanas emergentes)', () => {
  let fixture: ComponentFixture<TiposIncidenteComponent>;
  let c: TiposIncidenteComponent;
  let http: HttpTestingController;
  let alertas: AlertasFalso;

  beforeEach(async () => {
    alertas = new AlertasFalso();
    await TestBed.configureTestingModule({
      imports: [TiposIncidenteComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AlertasService, useValue: alertas }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TiposIncidenteComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/admin/mantenimiento/tipos-incidente').flush([tipo(), tipo({ id: 2, nombre: 'Robo', prioridadBase: 1, esEmergencia: true, reportes: 4, estado: 'I' })]);
    http.expectOne('/api/admin/mantenimiento/entidades').flush([
      { id: 1, codigo: 'EPMMOP', nombre: 'EPMMOP', descripcion: null, estado: 'A', tiposActivos: 1, funcionariosActivos: 0 },
      { id: 2, codigo: 'OLD', nombre: 'Vieja', descripcion: null, estado: 'I', tiposActivos: 0, funcionariosActivos: 0 },
    ]);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const recarga = () => {
    http.expectOne('/api/admin/mantenimiento/tipos-incidente').flush([]);
    http.expectOne('/api/admin/mantenimiento/entidades').flush([]);
  };

  it('el formulario solo ofrece entidades activas', async () => {
    alertas.valores = null;
    await c.nuevo();

    const opciones = alertas.ultimoFormulario!.campos.find((x) => x.nombre === 'idEntidad')!.opciones!;
    expect(opciones.map((o) => o.texto)).toEqual(['Seleccione...', 'EPMMOP - EPMMOP']);
  });

  it('marcar emergencia fuerza la prioridad 1 (y desmarcarla no la cambia)', () => {
    const asignar = jasmine.createSpy('asignar');

    alCambiarEmergencia('esEmergencia', { esEmergencia: true, prioridadBase: 4 }, asignar);
    expect(asignar).toHaveBeenCalledWith('prioridadBase', 1);

    asignar.calls.reset();
    alCambiarEmergencia('esEmergencia', { esEmergencia: false }, asignar);
    alCambiarEmergencia('nombre', { esEmergencia: true }, asignar);
    expect(asignar).not.toHaveBeenCalled();
  });

  it('crea un tipo con POST', async () => {
    alertas.valores = { nombre: 'Inundación', idEntidad: 1, prioridadBase: 2, esEmergencia: false };
    const accion = c.nuevo();

    const req = http.expectOne('/api/admin/mantenimiento/tipos-incidente');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nombre: 'Inundación', idEntidad: 1, prioridadBase: 2, esEmergencia: false });
    req.flush(tipo({ id: 9, nombre: 'Inundación' }));
    await accion;
    recarga();

    expect(alertas.exito).toHaveBeenCalledWith('El tipo "Inundación" fue creado.');
  });

  it('si el tipo ya tiene reportes la entidad queda bloqueada y se conserva la original', async () => {
    alertas.valores = { nombre: 'Robo', idEntidad: 99, prioridadBase: 1, esEmergencia: true };
    const accion = c.editar(tipo({ id: 2, nombre: 'Robo', reportes: 4 }));

    const campo = alertas.ultimoFormulario!.campos.find((x) => x.nombre === 'idEntidad')!;
    expect(campo.deshabilitado).toBeTrue();
    expect(campo.ayuda).toContain('Ya tiene reportes');

    const req = http.expectOne('/api/admin/mantenimiento/tipos-incidente/2');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.idEntidad).toBe(1);   // no el 99 del formulario
    req.flush(tipo({ id: 2 }));
    await accion;
    recarga();
  });

  it('un tipo sin reportes sí permite cambiar de entidad', async () => {
    alertas.valores = null;
    await c.editar(tipo({ reportes: 0 }));

    expect(alertas.ultimoFormulario!.campos.find((x) => x.nombre === 'idEntidad')!.deshabilitado).toBeFalse();
  });

  it('desactivar un tipo pide confirmación de peligro y usa PATCH', async () => {
    const accion = c.cambiarEstado(tipo(), false);
    await Promise.resolve();

    expect(alertas.confirmar.calls.mostRecent().args[0].peligro).toBeTrue();
    const req = http.expectOne('/api/admin/mantenimiento/tipos-incidente/1/estado');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activo: false });
    req.flush(tipo({ estado: 'I' }));
    await Promise.resolve();
    await accion;
    recarga();

    expect(alertas.exito).toHaveBeenCalledWith('El tipo "Bache" fue desactivado.');
  });

  it('filtra por entidad, estado y texto', () => {
    c.estado.set('A');
    expect(c.visibles().map((t) => t.nombre)).toEqual(['Bache']);
    c.estado.set('TODOS');
    c.busqueda.set('rob');
    expect(c.visibles().map((t) => t.nombre)).toEqual(['Robo']);
    c.busqueda.set('');
    c.entidadFiltro.set(99);
    expect(c.visibles().length).toBe(0);
  });
});
