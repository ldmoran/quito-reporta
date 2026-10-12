import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Funcionario } from '../../core/modelos';
import { FuncionariosComponent } from './funcionarios.component';

const funcionario = (extra: Partial<Funcionario> = {}): Funcionario => ({
  id: 1, usuario: 'ana.perez', nombreCompleto: 'Ana Perez', cedula: '1711111111', correo: 'ana@quito.ec',
  idEntidad: 1, entidadCodigo: 'EPMMOP', entidadNombre: 'EPMMOP', cargo: 'Inspector', estado: 'A',
  fechaDesignacion: '2026-10-12T10:00:00', ...extra,
});

describe('FuncionariosComponent (CRUD)', () => {
  let fixture: ComponentFixture<FuncionariosComponent>;
  let c: FuncionariosComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FuncionariosComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FuncionariosComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/admin/funcionarios').flush([
      funcionario(),
      funcionario({ id: 2, usuario: 'luis.baja', nombreCompleto: 'Luis Baja', correo: 'luis@quito.ec', estado: 'I' }),
    ]);
    http.expectOne('/api/entidades').flush([{ id: 1, codigo: 'EPMMOP', nombre: 'EPMMOP', descripcion: '' }]);
    fixture.detectChanges();
    spyOn(window, 'confirm').and.returnValue(true);
  });

  afterEach(() => http.verify());

  it('lista activos y dados de baja, y cada uno ofrece la acción que corresponde', () => {
    const html = fixture.nativeElement as HTMLElement;
    const filas = html.querySelectorAll('tbody tr');

    expect(filas.length).toBe(2);
    expect(filas[0].textContent).toContain('Dar de baja');
    expect(filas[0].textContent).not.toContain('Dar de alta');
    expect(filas[1].textContent).toContain('Dar de alta');
    expect(filas[1].textContent).not.toContain('Restablecer clave');
    expect(filas[0].textContent).toContain('Editar');
    expect(filas[1].textContent).toContain('Editar');
  });

  it('filtra por estado y por texto', () => {
    c.estado.set('I');
    expect(c.visibles().map((f) => f.usuario)).toEqual(['luis.baja']);
    c.estado.set('TODOS');
    c.busqueda.set('ANA');
    expect(c.visibles().map((f) => f.usuario)).toEqual(['ana.perez']);
  });

  it('Editar carga los datos, bloquea el usuario y guarda con PUT', () => {
    c.editar(funcionario());
    fixture.detectChanges();

    expect(c.editandoId()).toBe(1);
    expect(c.form.controls.usuario.disabled).toBeTrue();
    expect(c.form.getRawValue().cedula).toBe('1711111111');

    c.form.patchValue({ nombreCompleto: 'Ana Corregida', cargo: 'Jefa' });
    c.guardar();

    const req = http.expectOne('/api/admin/funcionarios/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nombreCompleto: 'Ana Corregida', cedula: '1711111111', correo: 'ana@quito.ec', idEntidad: 1, cargo: 'Jefa' });
    req.flush(funcionario({ nombreCompleto: 'Ana Corregida' }));
    http.expectOne('/api/admin/funcionarios').flush([funcionario({ nombreCompleto: 'Ana Corregida' })]);

    expect(c.formAbierto()).toBeFalse();
    expect(c.mensaje()).toContain('Ana Corregida');
  });

  it('Nuevo funcionario hace POST sin contraseña y muestra la clave temporal', () => {
    c.abrirNuevo();
    c.form.setValue({ nombreCompleto: 'Nuevo Func', cedula: '1722222222', correo: 'n@quito.ec', usuario: 'nuevo.func', idEntidad: 1, cargo: '' });
    c.guardar();

    const req = http.expectOne('/api/admin/funcionarios');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.password).toBeUndefined();
    req.flush({ funcionario: funcionario({ usuario: 'nuevo.func' }), passwordTemporal: 'Temp#12345ab', correoEnviado: false });
    http.expectOne('/api/admin/funcionarios').flush([]);

    expect(c.entregable()?.clave).toBe('Temp#12345ab');
    expect(c.entregable()?.correoEnviado).toBeFalse();
  });

  it('Dar de baja y Dar de alta llaman al mismo endpoint con activo false/true', () => {
    c.darDeBaja(funcionario());
    let req = http.expectOne('/api/admin/funcionarios/1/estado');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activo: false });
    req.flush(funcionario({ estado: 'I' }));
    http.expectOne('/api/admin/funcionarios').flush([]);

    c.darDeAlta(funcionario({ id: 2, estado: 'I' }));
    req = http.expectOne('/api/admin/funcionarios/2/estado');
    expect(req.request.body).toEqual({ activo: true });
    req.flush(funcionario({ id: 2 }));
    http.expectOne('/api/admin/funcionarios').flush([]);
    expect(c.mensaje()).toContain('dado de alta');
  });

  it('muestra el mensaje del servidor si el correo ya existe', () => {
    c.editar(funcionario());
    c.guardar();
    http.expectOne('/api/admin/funcionarios/1').flush({ mensaje: "El correo 'ana@quito.ec' ya esta registrado por otro usuario." }, { status: 400, statusText: 'Bad Request' });

    expect(c.error()).toContain('ya esta registrado');
    expect(c.guardando()).toBeFalse();
    expect(c.formAbierto()).toBeTrue();   // no pierde lo que escribió
  });

  it('Restablecer clave pide confirmación y muestra la temporal', () => {
    c.restablecer(funcionario());
    http.expectOne('/api/admin/usuarios/ana.perez/restablecer-password').flush({ usuario: 'ana.perez', passwordTemporal: 'Otra#98765xy', correoEnviado: true });

    expect(c.entregable()?.usuario).toBe('ana.perez');
    expect(c.entregable()?.correoEnviado).toBeTrue();
  });
});
