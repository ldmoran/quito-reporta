import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertasService } from '../../core/alertas.service';
import { AlertasFalso } from '../../testing/alertas-falso';
import { Funcionario } from '../../core/modelos';
import { FuncionariosComponent } from './funcionarios.component';

const funcionario = (extra: Partial<Funcionario> = {}): Funcionario => ({
  id: 1, usuario: 'ana.perez', nombreCompleto: 'Ana Perez', cedula: '1711111111', correo: 'ana@quito.ec',
  idEntidad: 1, entidadCodigo: 'EPMMOP', entidadNombre: 'EPMMOP', cargo: 'Inspector', estado: 'A',
  fechaDesignacion: '2026-10-12T10:00:00', ...extra,
});

describe('FuncionariosComponent (CRUD con ventanas emergentes)', () => {
  let fixture: ComponentFixture<FuncionariosComponent>;
  let c: FuncionariosComponent;
  let http: HttpTestingController;
  let alertas: AlertasFalso;

  beforeEach(async () => {
    alertas = new AlertasFalso();
    await TestBed.configureTestingModule({
      imports: [FuncionariosComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AlertasService, useValue: alertas }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FuncionariosComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/api/admin/funcionarios').flush([
      funcionario(),
      funcionario({ id: 2, usuario: 'luis.baja', nombreCompleto: 'Luis Baja', correo: 'luis@quito.ec', estado: 'I' }),
    ]);
    http.expectOne('/api/entidades').flush([{ id: 1, codigo: 'EPMMOP', nombre: 'Empresa Publica', descripcion: '' }]);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const recarga = () => http.expectOne('/api/admin/funcionarios').flush([]);

  it('lista activos y dados de baja y cada uno ofrece la acción que corresponde', () => {
    const filas = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');

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

  it('Nuevo abre el formulario con las entidades y, al guardar, muestra la contraseña temporal', async () => {
    alertas.valores = { nombreCompleto: 'Nuevo Func', cedula: '1722222222', correo: 'n@quito.ec', usuario: 'nuevo.func', idEntidad: 1, cargo: 'Despachador' };
    const accion = c.nuevo();

    const campos = alertas.ultimoFormulario!.campos;
    expect(alertas.ultimoFormulario!.titulo).toBe('Nuevo funcionario');
    expect(campos.map((x) => x.nombre)).toEqual(['nombreCompleto', 'cedula', 'usuario', 'correo', 'idEntidad', 'cargo']);
    expect(campos.find((x) => x.nombre === 'usuario')!.deshabilitado).toBeFalse();
    expect(campos.find((x) => x.nombre === 'idEntidad')!.opciones!.map((o) => o.texto)).toEqual(['Seleccione...', 'EPMMOP - Empresa Publica']);

    const req = http.expectOne('/api/admin/funcionarios');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.password).toBeUndefined();
    expect(req.request.body.idEntidad).toBe(1);
    req.flush({ funcionario: funcionario({ usuario: 'nuevo.func' }), passwordTemporal: 'Temp#12345ab', correoEnviado: false });
    await accion;
    recarga();

    expect(alertas.credencial).toHaveBeenCalledWith({ usuario: 'nuevo.func', clave: 'Temp#12345ab', correoEnviado: false });
  });

  it('si la persona cancela el formulario no se llama al servidor', async () => {
    alertas.valores = null;
    await c.nuevo();

    http.expectNone('/api/admin/funcionarios');
    expect(alertas.credencial).not.toHaveBeenCalled();
  });

  it('Editar carga los datos, bloquea el usuario y guarda con PUT', async () => {
    alertas.valores = { nombreCompleto: 'Ana Corregida', cedula: '1711111111', correo: 'ana@quito.ec', usuario: 'ana.perez', idEntidad: 1, cargo: 'Jefa' };
    const accion = c.editar(funcionario());

    const campos = alertas.ultimoFormulario!.campos;
    expect(campos.find((x) => x.nombre === 'usuario')!.deshabilitado).toBeTrue();
    expect(campos.find((x) => x.nombre === 'cedula')!.valor).toBe('1711111111');
    expect(campos.find((x) => x.nombre === 'idEntidad')!.valor).toBe(1);

    const req = http.expectOne('/api/admin/funcionarios/1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ nombreCompleto: 'Ana Corregida', cedula: '1711111111', correo: 'ana@quito.ec', idEntidad: 1, cargo: 'Jefa' });
    req.flush(funcionario({ nombreCompleto: 'Ana Corregida' }));
    await accion;
    recarga();

    expect(alertas.exito).toHaveBeenCalledWith('Los datos de Ana Corregida se actualizaron.');
  });

  it('un error del servidor se propaga al formulario para mostrarlo sin cerrarlo', async () => {
    alertas.valores = { nombreCompleto: 'X Y', cedula: '1711111111', correo: 'ana@quito.ec', usuario: 'ana.perez', idEntidad: 1, cargo: '' };
    const accion = c.editar(funcionario());
    http.expectOne('/api/admin/funcionarios/1').flush({ mensaje: 'El correo ya esta registrado por otro usuario.' }, { status: 400, statusText: 'Bad Request' });

    await expectAsync(accion).toBeRejected();   // el formulario real captura este error y lo muestra dentro
    expect(alertas.ultimoFormulario!.mensajeDeError!(new Error('x'))).toBeDefined();
  });

  it('Dar de baja pide confirmación y usa PATCH con activo false', async () => {
    const accion = c.darDeBaja(funcionario());
    await Promise.resolve();

    expect(alertas.confirmar).toHaveBeenCalled();
    expect(alertas.confirmar.calls.mostRecent().args[0].peligro).toBeTrue();
    const req = http.expectOne('/api/admin/funcionarios/1/estado');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ activo: false });
    req.flush(funcionario({ estado: 'I' }));
    await Promise.resolve();
    await accion;
    recarga();

    expect(alertas.exito).toHaveBeenCalledWith('Ana Perez fue dado de baja.');
  });

  it('Dar de alta usa PATCH con activo true', async () => {
    const accion = c.darDeAlta(funcionario({ id: 2, estado: 'I', nombreCompleto: 'Luis Baja' }));
    await Promise.resolve();

    const req = http.expectOne('/api/admin/funcionarios/2/estado');
    expect(req.request.body).toEqual({ activo: true });
    req.flush(funcionario({ id: 2 }));
    await Promise.resolve();
    await accion;
    recarga();

    expect(alertas.exito).toHaveBeenCalledWith('Luis Baja fue dado de alta de nuevo.');
  });

  it('si la persona no confirma no pasa nada', async () => {
    alertas.confirmacion = false;
    await c.darDeBaja(funcionario());
    await c.darDeAlta(funcionario({ estado: 'I' }));
    await c.restablecer(funcionario());

    http.expectNone((r) => r.url.includes('/estado') || r.url.includes('restablecer'));
    expect(alertas.exito).not.toHaveBeenCalled();
  });

  it('si el servidor rechaza la baja muestra el motivo en una ventana de error', async () => {
    const accion = c.darDeBaja(funcionario());
    await Promise.resolve();
    http.expectOne('/api/admin/funcionarios/1/estado').flush({ mensaje: 'No se puede.' }, { status: 400, statusText: 'Bad Request' });
    await accion;

    expect(alertas.error).toHaveBeenCalledWith('No se puede.');
  });

  it('Restablecer clave muestra la temporal en la ventana de credenciales', async () => {
    const accion = c.restablecer(funcionario());
    await Promise.resolve();
    http.expectOne('/api/admin/usuarios/ana.perez/restablecer-password').flush({ usuario: 'ana.perez', passwordTemporal: 'Otra#98765xy', correoEnviado: true });
    await accion;

    expect(alertas.credencial).toHaveBeenCalledWith({ usuario: 'ana.perez', clave: 'Otra#98765xy', correoEnviado: true });
  });
});
