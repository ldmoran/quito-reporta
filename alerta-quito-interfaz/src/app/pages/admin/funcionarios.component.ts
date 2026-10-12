import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { mensajeDeError } from '../../core/mensajes';
import { Entidad, Funcionario } from '../../core/modelos';
import { CredencialTemporalComponent } from '../../shared/credencial-temporal.component';

interface Entregable {
  usuario: string;
  clave: string;
  correoEnviado: boolean;
}

type FiltroEstado = 'TODOS' | 'A' | 'I';

/** CRUD de funcionarios: alta, edición, baja y nueva alta. Cada acción queda en la auditoría. */
@Component({
  selector: 'app-funcionarios',
  standalone: true,
  imports: [DatePipe, FormsModule, ReactiveFormsModule, CredencialTemporalComponent],
  template: `
    <div class="dashboard-section">
      <div class="section-heading">
        <div>
          <h4>Funcionarios</h4>
          <p>Personas designadas por cada entidad de respuesta para atender sus reportes.</p>
        </div>
        @if (!formAbierto()) {
          <button type="button" class="btn btn-primary btn-sm" (click)="abrirNuevo()">
            <i class="fa fa-plus-circle me-1" aria-hidden="true"></i> Nuevo funcionario
          </button>
        }
      </div>

      @if (mensaje()) {
        <div class="alert alert-success py-2" role="status">{{ mensaje() }}</div>
      }
      @if (error()) {
        <div class="alert alert-danger py-2" role="alert">{{ error() }}</div>
      }
      @if (entregable(); as c) {
        <app-credencial-temporal [usuario]="c.usuario" [clave]="c.clave" [correoEnviado]="c.correoEnviado" (cerrar)="entregable.set(null)" />
      }

      @if (formAbierto()) {
        <div class="panel-formulario">
          <h4 class="subtitulo mt-0">{{ editandoId() ? 'Editar funcionario' : 'Nuevo funcionario' }}</h4>
          <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
            <div class="row g-3">
              <div class="col-md-6">
                <label class="form-label" for="f-nombre">Nombre completo</label>
                <input id="f-nombre" class="form-control" formControlName="nombreCompleto" />
              </div>
              <div class="col-md-3">
                <label class="form-label" for="f-cedula">Cédula</label>
                <input id="f-cedula" class="form-control" formControlName="cedula" inputmode="numeric" maxlength="13" />
              </div>
              <div class="col-md-3">
                <label class="form-label" for="f-usuario">Usuario</label>
                <input id="f-usuario" class="form-control" formControlName="usuario" />
                @if (editandoId()) {
                  <div class="form-text">El usuario no se puede cambiar.</div>
                }
              </div>
              <div class="col-md-5">
                <label class="form-label" for="f-correo">Correo</label>
                <input id="f-correo" type="email" class="form-control" formControlName="correo" />
              </div>
              <div class="col-md-4">
                <label class="form-label" for="f-entidad">Entidad</label>
                <select id="f-entidad" class="form-select" formControlName="idEntidad">
                  <option [ngValue]="0" disabled>Seleccione...</option>
                  @for (e of entidades(); track e.id) {
                    <option [ngValue]="e.id">{{ e.codigo }} - {{ e.nombre }}</option>
                  }
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label" for="f-cargo">Cargo</label>
                <input id="f-cargo" class="form-control" formControlName="cargo" />
              </div>
            </div>
            @if (!editandoId()) {
              <p class="text-muted mt-3 mb-0">
                La contraseña la genera el sistema y se envía al correo. El funcionario deberá cambiarla al ingresar.
              </p>
            }
            <div class="mt-3 d-flex gap-2">
              <button class="btn btn-primary" type="submit" [disabled]="form.invalid || guardando()">
                <i class="fa fa-save me-2" aria-hidden="true"></i>{{ guardando() ? 'Guardando...' : editandoId() ? 'Guardar cambios' : 'Crear funcionario' }}
              </button>
              <button class="btn btn-secondary" type="button" (click)="cerrarForm()">Cancelar</button>
            </div>
          </form>
        </div>
      }

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
  private readonly fb = inject(FormBuilder);

  readonly funcionarios = signal<Funcionario[]>([]);
  readonly entidades = signal<Entidad[]>([]);
  readonly busqueda = signal('');
  readonly estado = signal<FiltroEstado>('TODOS');
  readonly formAbierto = signal(false);
  readonly editandoId = signal<number | null>(null);
  readonly entregable = signal<Entregable | null>(null);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly guardando = signal(false);

  readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    return this.funcionarios().filter((f) => {
      if (this.estado() !== 'TODOS' && f.estado !== this.estado()) return false;
      if (!texto) return true;
      return [f.nombreCompleto, f.usuario, f.correo, f.entidadCodigo, f.cargo ?? ''].some((v) => v.toLowerCase().includes(texto));
    });
  });

  readonly form = this.fb.nonNullable.group({
    nombreCompleto: ['', [Validators.required, Validators.maxLength(150)]],
    cedula: ['', [Validators.required, Validators.pattern(/^\d{10,13}$/)]],
    correo: ['', [Validators.required, Validators.email]],
    usuario: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]{4,50}$/)]],
    idEntidad: [0, [Validators.required, Validators.min(1)]],
    cargo: [''],
  });

  ngOnInit(): void {
    this.cargar();
    this.api.entidades().subscribe({ next: (e) => this.entidades.set(e), error: (e) => this.fallo(e) });
  }

  abrirNuevo(): void {
    this.limpiar();
    this.editandoId.set(null);
    this.form.reset({ nombreCompleto: '', cedula: '', correo: '', usuario: '', idEntidad: 0, cargo: '' });
    this.form.controls.usuario.enable();
    this.formAbierto.set(true);
  }

  editar(f: Funcionario): void {
    this.limpiar();
    this.editandoId.set(f.id);
    this.form.reset({
      nombreCompleto: f.nombreCompleto,
      cedula: f.cedula ?? '',
      correo: f.correo,
      usuario: f.usuario,
      idEntidad: f.idEntidad,
      cargo: f.cargo ?? '',
    });
    this.form.controls.usuario.disable();
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
    const v = this.form.getRawValue();
    const id = this.editandoId();

    if (id !== null) {
      this.api.actualizarFuncionario(id, { nombreCompleto: v.nombreCompleto, cedula: v.cedula, correo: v.correo, idEntidad: v.idEntidad, cargo: v.cargo }).subscribe({
        next: (f) => {
          this.mensaje.set(`Los datos de ${f.nombreCompleto} se actualizaron.`);
          this.cerrarForm();
          this.guardando.set(false);
          this.cargar();
        },
        error: (e) => this.terminarConError(e),
      });
      return;
    }
    this.api.registrarFuncionario(v).subscribe({
      next: (r) => {
        this.entregable.set({ usuario: r.funcionario.usuario, clave: r.passwordTemporal, correoEnviado: r.correoEnviado });
        this.cerrarForm();
        this.guardando.set(false);
        this.cargar();
      },
      error: (e) => this.terminarConError(e),
    });
  }

  darDeBaja(f: Funcionario): void {
    if (!confirm(`¿Dar de baja a ${f.nombreCompleto}? Ya no podrá ingresar al sistema. Podrá darlo de alta de nuevo.`)) return;
    this.limpiar();
    this.api.estadoFuncionario(f.id, false).subscribe({
      next: () => {
        this.mensaje.set(`${f.nombreCompleto} fue dado de baja.`);
        this.cargar();
      },
      error: (e) => this.fallo(e),
    });
  }

  darDeAlta(f: Funcionario): void {
    if (!confirm(`¿Dar de alta nuevamente a ${f.nombreCompleto}?`)) return;
    this.limpiar();
    this.api.estadoFuncionario(f.id, true).subscribe({
      next: () => {
        this.mensaje.set(`${f.nombreCompleto} fue dado de alta de nuevo. Conserva su usuario y contraseña; si no la recuerda, restablezca la clave.`);
        this.cargar();
      },
      error: (e) => this.fallo(e),
    });
  }

  restablecer(f: Funcionario): void {
    if (!confirm(`¿Restablecer la clave de ${f.usuario}? Se generará una temporal nueva.`)) return;
    this.limpiar();
    this.api.restablecerPassword(f.usuario).subscribe({
      next: (r) => this.entregable.set({ usuario: r.usuario, clave: r.passwordTemporal, correoEnviado: r.correoEnviado }),
      error: (e) => this.fallo(e),
    });
  }

  private cargar(): void {
    this.api.funcionarios().subscribe({ next: (f) => this.funcionarios.set(f), error: (e) => this.fallo(e) });
  }

  private terminarConError(e: unknown): void {
    this.fallo(e);
    this.guardando.set(false);
  }

  private limpiar(): void {
    this.error.set('');
    this.mensaje.set('');
  }

  private fallo(e: unknown): void {
    this.error.set(mensajeDeError(e));
  }
}
