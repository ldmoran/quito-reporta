import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { mensajeDeError } from '../../core/mensajes';
import { EntidadAdmin } from '../../core/modelos';

type FiltroEstado = 'TODOS' | 'A' | 'I';

/** Mantenimiento de entidades de respuesta (EPMMOP, AMT, EEQ, Policía, Bomberos y las que se agreguen). */
@Component({
  selector: 'app-entidades',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule],
  template: `
    <div class="dashboard-section">
      <div class="section-heading">
        <div>
          <h4>Entidades</h4>
          <p>Instituciones que reciben y atienden los reportes. Nada se borra: se desactivan y se pueden reactivar.</p>
        </div>
        @if (!formAbierto()) {
          <button type="button" class="btn btn-primary btn-sm" (click)="abrirNueva()">
            <i class="fa fa-plus-circle me-1" aria-hidden="true"></i> Nueva entidad
          </button>
        }
      </div>

      @if (mensaje()) {
        <div class="alert alert-success py-2" role="status">{{ mensaje() }}</div>
      }
      @if (error()) {
        <div class="alert alert-danger py-2" role="alert">{{ error() }}</div>
      }

      @if (formAbierto()) {
        <div class="panel-formulario">
          <h4 class="subtitulo mt-0">{{ editandoId() ? 'Editar entidad' : 'Nueva entidad' }}</h4>
          <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
            <div class="row g-3">
              <div class="col-md-3">
                <label class="form-label" for="e-codigo">Código</label>
                <input id="e-codigo" class="form-control text-uppercase" formControlName="codigo" maxlength="10" placeholder="EPMMOP" />
                <div class="form-text">2 a 10 letras, números o guion bajo.</div>
              </div>
              <div class="col-md-9">
                <label class="form-label" for="e-nombre">Nombre</label>
                <input id="e-nombre" class="form-control" formControlName="nombre" maxlength="150" />
              </div>
              <div class="col-12">
                <label class="form-label" for="e-descripcion">Descripción (opcional)</label>
                <input id="e-descripcion" class="form-control" formControlName="descripcion" maxlength="300" placeholder="Calles, señalización y semáforos" />
              </div>
            </div>
            <div class="mt-3 d-flex gap-2">
              <button class="btn btn-primary" type="submit" [disabled]="form.invalid || guardando()">
                <i class="fa fa-save me-2" aria-hidden="true"></i>{{ guardando() ? 'Guardando...' : 'Guardar' }}
              </button>
              <button class="btn btn-secondary" type="button" (click)="cerrarForm()">Cancelar</button>
            </div>
          </form>
        </div>
      }

      <div class="row g-2 mb-3 align-items-end">
        <div class="col-md-5">
          <label class="form-label" for="busqueda">Buscar</label>
          <input id="busqueda" class="form-control" placeholder="Código o nombre" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" />
        </div>
        <div class="col-md-3">
          <label class="form-label" for="estado">Estado</label>
          <select id="estado" class="form-select" [ngModel]="estado()" (ngModelChange)="estado.set($event)">
            <option value="TODOS">Todos</option>
            <option value="A">Activas</option>
            <option value="I">Inactivas</option>
          </select>
        </div>
      </div>

      <div class="custom-table">
        <table class="table align-middle tabla-apilada">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre</th>
              <th>Tipos activos</th>
              <th>Funcionarios activos</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (e of visibles(); track e.id) {
              <tr [class.inactivo]="e.estado === 'I'">
                <td data-label="Código"><strong>{{ e.codigo }}</strong></td>
                <td data-label="Nombre">
                  <span>{{ e.nombre }}@if (e.descripcion) {<br /><small class="text-muted">{{ e.descripcion }}</small>}</span>
                </td>
                <td data-label="Tipos activos">{{ e.tiposActivos }}</td>
                <td data-label="Funcionarios activos">{{ e.funcionariosActivos }}</td>
                <td data-label="Estado">{{ e.estado === 'A' ? 'Activa' : 'Inactiva' }}</td>
                <td class="text-end text-nowrap acciones-fila">
                  <button type="button" class="btn btn-secondary btn-sm me-1" (click)="editar(e)">
                    <i class="fa fa-pencil me-1" aria-hidden="true"></i>Editar
                  </button>
                  @if (e.estado === 'A') {
                    <button type="button" class="btn btn-outline-danger btn-sm" (click)="cambiarEstado(e, false)">
                      <i class="fa fa-ban me-1" aria-hidden="true"></i>Desactivar
                    </button>
                  } @else {
                    <button type="button" class="btn btn-success btn-sm" (click)="cambiarEstado(e, true)">
                      <i class="fa fa-check me-1" aria-hidden="true"></i>Activar
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="text-center text-muted py-4">No hay entidades que coincidan.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class EntidadesComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly entidades = signal<EntidadAdmin[]>([]);
  readonly busqueda = signal('');
  readonly estado = signal<FiltroEstado>('TODOS');
  readonly formAbierto = signal(false);
  readonly editandoId = signal<number | null>(null);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');

  readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.entidades().filter((e) => {
      if (this.estado() !== 'TODOS' && e.estado !== this.estado()) return false;
      return !texto || e.codigo.toLowerCase().includes(texto) || e.nombre.toLowerCase().includes(texto);
    });
  });

  readonly form = this.fb.nonNullable.group({
    codigo: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(10), Validators.pattern(/^[A-Za-z0-9_]+$/)]],
    nombre: ['', [Validators.required, Validators.maxLength(150)]],
    descripcion: ['', Validators.maxLength(300)],
  });

  ngOnInit(): void {
    this.cargar();
  }

  abrirNueva(): void {
    this.limpiar();
    this.editandoId.set(null);
    this.form.reset({ codigo: '', nombre: '', descripcion: '' });
    this.formAbierto.set(true);
  }

  editar(e: EntidadAdmin): void {
    this.limpiar();
    this.editandoId.set(e.id);
    this.form.reset({ codigo: e.codigo, nombre: e.nombre, descripcion: e.descripcion ?? '' });
    this.formAbierto.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cerrarForm(): void {
    this.formAbierto.set(false);
    this.editandoId.set(null);
  }

  guardar(): void {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.limpiar();
    const datos = this.form.getRawValue();
    const id = this.editandoId();
    const llamada = id === null ? this.api.crearEntidad(datos) : this.api.actualizarEntidad(id, datos);
    llamada.subscribe({
      next: (e) => {
        this.mensaje.set(id === null ? `La entidad ${e.codigo} fue creada.` : `La entidad ${e.codigo} fue actualizada.`);
        this.cerrarForm();
        this.guardando.set(false);
        this.cargar();
      },
      error: (err) => {
        this.error.set(mensajeDeError(err));
        this.guardando.set(false);
      },
    });
  }

  cambiarEstado(e: EntidadAdmin, activo: boolean): void {
    const accion = activo ? 'activar' : 'desactivar';
    if (!confirm(`¿Desea ${accion} la entidad ${e.codigo}?`)) return;
    this.limpiar();
    this.api.estadoEntidad(e.id, activo).subscribe({
      next: () => {
        this.mensaje.set(`La entidad ${e.codigo} fue ${activo ? 'activada' : 'desactivada'}.`);
        this.cargar();
      },
      error: (err) => this.error.set(mensajeDeError(err)),
    });
  }

  private cargar(): void {
    this.api.entidadesAdmin().subscribe({ next: (e) => this.entidades.set(e), error: (err) => this.error.set(mensajeDeError(err)) });
  }

  private limpiar(): void {
    this.error.set('');
    this.mensaje.set('');
  }
}
