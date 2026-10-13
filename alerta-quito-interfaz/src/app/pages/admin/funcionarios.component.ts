import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AlertasService, CampoFormulario } from '../../core/alertas.service';
import { mensajeDeError } from '../../core/mensajes';
import { Entidad, Funcionario } from '../../core/modelos';

type FiltroEstado = 'TODOS' | 'A' | 'I';

/** CRUD de funcionarios: alta, edición, baja y nueva alta. Cada acción queda en la auditoría. */
@Component({
  selector: 'app-funcionarios',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
    <div class="dashboard-section">
      <div class="section-heading">
        <div>
          <h4>Funcionarios</h4>
          <p>Personas designadas por cada entidad de respuesta para atender sus reportes.</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" (click)="nuevo()">
          <i class="fa fa-plus-circle me-1" aria-hidden="true"></i> Nuevo funcionario
        </button>
      </div>

      <div class="row g-2 mb-3 align-items-end">
        <div class="col-md-5">
          <label class="form-label" for="busqueda">Buscar</label>
          <input id="busqueda" class="form-control" placeholder="Nombre, usuario, correo o entidad" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" />
        </div>
        <div class="col-md-3">
          <label class="form-label" for="estado">Estado</label>
          <select id="estado" class="form-select" [ngModel]="estado()" (ngModelChange)="estado.set($event)">
            <option value="TODOS">Todos</option>
            <option value="A">Activos</option>
            <option value="I">Dados de baja</option>
          </select>
        </div>
        <div class="col-auto text-muted small pb-2">{{ visibles().length }} de {{ funcionarios().length }}</div>
      </div>

      @if (errorCarga()) {
        <div class="alert alert-danger" role="alert">{{ errorCarga() }}</div>
      }

      <div class="custom-table">
        <table class="table align-middle tabla-apilada">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Usuario</th>
              <th>Entidad</th>
              <th>Cargo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (f of visibles(); track f.id) {
              <tr [class.inactivo]="f.estado === 'I'">
                <td data-label="Nombre">
                  <span>{{ f.nombreCompleto }}<br /><small class="text-muted">{{ f.correo }}</small></span>
                </td>
                <td data-label="Usuario">{{ f.usuario }}</td>
                <td data-label="Entidad">{{ f.entidadCodigo }}</td>
                <td data-label="Cargo">{{ f.cargo }}</td>
                <td data-label="Estado">
                  <span>{{ f.estado === 'A' ? 'Activo' : 'Dado de baja' }}<br />
                  <small class="text-muted">{{ f.fechaDesignacion | date: 'dd/MM/yyyy' }}</small></span>
                </td>
                <td class="text-end text-nowrap acciones-fila">
                  <button type="button" class="btn btn-secondary btn-sm me-1" (click)="editar(f)">
                    <i class="fa fa-pencil me-1" aria-hidden="true"></i>Editar
                  </button>
                  @if (f.estado === 'A') {
                    <button type="button" class="btn btn-secondary btn-sm me-1" (click)="restablecer(f)">
                      <i class="fa fa-refresh me-1" aria-hidden="true"></i>Restablecer clave
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm" (click)="darDeBaja(f)">
                      <i class="fa fa-user-times me-1" aria-hidden="true"></i>Dar de baja
                    </button>
                  } @else {
                    <button type="button" class="btn btn-success btn-sm" (click)="darDeAlta(f)">
                      <i class="fa fa-user-plus me-1" aria-hidden="true"></i>Dar de alta
                    </button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="text-center text-muted py-4">No hay funcionarios que coincidan.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class FuncionariosComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly alertas = inject(AlertasService);

  readonly funcionarios = signal<Funcionario[]>([]);
  readonly entidades = signal<Entidad[]>([]);
  readonly busqueda = signal('');
  readonly estado = signal<FiltroEstado>('TODOS');
  readonly errorCarga = signal('');

  readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.funcionarios().filter((f) => {
      if (this.estado() !== 'TODOS' && f.estado !== this.estado()) return false;
      if (!texto) return true;
      return [f.nombreCompleto, f.usuario, f.correo, f.entidadCodigo, f.cargo ?? ''].some((v) => v.toLowerCase().includes(texto));
    });
  });

  ngOnInit(): void {
    this.cargar();
    this.api.entidades().subscribe({ next: (e) => this.entidades.set(e), error: (e) => this.errorCarga.set(mensajeDeError(e)) });
  }

  async nuevo(): Promise<void> {
    const resultado = await this.alertas.formulario({
      titulo: 'Nuevo funcionario',
      subtitulo: 'La contraseña la genera el sistema y se envía al correo. El funcionario deberá cambiarla al ingresar.',
      confirmar: 'Crear funcionario',
      campos: this.campos(),
      mensajeDeError,
      guardar: (v) =>
        firstValueFrom(
          this.api.registrarFuncionario({
            nombreCompleto: String(v['nombreCompleto']),
            cedula: String(v['cedula']),
            correo: String(v['correo']),
            usuario: String(v['usuario']),
            idEntidad: Number(v['idEntidad']),
            cargo: String(v['cargo']),
          }),
        ),
    });
    if (!resultado) return;
    this.cargar();
    await this.alertas.credencial({
      usuario: resultado.funcionario.usuario,
      clave: resultado.passwordTemporal,
      correoEnviado: resultado.correoEnviado,
    });
  }

  async editar(f: Funcionario): Promise<void> {
    const resultado = await this.alertas.formulario({
      titulo: 'Editar funcionario',
      confirmar: 'Guardar cambios',
      campos: this.campos(f),
      mensajeDeError,
      guardar: (v) =>
        firstValueFrom(
          this.api.actualizarFuncionario(f.id, {
            nombreCompleto: String(v['nombreCompleto']),
            cedula: String(v['cedula']),
            correo: String(v['correo']),
            idEntidad: Number(v['idEntidad']),
            cargo: String(v['cargo']),
          }),
        ),
    });
    if (!resultado) return;
    this.alertas.exito(`Los datos de ${resultado.nombreCompleto} se actualizaron.`);
    this.cargar();
  }

  async darDeBaja(f: Funcionario): Promise<void> {
    const ok = await this.alertas.confirmar({
      titulo: `¿Dar de baja a ${f.nombreCompleto}?`,
      texto: 'Ya no podrá ingresar al sistema. Podrá volver a darlo de alta cuando quiera.',
      boton: 'Sí, dar de baja',
      peligro: true,
    });
    if (ok) await this.cambiarEstado(f, false, `${f.nombreCompleto} fue dado de baja.`);
  }

  async darDeAlta(f: Funcionario): Promise<void> {
    const ok = await this.alertas.confirmar({
      titulo: `¿Dar de alta nuevamente a ${f.nombreCompleto}?`,
      texto: 'Conserva su usuario y contraseña. Si no la recuerda, restablezca la clave.',
      boton: 'Sí, dar de alta',
    });
    if (ok) await this.cambiarEstado(f, true, `${f.nombreCompleto} fue dado de alta de nuevo.`);
  }

  async restablecer(f: Funcionario): Promise<void> {
    const ok = await this.alertas.confirmar({
      titulo: `¿Restablecer la clave de ${f.usuario}?`,
      texto: 'Se generará una contraseña temporal nueva y deberá cambiarla al ingresar.',
      boton: 'Sí, restablecer',
    });
    if (!ok) return;
    try {
      const r = await firstValueFrom(this.api.restablecerPassword(f.usuario));
      await this.alertas.credencial({ usuario: r.usuario, clave: r.passwordTemporal, correoEnviado: r.correoEnviado });
    } catch (e) {
      await this.alertas.error(mensajeDeError(e));
    }
  }

  private async cambiarEstado(f: Funcionario, activo: boolean, mensaje: string): Promise<void> {
    try {
      await firstValueFrom(this.api.estadoFuncionario(f.id, activo));
      this.alertas.exito(mensaje);
      this.cargar();
    } catch (e) {
      await this.alertas.error(mensajeDeError(e));
    }
  }

  private campos(f?: Funcionario): CampoFormulario[] {
    return [
      { nombre: 'nombreCompleto', etiqueta: 'Nombre completo', requerido: true, maxlength: 150, valor: f?.nombreCompleto ?? '', columnas: 6 },
      { nombre: 'cedula', etiqueta: 'Cédula', requerido: true, maxlength: 13, valor: f?.cedula ?? '', columnas: 3, patron: /^\d{10,13}$/, mensajePatron: 'ingrese entre 10 y 13 dígitos.' },
      {
        nombre: 'usuario', etiqueta: 'Usuario', requerido: true, maxlength: 50, valor: f?.usuario ?? '', columnas: 3, deshabilitado: !!f,
        patron: /^[A-Za-z0-9._-]{4,50}$/, mensajePatron: 'de 4 a 50 caracteres: letras, números, punto, guion o guion bajo.',
        ayuda: f ? 'No se puede cambiar.' : undefined,
      },
      { nombre: 'correo', etiqueta: 'Correo', tipo: 'email', requerido: true, maxlength: 150, valor: f?.correo ?? '', columnas: 6 },
      {
        nombre: 'idEntidad', etiqueta: 'Entidad', tipo: 'select', requerido: true, columnas: 3, valor: f?.idEntidad ?? '',
        opciones: [{ valor: '', texto: 'Seleccione...' }, ...this.entidades().map((e) => ({ valor: e.id, texto: `${e.codigo} - ${e.nombre}` }))],
      },
      { nombre: 'cargo', etiqueta: 'Cargo', maxlength: 100, valor: f?.cargo ?? '', columnas: 3 },
    ];
  }

  private cargar(): void {
    this.api.funcionarios().subscribe({
      next: (f) => this.funcionarios.set(f),
      error: (e) => this.errorCarga.set(mensajeDeError(e)),
    });
  }
}
