import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EntidadAdmin } from '../../core/modelos';
import { EntidadesComponent } from './entidades.component';

const entidad = (extra: Partial<EntidadAdmin> = {}): EntidadAdmin => ({
  id: 1, codigo: 'EPMMOP', nombre: 'Empresa Publica', descripcion: 'Calles', estado: 'A', tiposActivos: 3, funcionariosActivos: 1, ...extra,
});

describe('EntidadesComponent (mantenimiento)', () => {
  let fixture: ComponentFixture<EntidadesComponent>;
  let c: EntidadesComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntidadesComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EntidadesComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/admin/mantenimiento/entidades').flush([entidad(), entidad({ id: 2, codigo: 'OLD', nombre: 'Antigua', estado: 'I', tiposActivos: 0, funcionariosActivos: 0 })]);
    fixture.detectChanges();
    spyOn(window, 'confirm').and.returnValue(true);
  });

  afterEach(() => http.verify());

  it('muestra cuántos tipos y funcionarios dependen de cada entidad', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('EPMMOP');
    expect(texto).toContain('Tipos activos');
    expect(c.visibles().length).toBe(2);
  });

  it('crea una entidad con POST y refresca la lista', () => {
    c.abrirNueva();
    c.form.setValue({ codigo: 'ecu911', nombre: 'Servicio Integrado', descripcion: '' });
    c.guardar();

    const req = http.expectOne('/api/admin/mantenimiento/entidades');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.codigo).toBe('ecu911');
    req.flush(entidad({ id: 9, codigo: 'ECU911' }));
    http.expectOne('/api/admin/mantenimiento/entidades').flush([]);

    expect(c.mensaje()).toContain('ECU911');
    expect(c.formAbierto()).toBeFalse();
  });

  it('valida el código antes de enviar', () => {
    c.abrirNueva();
    c.form.setValue({ codigo: 'mal codigo!', nombre: 'X', descripcion: '' });
    expect(c.form.controls.codigo.invalid).toBeTrue();
    c.form.controls.codigo.setValue('A');
    expect(c.form.controls.codigo.invalid).toBeTrue();
    c.form.controls.codigo.setValue('AB_1');
    expect(c.form.controls.codigo.valid).toBeTrue();
  });

  it('edita con PUT usando el id de la entidad', () => {
    c.editar(entidad());
    c.form.patchValue({ nombre: 'Nuevo nombre' });
    c.guardar();

    const req = http.expectOne('/api/admin/mantenimiento/entidades/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.nombre).toBe('Nuevo nombre');
    req.flush(entidad({ nombre: 'Nuevo nombre' }));
    http.expectOne('/api/admin/mantenimiento/entidades').flush([]);
  });

  it('desactivar y activar usan PATCH; si el servidor lo impide muestra el motivo', () => {
    c.cambiarEstado(entidad(), false);
    http.expectOne('/api/admin/mantenimiento/entidades/1/estado').flush(
      { mensaje: 'No se puede desactivar EPMMOP: tiene 3 tipo(s) de incidente activo(s).' }, { status: 400, statusText: 'Bad Request' });
    expect(c.error()).toContain('tiene 3 tipo(s)');

    c.cambiarEstado(entidad({ id: 2, estado: 'I' }), true);
    const req = http.expectOne('/api/admin/mantenimiento/entidades/2/estado');
    expect(req.request.body).toEqual({ activo: true });
    req.flush(entidad({ id: 2 }));
    http.expectOne('/api/admin/mantenimiento/entidades').flush([]);
    expect(c.error()).toBe('');
  });

  it('filtra por estado', () => {
    c.estado.set('I');
    expect(c.visibles().map((e) => e.codigo)).toEqual(['OLD']);
  });
});
