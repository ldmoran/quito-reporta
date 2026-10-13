import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AlertasService, CampoFormulario, Valores } from '../../core/alertas.service';
import { ETIQUETA_PRIORIDAD, iconoTipo } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/mensajes';
import { EntidadAdmin, FormTipoIncidente, TipoIncidenteAdmin } from '../../core/modelos';
import { PrioridadChipComponent } from '../../shared/insignias.component';

type FiltroEstado = 'TODOS' | 'A' | 'I';

/**
 * Mantenimiento de tipos de incidente: a qué entidad se deriva cada uno y con qué prioridad.
 * Si mañana se necesita un tipo nuevo (por ejemplo "Inundación"), se agrega aquí sin tocar la base.
 */
@Component({
  selector: 'app-tipos-incidente',
  standalone: true,
  imports: [FormsModule, PrioridadChipComponent],
  template: `
    <div class="dashboard-section">
      <div class="section-heading">
        <div>
          <h4>Tipos de incidente</h4>
          <p>Lo que el ciudadano puede reportar, a qué entidad se deriva y con qué prioridad. Nada se borra: se desactivan.</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" (click)="nuevo()">
          <i class="fa fa-plus-circle me-1" aria-hidden="true"></i> Nuevo tipo
        </button>
      </div>

      @if (errorCarga()) {
        <div class="alert alert-danger" role="alert">{{ errorCarga() }}</div>
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
  private readonly alertas = inject(AlertasService);

  readonly tipos = signal<TipoIncidenteAdmin[]>([]);
  readonly entidades = signal<EntidadAdmin[]>([]);
  readonly busqueda = signal('');
  readonly estado = signal<FiltroEstado>('TODOS');
  readonly entidadFiltro = signal(0);
  readonly errorCarga = signal('');

  readonly icono = iconoTipo;
  readonly entidadesActivas = computed(() => this.entidades().filter((e) => e.estado === 'A'));
  readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.tipos().filter((t) => {
      if (this.estado() !== 'TODOS' && t.estado !== this.estado()) return false;
      if (this.entidadFiltro() !== 0 && t.idEntidad !== this.entidadFiltro()) return false;
      return !texto || t.nombre.toLowerCase().includes(texto);
    });
  });

  ngOnInit(): void {
    this.cargar();
  }

  async nuevo(): Promise<void> {
    const t = await this.alertas.formulario({
      titulo: 'Nuevo tipo de incidente',
      confirmar: 'Crear tipo',
      campos: this.campos(),
      alCambiar: alCambiarEmergencia,
      mensajeDeError,
      guardar: (v) => firstValueFrom(this.api.crearTipo(this.aDatos(v))),
    });
    if (!t) return;
    this.alertas.exito(`El tipo "${t.nombre}" fue creado.`);
    this.cargar();
  }

  async editar(tipo: TipoIncidenteAdmin): Promise<void> {
    const t = await this.alertas.formulario({
      titulo: 'Editar tipo de incidente',
      confirmar: 'Guardar cambios',
      campos: this.campos(tipo),
      alCambiar: alCambiarEmergencia,
      mensajeDeError,
      guardar: (v) => firstValueFrom(this.api.actualizarTipo(tipo.id, this.aDatos(v, tipo))),
    });
    if (!t) return;
    this.alertas.exito(`El tipo "${t.nombre}" fue actualizado.`);
    this.cargar();
  }

  async cambiarEstado(t: TipoIncidenteAdmin, activo: boolean): Promise<void> {
    const ok = await this.alertas.confirmar({
      titulo: `¿${activo ? 'Activar' : 'Desactivar'} "${t.nombre}"?`,
      texto: activo ? undefined : 'Dejará de aparecer en el formulario del ciudadano. Los reportes ya enviados no cambian.',
      boton: activo ? 'Sí, activar' : 'Sí, desactivar',
      peligro: !activo,
    });
    if (!ok) return;
    try {
      await firstValueFrom(this.api.estadoTipo(t.id, activo));
      this.alertas.exito(`El tipo "${t.nombre}" fue ${activo ? 'activado' : 'desactivado'}.`);
      this.cargar();
    } catch (e) {
      await this.alertas.error(mensajeDeError(e));
    }
  }

  /** Si el tipo ya tiene reportes la entidad no se puede cambiar, así que se toma del tipo original. */
  private aDatos(v: Valores, original?: TipoIncidenteAdmin): FormTipoIncidente {
    return {
      nombre: String(v['nombre']),
      idEntidad: original && original.reportes > 0 ? original.idEntidad : Number(v['idEntidad']),
      prioridadBase: Number(v['prioridadBase']),
      esEmergencia: v['esEmergencia'] === true,
    };
  }

  private campos(t?: TipoIncidenteAdmin): CampoFormulario[] {
    const bloqueada = !!t && t.reportes > 0;
    return [
      { nombre: 'nombre', etiqueta: 'Nombre', requerido: true, maxlength: 100, valor: t?.nombre ?? '', columnas: 12 },
      {
        nombre: 'idEntidad', etiqueta: 'Entidad que lo atiende', tipo: 'select', requerido: true, columnas: 7, valor: t?.idEntidad ?? '',
        deshabilitado: bloqueada,
        ayuda: bloqueada ? 'Ya tiene reportes: para pasarlo a otra entidad cree un tipo nuevo y desactive este.' : undefined,
        opciones: [{ valor: '', texto: 'Seleccione...' }, ...this.entidadesActivas().map((e) => ({ valor: e.id, texto: `${e.codigo} - ${e.nombre}` }))],
      },
      {
        nombre: 'prioridadBase', etiqueta: 'Prioridad', tipo: 'select', requerido: true, columnas: 5, valor: t?.prioridadBase ?? 3,
        opciones: [1, 2, 3, 4].map((valor) => ({ valor, texto: `${valor} - ${ETIQUETA_PRIORIDAD[valor]}` })),
      },
      {
        nombre: 'esEmergencia', etiqueta: 'Es una emergencia', tipo: 'casilla', valor: t?.esEmergencia ?? false,
        ayuda: 'Se muestra con aviso al ciudadano y pasa primero en la bandeja; implica prioridad 1 (crítica).',
      },
    ];
  }

  private cargar(): void {
    this.api.tiposAdmin().subscribe({ next: (t) => this.tipos.set(t), error: (e) => this.errorCarga.set(mensajeDeError(e)) });
    this.api.entidadesAdmin().subscribe({ next: (e) => this.entidades.set(e), error: (e) => this.errorCarga.set(mensajeDeError(e)) });
  }
}

/** Una emergencia siempre es prioridad 1: el servidor lo exige y aquí se aplica solo al marcar la casilla. */
export function alCambiarEmergencia(nombre: string, valores: Valores, asignar: (campo: string, valor: string | number | boolean) => void): void {
  if (nombre === 'esEmergencia' && valores['esEmergencia'] === true) asignar('prioridadBase', 1);
}
