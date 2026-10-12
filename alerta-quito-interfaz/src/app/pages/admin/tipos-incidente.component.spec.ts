import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TipoIncidenteAdmin } from '../../core/modelos';
import { TiposIncidenteComponent } from './tipos-incidente.component';

const tipo = (extra: Partial<TipoIncidenteAdmin> = {}): TipoIncidenteAdmin => ({
  id: 1, nombre: 'Bache', idEntidad: 1, entidadCodigo: 'EPMMOP', entidadNombre: 'EPMMOP', prioridadBase: 3, esEmergencia: false,
  estado: 'A', reportes: 0, ...extra,
});

describe('TiposIncidenteComponent (mantenimiento)', () => {
  let fixture: ComponentFixture<TiposIncidenteComponent>;
  let c: TiposIncidenteComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TiposIncidenteComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
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
    spyOn(window, 'confirm').and.returnValue(true);
  });

  afterEach(() => http.verify());

  it('solo ofrece entidades activas para asignar el tipo', () => {
    expect(c.entidadesActivas().map((e) => e.codigo)).toEqual(['EPMMOP']);
  });

  it('marcar emergencia fuerza la prioridad 1', () => {
    c.abrirNuevo();
    c.form.patchValue({ prioridadBase: 4 });
    c.form.controls.esEmergencia.setValue(true);
    c.alCambiarEmergencia();

    expect(c.form.getRawValue().prioridadBase).toBe(1);
  });

  it('crea un tipo con POST', () => {
    c.abrirNuevo();
    c.form.setValue({ nombre: 'Inundación', idEntidad: 1, prioridadBase: 2, esEmergencia: false });
    c.guardar();

    const req = http.expectOne('/api/admin/mantenimiento/tipos-incidente');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nombre: 'Inundación', idEntidad: 1, prioridadBase: 2, esEmergencia: false });
    req.flush(tipo({ id: 9, nombre: 'Inundación' }));
    http.expectOne('/api/admin/mantenimiento/tipos-incidente').flush([]);
    http.expectOne('/api/admin/mantenimiento/entidades').flush([]);
    expect(c.mensaje()).toContain('Inundación');
  });

  it('si el tipo ya tiene reportes no deja cambiarlo de entidad', () => {
    c.editar(tipo({ id: 2, reportes: 4 }));
    expect(c.bloqueaEntidad()).toBeTrue();
    expect(c.form.controls.idEntidad.disabled).toBeTrue();

    c.editar(tipo({ reportes: 0 }));
    expect(c.bloqueaEntidad()).toBeFalse();
    expect(c.form.controls.idEntidad.enabled).toBeTrue();
  });

  it('desactivar un tipo usa PATCH y refresca', () => {
    c.cambiarEstado(tipo(), false);
    const req = http.expectOne('/api/admin/mantenimiento/tipos-incidente/1/estado');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activo: false });
    req.flush(tipo({ estado: 'I' }));
    http.expectOne('/api/admin/mantenimiento/tipos-incidente').flush([]);
    http.expectOne('/api/admin/mantenimiento/entidades').flush([]);
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
