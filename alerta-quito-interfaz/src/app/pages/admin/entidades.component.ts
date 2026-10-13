import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AlertasService, CampoFormulario } from '../../core/alertas.service';
import { mensajeDeError } from '../../core/mensajes';
import { EntidadAdmin } from '../../core/modelos';

type FiltroEstado = 'TODOS' | 'A' | 'I';

/** Mantenimiento de entidades de respuesta (EPMMOP, AMT, EEQ, Policía, Bomberos y las que se agreguen). */
@Component({
  selector: 'app-entidades',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="dashboard-section">
      <div class="section-heading">
        <div>
          <h4>Entidades</h4>
          <p>Instituciones que reciben y atienden los reportes. Nada se borra: se desactivan y se pueden reactivar.</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" (click)="nueva()">
          <i class="fa fa-plus-circle me-1" aria-hidden="true"></i> Nueva entidad
        </button>
      </div>

      @if (errorCarga()) {
        <div class="alert alert-danger" role="alert">{{ errorCarga() }}</div>
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
  private readonly alertas = inject(AlertasService);

  readonly entidades = signal<EntidadAdmin[]>([]);
  readonly busqueda = signal('');
  readonly estado = signal<FiltroEstado>('TODOS');
  readonly errorCarga = signal('');

  readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.entidades().filter((e) => {
      if (this.estado() !== 'TODOS' && e.estado !== this.estado()) return false;
      return !texto || e.codigo.toLowerCase().includes(texto) || e.nombre.toLowerCase().includes(texto);
    });
  });

  ngOnInit(): void {
    this.cargar();
  }

  async nueva(): Promise<void> {
    const e = await this.alertas.formulario({
      titulo: 'Nueva entidad',
      confirmar: 'Crear entidad',
      campos: this.campos(),
      mensajeDeError,
      guardar: (v) => firstValueFrom(this.api.crearEntidad({ codigo: String(v['codigo']), nombre: String(v['nombre']), descripcion: String(v['descripcion']) })),
    });
    if (!e) return;
    this.alertas.exito(`La entidad ${e.codigo} fue creada.`);
    this.cargar();
  }

  async editar(entidad: EntidadAdmin): Promise<void> {
    const e = await this.alertas.formulario({
      titulo: `Editar entidad ${entidad.codigo}`,
      confirmar: 'Guardar cambios',
      campos: this.campos(entidad),
      mensajeDeError,
      guardar: (v) =>
        firstValueFrom(this.api.actualizarEntidad(entidad.id, { codigo: String(v['codigo']), nombre: String(v['nombre']), descripcion: String(v['descripcion']) })),
    });
    if (!e) return;
    this.alertas.exito(`La entidad ${e.codigo} fue actualizada.`);
    this.cargar();
  }

  async cambiarEstado(e: EntidadAdmin, activo: boolean): Promise<void> {
    const ok = await this.alertas.confirmar({
      titulo: `¿${activo ? 'Activar' : 'Desactivar'} la entidad ${e.codigo}?`,
      texto: activo ? undefined : 'Dejará de poder recibir reportes. Los reportes ya recibidos no cambian.',
      boton: activo ? 'Sí, activar' : 'Sí, desactivar',
      peligro: !activo,
    });
    if (!ok) return;
    try {
      await firstValueFrom(this.api.estadoEntidad(e.id, activo));
      this.alertas.exito(`La entidad ${e.codigo} fue ${activo ? 'activada' : 'desactivada'}.`);
      this.cargar();
    } catch (err) {
      await this.alertas.error(mensajeDeError(err));
    }
  }

  private campos(e?: EntidadAdmin): CampoFormulario[] {
    return [
      {
        nombre: 'codigo', etiqueta: 'Código', requerido: true, maxlength: 10, valor: e?.codigo ?? '', columnas: 4, mayusculas: true,
        patron: /^[A-Za-z0-9_]{2,10}$/, mensajePatron: 'de 2 a 10 letras, números o guion bajo.', placeholder: 'EPMMOP',
      },
      { nombre: 'nombre', etiqueta: 'Nombre', requerido: true, maxlength: 150, valor: e?.nombre ?? '', columnas: 8 },
      { nombre: 'descripcion', etiqueta: 'Descripción (opcional)', tipo: 'area', maxlength: 300, valor: e?.descripcion ?? '', placeholder: 'Calles, señalización y semáforos' },
    ];
  }

  private cargar(): void {
    this.api.entidadesAdmin().subscribe({ next: (e) => this.entidades.set(e), error: (err) => this.errorCarga.set(mensajeDeError(err)) });
  }
}
