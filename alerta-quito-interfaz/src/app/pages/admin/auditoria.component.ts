import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AlertasService } from '../../core/alertas.service';
import { armarVistaHistorial, htmlHistorial } from '../../core/historial-html';
import { mensajeDeError } from '../../core/mensajes';
import { FilaAuditoria, PaginaAuditoria } from '../../core/modelos';

/** Tablas que guardan copia de cada cambio (*_HIST): solo de esas se puede ver "qué cambió". */
const CON_HISTORIAL: Record<string, string[]> = {
  NEGOCIO: ['ENTIDAD', 'TIPO_INCIDENTE', 'FUNCIONARIO'],
  SEGURIDAD: ['USUARIO', 'PERFIL'],
};

const ETIQUETA_ACCION: Record<string, string> = { INSERT: 'Creación', UPDATE: 'Edición', DELETE: 'Eliminación' };

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
                      <i class="fa fa-eye me-1" aria-hidden="true"></i>Ver cambios
                    </button>
                  }
                </td>
              </tr>
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
  private readonly alertas = inject(AlertasService);

  tabla = '';
  accion = '';
  usuario = '';

  readonly pagina = signal<PaginaAuditoria | null>(null);
  readonly tablas = signal<string[]>([]);
  readonly error = signal('');

  ngOnInit(): void {
    this.cargar(0);
  }

  buscar(): void {
    this.cargar(0);
  }

  limpiar(): void {
    this.tabla = '';
    this.accion = '';
    this.usuario = '';
    this.buscar();
  }

  ir(pagina: number): void {
    this.cargar(pagina);
  }

  paginas(total: number): number[] {
    return Array.from({ length: total }, (_, i) => i);
  }

  etiquetaAccion(accion: string): string {
    return ETIQUETA_ACCION[accion] ?? accion;
  }

  tieneHistorial(f: FilaAuditoria): boolean {
    return !!f.idRegistro && (CON_HISTORIAL[f.origen] ?? []).includes(f.tabla);
  }

  /** Abre una ventana con las versiones guardadas del registro; lo que cambió va resaltado. */
  async verCambios(f: FilaAuditoria): Promise<void> {
    try {
      const filas = await firstValueFrom(this.api.historialAuditoria(f.origen, f.tabla, f.idRegistro ?? ''));
      await this.alertas.detalle({
        titulo: `Cambios de ${f.tabla} #${f.idRegistro}`,
        html: htmlHistorial(armarVistaHistorial(filas)),
      });
    } catch (e) {
      await this.alertas.error(mensajeDeError(e));
    }
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
