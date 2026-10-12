import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { ETIQUETA_PRIORIDAD, iconoTipo } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/mensajes';
import { EntidadAdmin, TipoIncidenteAdmin } from '../../core/modelos';
import { PrioridadChipComponent } from '../../shared/insignias.component';

type FiltroEstado = 'TODOS' | 'A' | 'I';

/**
 * Mantenimiento de tipos de incidente: a qué entidad se deriva cada uno y con qué prioridad.
 * Si mañana se necesita un tipo nuevo (por ejemplo "Inundación"), se agrega aquí sin tocar la base.
 */
@Component({
  selector: 'app-tipos-incidente',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, PrioridadChipComponent],
  template: `
    <div class="dashboard-section">
      <div class="section-heading">
        <div>
          <h4>Tipos de incidente</h4>
          <p>Lo que el ciudadano puede reportar, a qué entidad se deriva y con qué prioridad. Nada se borra: se desactivan.</p>
        </div>
        @if (!formAbierto()) {
          <button type="button" class="btn btn-primary btn-sm" (click)="abrirNuevo()">
            <i class="fa fa-plus-circle me-1" aria-hidden="true"></i> Nuevo tipo
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
          <h4 class="subtitulo mt-0">{{ editandoId() ? 'Editar tipo de incidente' : 'Nuevo tipo de incidente' }}</h4>
          <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
            <div class="row g-3">
              <div class="col-md-5">
                <label class="form-label" for="t-nombre">Nombre</label>
                <input id="t-nombre" class="form-control" formControlName="nombre" maxlength="100" />
              </div>
              <div class="col-md-4">
                <label class="form-label" for="t-entidad">Entidad que lo atiende</label>
                <select id="t-entidad" class="form-select" formControlName="idEntidad">
                  <option [ngValue]="0" disabled>Seleccione...</option>
                  @for (e of entidadesActivas(); track e.id) {
                    <option [ngValue]="e.id">{{ e.codigo }} - {{ e.nombre }}</option>
                  }
                </select>
                @if (bloqueaEntidad()) {
                  <div class="form-text">Ya tiene reportes: para pasarlo a otra entidad cree un tipo nuevo y desactive este.</div>
                }
              </div>
              <div class="col-md-3">
                <label class="form-label" for="t-prioridad">Prioridad</label>
                <select id="t-prioridad" class="form-select" formControlName="prioridadBase">
                  @for (p of prioridades; track p.valor) {
                    <option [ngValue]="p.valor">{{ p.valor }} - {{ p.texto }}</option>
                  }
                </select>
              </div>
              <div class="col-12">
                <div class="form-check">
                  <input id="t-emergencia" class="form-check-input" type="checkbox" formControlName="esEmergencia" (change)="alCambiarEmergencia()" />
                  <label class="form-check-label" for="t-emergencia">
                    Es una emergencia (se muestra con aviso al ciudadano y pasa primero en la bandeja; implica prioridad 1)
                  </label>
                </div>
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
        <div class="col-md-4">
          <label class="form-label" for="busqueda">Buscar</label>
          <input id="busqueda" class="form-control" placeholder="Nombre del tipo" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" />
        </div>
        <div class="col-md-3">
          <label class="form-label" for="f-entidad">Entidad</label>
          <select id="f-entidad" class="form-select" [ngModel]="entidadFiltro()" (ngModelChange)="entidadFiltro.set($event)">
            <option [ngValue]="0">Todas</option>
            @for (e of entidades(); track e.id) {
              <option [ngValue]="e.id">{{ e.codigo }}</option>
            }
          </select>
        </div>
        <div class="col-md-3">
          <label class="form-label" for="f-estado">Estado</label>
          <select id="f-estado" class="form-select" [ngModel]="estado()" (ngModelChange)="estado.set($event)">
            <option value="TODOS">Todos</option>
            <option value="A">Activos</option>
            <option value="I">Inactivos</option>
          </select>
        </div>
      </div>

      <div class="custom-table">
        <table class="table align-middle tabla-apilada">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Entidad</th>
              <th>Prioridad</th>
              <th>Emergencia</th>
              <th>Reportes</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (t of visibles(); track t.id) {
              <tr [class.inactivo]="t.estado === 'I'">
                <td data-label="Tipo"><span><i [class]="icono(t.nombre) + ' me-2 text-primary'" aria-hidden="true"></i>{{ t.nombre }}</span></td>
                <td data-label="Entidad">{{ t.entidadCodigo }}</td>
                <td data-label="Prioridad"><app-prioridad-chip [prioridad]="t.prioridadBase" /></td>
                <td data-label="Emergencia">{{ t.esEmergencia ? 'Sí' : 'No' }}</td>
                <td data-label="Reportes">{{ t.reportes }}</td>
                <td data-label="Estado">{{ t.estado === 'A' ? 'Activo' : 'Inactivo' }}</td>
                <td class="text-end text-nowrap acciones-fila">
                  <button type="button" class="btn btn-secondary btn-sm me-1" (click)="editar(t)">
                    <i class="fa fa-pencil me-1" aria-hidden="true"></i>Editar
                  </button>
                  @if (t.estado === 'A') {
                    <button type="button" class="btn btn-outline-danger btn-sm" (click)="cambiarEstado(t, false)">
                      <i class="fa fa-ban me-1" aria-hidden="true"></i>Desactivar
                    </button>
                  } @else {
                    <button type="button" class="btn btn-success btn-sm" (click)="cambiarEstado(t, true)">
                      <i class="fa fa-check me-1" aria-hidden="true"></i>Activar
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="text-center text-muted py-4">No hay tipos de incidente que coincidan.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class TiposIncidenteComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly tipos = signal<TipoIncidenteAdmin[]>([]);
  readonly entidades = signal<EntidadAdmin[]>([]);
  readonly busqueda = signal('');
  readonly estado = signal<FiltroEstado>('TODOS');
  readonly entidadFiltro = signal(0);
  readonly formAbierto = signal(false);
  readonly editandoId = signal<number | null>(null);
  readonly bloqueaEntidad = signal(false);
  readonly guardando = signal(false);
  readonly error = signal('');
  readonly mensaje = signal('');

  readonly icono = iconoTipo;
  readonly prioridades = [1, 2, 3, 4].map((valor) => ({ valor, texto: ETIQUETA_PRIORIDAD[valor] }));

  readonly entidadesActivas = computed(() => this.entidades().filter((e) => e.estado === 'A'));
  readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.tipos().filter((t) => {
      if (this.estado() !== 'TODOS' && t.estado !== this.estado()) return false;
      if (this.entidadFiltro() !== 0 && t.idEntidad !== this.entidadFiltro()) return false;
      return !texto || t.nombre.toLowerCase().includes(texto);
    });
  });

  readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(100)]],
    idEntidad: [0, [Validators.required, Validators.min(1)]],
    prioridadBase: [3, [Validators.required, Validators.min(1), Validators.max(4)]],
    esEmergencia: [false],
  });

  ngOnInit(): void {
    this.cargar();
  }

  abrirNuevo(): void {
    this.limpiar();
    this.editandoId.set(null);
    this.bloqueaEntidad.set(false);
    this.form.reset({ nombre: '', idEntidad: 0, prioridadBase: 3, esEmergencia: false });
    this.form.controls.idEntidad.enable();
    this.formAbierto.set(true);
  }

  editar(t: TipoIncidenteAdmin): void {
    this.limpiar();
    this.editandoId.set(t.id);
    this.bloqueaEntidad.set(t.reportes > 0);
    this.form.reset({ nombre: t.nombre, idEntidad: t.idEntidad, prioridadBase: t.prioridadBase, esEmergencia: t.esEmergencia });
    if (t.reportes > 0) this.form.controls.idEntidad.disable();
    else this.form.controls.idEntidad.enable();
    this.formAbierto.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cerrarForm(): void {
    this.formAbierto.set(false);
    this.editandoId.set(null);
  }

  /** Una emergencia siempre es prioridad 1: el servidor lo exige y aquí se aplica solo. */
  alCambiarEmergencia(): void {
    if (this.form.controls.esEmergencia.value) this.form.controls.prioridadBase.setValue(1);
  }

  guardar(): void {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.limpiar();
    const datos = this.form.getRawValue();
    const id = this.editandoId();
    const llamada = id === null ? this.api.crearTipo(datos) : this.api.actualizarTipo(id, datos);
    llamada.subscribe({
      next: (t) => {
        this.mensaje.set(id === null ? `El tipo "${t.nombre}" fue creado.` : `El tipo "${t.nombre}" fue actualizado.`);
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

  cambiarEstado(t: TipoIncidenteAdmin, activo: boolean): void {
    const aviso = activo ? '' : ' Dejará de aparecer en el formulario del ciudadano; los reportes ya enviados no cambian.';
    if (!confirm(`¿Desea ${activo ? 'activar' : 'desactivar'} "${t.nombre}"?${aviso}`)) return;
    this.limpiar();
    this.api.estadoTipo(t.id, activo).subscribe({
      next: () => {
        this.mensaje.set(`El tipo "${t.nombre}" fue ${activo ? 'activado' : 'desactivado'}.`);
        this.cargar();
      },
      error: (err) => this.error.set(mensajeDeError(err)),
    });
  }

  private cargar(): void {
    this.api.tiposAdmin().subscribe({ next: (t) => this.tipos.set(t), error: (e) => this.error.set(mensajeDeError(e)) });
    this.api.entidadesAdmin().subscribe({ next: (e) => this.entidades.set(e), error: (e) => this.error.set(mensajeDeError(e)) });
  }

  private limpiar(): void {
    this.error.set('');
    this.mensaje.set('');
  }
}
