import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AlertasService } from '../../core/alertas.service';
import { AlertasFalso } from '../../testing/alertas-falso';
import { FilaAuditoria, PaginaAuditoria } from '../../core/modelos';
import { AuditoriaComponent } from './auditoria.component';

const fila = (extra: Partial<FilaAuditoria> = {}): FilaAuditoria => ({
  origen: 'NEGOCIO', id: 10, tabla: 'ENTIDAD', idRegistro: '3', accion: 'UPDATE', usuario: 'admin', fecha: '2026-10-12T10:00:00', descripcion: 'Datos de la entidad actualizados', ...extra,
});
const pagina = (items: FilaAuditoria[], extra: Partial<PaginaAuditoria> = {}): PaginaAuditoria => ({
  items, pagina: 0, totalPaginas: 1, total: items.length, tablas: ['ENTIDAD', 'USUARIO'], ...extra,
});

describe('AuditoriaComponent', () => {
  let fixture: ComponentFixture<AuditoriaComponent>;
  let c: AuditoriaComponent;
  let http: HttpTestingController;
  let alertas: AlertasFalso;

  beforeEach(async () => {
    alertas = new AlertasFalso();
    await TestBed.configureTestingModule({
      imports: [AuditoriaComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: AlertasService, useValue: alertas }],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuditoriaComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const cargaInicial = (p: PaginaAuditoria) => http.expectOne((r) => r.url === '/api/admin/auditoria').flush(p);

  it('carga los últimos movimientos con su comentario y alimenta el filtro de tablas', () => {
    cargaInicial(pagina([fila(), fila({ id: 11, origen: 'SEGURIDAD', tabla: 'USUARIO', accion: 'INSERT', idRegistro: '5', descripcion: 'Usuario creado' })]));
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
    expect(c.tablas()).toEqual(['ENTIDAD', 'USUARIO']);
    expect(texto).toContain('Edición');
    expect(texto).toContain('Creación');
    expect(texto).toContain('Usuario creado');
  });

  it('envía los filtros al servidor y vuelve a la primera página', () => {
    cargaInicial(pagina([]));
    c.tabla = 'ENTIDAD';
    c.accion = 'UPDATE';
    c.usuario = '  admin ';
    c.buscar();

    const req = http.expectOne((r) => r.url === '/api/admin/auditoria');
    expect(req.request.params.get('tabla')).toBe('ENTIDAD');
    expect(req.request.params.get('accion')).toBe('UPDATE');
    expect(req.request.params.get('usuario')).toBe('admin');
    expect(req.request.params.get('pagina')).toBe('0');
    req.flush(pagina([]));
  });

  it('Limpiar quita los filtros', () => {
    cargaInicial(pagina([]));
    c.tabla = 'ENTIDAD';
    c.limpiar();

    const req = http.expectOne((r) => r.url === '/api/admin/auditoria');
    expect(req.request.params.has('tabla')).toBeFalse();
    req.flush(pagina([]));
  });

  it('solo ofrece "Ver cambios" en las tablas que guardan historial', () => {
    expect(c.tieneHistorial(fila())).toBeTrue();
    expect(c.tieneHistorial(fila({ origen: 'SEGURIDAD', tabla: 'USUARIO' }))).toBeTrue();
    expect(c.tieneHistorial(fila({ origen: 'SEGURIDAD', tabla: 'ENTIDAD' }))).toBeFalse();
    expect(c.tieneHistorial(fila({ tabla: 'REPORTE' }))).toBeFalse();
    expect(c.tieneHistorial(fila({ idRegistro: null }))).toBeFalse();
    cargaInicial(pagina([]));
  });

  it('Ver cambios abre una ventana con las versiones y lo que cambió resaltado', async () => {
    cargaInicial(pagina([fila()]));
    const accion = c.verCambios(fila());

    const req = http.expectOne((r) => r.url === '/api/admin/auditoria/historial');
    expect(req.request.params.get('origen')).toBe('NEGOCIO');
    expect(req.request.params.get('tabla')).toBe('ENTIDAD');
    expect(req.request.params.get('idRegistro')).toBe('3');
    req.flush([
      { id_hist: 1, operacion: 'INSERT', usuario_accion: 'admin', fecha_accion: '2026-10-12T09:00:00', id_entidad: 3, nombre: 'Antes', estado: 'A' },
      { id_hist: 2, operacion: 'UPDATE', usuario_accion: 'admin', fecha_accion: '2026-10-12T10:00:00', id_entidad: 3, nombre: 'Despues', estado: 'A' },
    ]);
    await accion;

    const opciones = alertas.detalle.calls.mostRecent().args[0];
    expect(opciones.titulo).toBe('Cambios de ENTIDAD #3');
    expect(opciones.html).toContain('<td class="cambio">Despues</td>');
    expect(opciones.html).toContain('<td>Antes</td>');
    expect(opciones.html).not.toContain('<td class="cambio">Antes</td>');
  });

  it('si falla traer el historial muestra una ventana de error', async () => {
    cargaInicial(pagina([fila()]));
    const accion = c.verCambios(fila());
    http.expectOne((r) => r.url.endsWith('/historial')).flush({ mensaje: 'Esa tabla no tiene historial de cambios.' }, { status: 400, statusText: 'Bad Request' });
    await accion;

    expect(alertas.error).toHaveBeenCalledWith('Esa tabla no tiene historial de cambios.');
  });

  it('muestra la paginación solo cuando hay más de una página', () => {
    cargaInicial(pagina([fila()], { totalPaginas: 3, total: 41 }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.page-link').length).toBe(3);

    c.ir(2);
    const req = http.expectOne((r) => r.url === '/api/admin/auditoria');
    expect(req.request.params.get('pagina')).toBe('2');
    req.flush(pagina([fila()], { pagina: 2, totalPaginas: 3 }));
  });

  it('muestra el error del servidor', () => {
    http.expectOne((r) => r.url === '/api/admin/auditoria').flush({ mensaje: 'Accion invalida' }, { status: 400, statusText: 'Bad Request' });
    expect(c.error()).toBe('Accion invalida');
  });
});
