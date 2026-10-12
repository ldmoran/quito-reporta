import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { mensajeDeError } from '../../core/mensajes';
import { FilaAuditoria, FilaHistorial, PaginaAuditoria } from '../../core/modelos';

/** Tablas que guardan copia de cada cambio (*_HIST): solo de esas se puede ver "qué cambió". */
const CON_HISTORIAL: Record<string, string[]> = {
  NEGOCIO: ['ENTIDAD', 'TIPO_INCIDENTE', 'FUNCIONARIO'],
  SEGURIDAD: ['USUARIO', 'PERFIL'],
};
const COLUMNAS_FIJAS = ['id_hist', 'operacion', 'usuario_accion', 'fecha_accion'];

const ETIQUETA_ACCION: Record<string, string> = { INSERT: 'Creación', UPDATE: 'Edición', DELETE: 'Eliminación' };

interface VistaHistorial {
  columnas: string[];
  filas: { datos: FilaHistorial; cambiados: Set<string> }[];
}

/**
 * Consulta de la tabla AUDITORIA de las dos bases (solo lectura: la llenan los triggers). Como en el SGFDM
 * muestra los últimos 100 movimientos que cumplen el filtro; el historial completo sigue en la base.
 */
@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
    <div class="dashboard-section">
      <div class="section-heading">
        <div>
          <h4>Auditoría</h4>
          <p>Quién creó, editó o dio de baja cada registro del sistema, en las bases de negocio y de seguridad.</p>
        </div>
      </div>

      <form class="row g-3 mb-3 align-items-end" (ngSubmit)="buscar()">
        <div class="col-md-3">
          <label class="form-label" for="a-tabla">Tabla</label>
          <select id="a-tabla" name="tabla" class="form-select" [(ngModel)]="tabla">
            <option value="">Todas</option>
            @for (t of tablas(); track t) {
              <option [value]="t">{{ t }}</option>
            }
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label" for="a-accion">Acción</label>
          <select id="a-accion" name="accion" class="form-select" [(ngModel)]="accion">
            <option value="">Todas</option>
            <option value="INSERT">Creación</option>
            <option value="UPDATE">Edición</option>
            <option value="DELETE">Eliminación</option>
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label" for="a-usuario">Usuario</label>
          <input id="a-usuario" name="usuario" class="form-control" [(ngModel)]="usuario" placeholder="Ej: admin" />
        </div>
        <div class="col-md-3 d-flex gap-2">
          <button type="submit" class="btn btn-primary"><i class="fa fa-search me-1" aria-hidden="true"></i>Buscar</button>
          <button type="button" class="btn btn-secondary" (click)="limpiar()"><i class="fa fa-eraser me-1" aria-hidden="true"></i>Limpiar</button>
        </div>
      </form>

      @if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      }

      <div class="custom-table">
        <table class="table align-middle tabla-apilada">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Base</th>
              <th>Tabla</th>
              <th>Registro</th>
              <th>Acción</th>
              <th>Usuario</th>
              <th>Comentario</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (f of pagina()?.items ?? []; track f.origen + f.id) {
              <tr>
                <td data-label="Fecha">{{ f.fecha | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
                <td data-label="Base">{{ f.origen === 'NEGOCIO' ? 'Negocio' : 'Seguridad' }}</td>
                <td data-label="Tabla">{{ f.tabla }}</td>
                <td data-label="Registro">{{ f.idRegistro }}</td>
                <td data-label="Acción">
                  <span [class]="'etiqueta accion-' + f.accion">{{ etiquetaAccion(f.accion) }}</span>
                </td>
                <td data-label="Usuario">{{ f.usuario }}</td>
                <td data-label="Comentario">{{ f.descripcion }}</td>
                <td class="text-end acciones-fila">
                  @if (tieneHistorial(f)) {
                    <button type="button" class="btn btn-secondary btn-sm" (click)="verCambios(f)">
                      <i class="fa fa-eye me-1" aria-hidden="true"></i>{{ abierto() === clave(f) ? 'Ocultar' : 'Ver cambios' }}
                    </button>
                  }
                </td>
              </tr>
              @if (abierto() === clave(f)) {
                <tr class="fila-detalle">
                  <td colspan="8">
                    @if (cargandoHistorial()) {
                      <span class="text-muted">Cargando...</span>
                    } @else {
                    @if (historial(); as h) {
                      <div class="text-muted small mb-2">Versiones guardadas de este registro, de la más antigua a la más reciente. Lo que cambió respecto a la anterior aparece resaltado.</div>
                      <div class="custom-table">
                        <table class="table table-sm mb-0">
                          <thead>
                            <tr>
                              <th>Acción</th>
                              <th>Usuario</th>
                              <th>Fecha</th>
                              @for (c of h.columnas; track c) {
                                <th>{{ nombreColumna(c) }}</th>
                              }
                            </tr>
                          </thead>
                          <tbody>
                            @for (fila of h.filas; track $index) {
                              <tr>
                                <td>{{ etiquetaAccion('' + fila.datos['operacion']) }}</td>
                                <td>{{ fila.datos['usuario_accion'] }}</td>
                                <td>{{ '' + fila.datos['fecha_accion'] | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
                                @for (c of h.columnas; track c) {
                                  <td [class.cambio]="fila.cambiados.has(c)">{{ valor(fila.datos[c]) }}</td>
                                }
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                    }
                  </td>
                </tr>
              }
            } @empty {
              <tr>
                <td colspan="8" class="text-center text-muted py-4">No hay movimientos que coincidan con el filtro.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (pagina(); as p) {
        <div class="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
          <span class="text-muted small">{{ p.total }} movimiento(s) recientes (se muestran como máximo los últimos 100)</span>
          @if (p.totalPaginas > 1) {
            <nav aria-label="Páginas">
              <ul class="pagination pagination-sm mb-0">
                @for (n of paginas(p.totalPaginas); track n) {
                  <li class="page-item" [class.active]="n === p.pagina">
                    <button type="button" class="page-link" (click)="ir(n)">{{ n + 1 }}</button>
                  </li>
                }
              </ul>
            </nav>
          }
        </div>
      }
    </div>
  `,
})
export class AuditoriaComponent implements OnInit {
  private readonly api = inject(ApiService);

  tabla = '';
  accion = '';
  usuario = '';

  readonly pagina = signal<PaginaAuditoria | null>(null);
  readonly tablas = signal<string[]>([]);
  readonly error = signal('');
  readonly abierto = signal<string | null>(null);
  readonly historial = signal<VistaHistorial | null>(null);
  readonly cargandoHistorial = signal(false);

  ngOnInit(): void {
    this.cargar(0);
  }

  buscar(): void {
    this.abierto.set(null);
    this.cargar(0);
  }

  limpiar(): void {
    this.tabla = '';
    this.accion = '';
    this.usuario = '';
    this.buscar();
  }

  ir(pagina: number): void {
    this.abierto.set(null);
    this.cargar(pagina);
  }

  paginas(total: number): number[] {
    return Array.from({ length: total }, (_, i) => i);
  }

  etiquetaAccion(accion: string): string {
    return ETIQUETA_ACCION[accion] ?? accion;
  }

  clave(f: FilaAuditoria): string {
    return `${f.origen}/${f.id}`;
  }

  tieneHistorial(f: FilaAuditoria): boolean {
    return !!f.idRegistro && (CON_HISTORIAL[f.origen] ?? []).includes(f.tabla);
  }

  verCambios(f: FilaAuditoria): void {
    if (this.abierto() === this.clave(f)) {
      this.abierto.set(null);
      return;
    }
    this.abierto.set(this.clave(f));
    this.historial.set(null);
    this.cargandoHistorial.set(true);
    this.api.historialAuditoria(f.origen, f.tabla, f.idRegistro ?? '').subscribe({
      next: (filas) => {
        this.historial.set(this.armarVista(filas));
        this.cargandoHistorial.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargandoHistorial.set(false);
      },
    });
  }

  nombreColumna(c: string): string {
    const texto = c.replace(/^id_/, 'ID ').replace(/_/g, ' ');
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  valor(v: string | number | boolean | null | undefined): string {
    if (v === null || v === undefined || v === '') return '-';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    return String(v);
  }

  /** Columnas del registro y, por cada versión, qué campos cambiaron respecto a la anterior. */
  armarVista(filas: FilaHistorial[]): VistaHistorial {
    const columnas = filas.length > 0 ? Object.keys(filas[0]).filter((c) => !COLUMNAS_FIJAS.includes(c)) : [];
    return {
      columnas,
      filas: filas.map((datos, i) => ({
        datos,
        cambiados: new Set(i === 0 ? [] : columnas.filter((c) => datos[c] !== filas[i - 1][c])),
      })),
    };
  }

  private cargar(pagina: number): void {
    this.error.set('');
    this.api.auditoria({ tabla: this.tabla, accion: this.accion, usuario: this.usuario, pagina }).subscribe({
      next: (p) => {
        this.pagina.set(p);
        this.tablas.set(p.tablas);
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }
}
