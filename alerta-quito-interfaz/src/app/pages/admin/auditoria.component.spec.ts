import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FilaAuditoria, PaginaAuditoria } from '../../core/modelos';
import { AuditoriaComponent } from './auditoria.component';

const fila = (extra: Partial<FilaAuditoria> = {}): FilaAuditoria => ({
  origen: 'NEGOCIO', id: 10, tabla: 'ENTIDAD', idRegistro: '3', accion: 'UPDATE', usuario: 'admin', fecha: '2026-10-12T10:00:00', descripcion: null, ...extra,
});
const pagina = (items: FilaAuditoria[], extra: Partial<PaginaAuditoria> = {}): PaginaAuditoria => ({
  items, pagina: 0, totalPaginas: 1, total: items.length, tablas: ['ENTIDAD', 'USUARIO'], ...extra,
});

describe('AuditoriaComponent', () => {
  let fixture: ComponentFixture<AuditoriaComponent>;
  let c: AuditoriaComponent;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuditoriaComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AuditoriaComponent);
    c = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const cargaInicial = (p: PaginaAuditoria) => http.expectOne((r) => r.url === '/api/admin/auditoria').flush(p);

  it('carga los últimos movimientos y alimenta el filtro de tablas', () => {
    cargaInicial(pagina([fila(), fila({ id: 11, origen: 'SEGURIDAD', tabla: 'USUARIO', accion: 'INSERT', idRegistro: '5' })]));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(2);
    expect(c.tablas()).toEqual(['ENTIDAD', 'USUARIO']);
    expect(fixture.nativeElement.textContent).toContain('Edición');
    expect(fixture.nativeElement.textContent).toContain('Creación');
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

  it('Ver cambios trae el historial y resalta lo que cambió entre versiones', () => {
    cargaInicial(pagina([fila()]));
    c.verCambios(fila());

    const req = http.expectOne((r) => r.url === '/api/admin/auditoria/historial');
    expect(req.request.params.get('origen')).toBe('NEGOCIO');
    expect(req.request.params.get('tabla')).toBe('ENTIDAD');
    expect(req.request.params.get('idRegistro')).toBe('3');
    req.flush([
      { id_hist: 1, operacion: 'INSERT', usuario_accion: 'admin', fecha_accion: '2026-10-12T09:00:00', id_entidad: 3, nombre: 'Antes', estado: 'A' },
      { id_hist: 2, operacion: 'UPDATE', usuario_accion: 'admin', fecha_accion: '2026-10-12T10:00:00', id_entidad: 3, nombre: 'Despues', estado: 'A' },
    ]);
    fixture.detectChanges();

    const vista = c.historial()!;
    expect(vista.columnas).toEqual(['id_entidad', 'nombre', 'estado']);
    expect(vista.filas[0].cambiados.size).toBe(0);
    expect([...vista.filas[1].cambiados]).toEqual(['nombre']);
    expect(fixture.nativeElement.querySelector('td.cambio').textContent).toContain('Despues');
  });

  it('un segundo clic oculta el detalle', () => {
    cargaInicial(pagina([fila()]));
    c.verCambios(fila());
    http.expectOne((r) => r.url.endsWith('/historial')).flush([]);
    expect(c.abierto()).not.toBeNull();

    c.verCambios(fila());
    expect(c.abierto()).toBeNull();
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
