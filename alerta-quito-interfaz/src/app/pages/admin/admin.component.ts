import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { etiquetaEstado } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/mensajes';
import { Entidad, Estadisticas, Funcionario } from '../../core/modelos';

interface ClaveEntregable {
  usuario: string;
  clave: string;
  correoEnviado: boolean;
}

type Pestana = 'funcionarios' | 'estadisticas' | 'usuarios';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule],
  template: `
    <div class="dashboard-section">
      <div class="section-heading">
        <div>
          <h4>Administración</h4>
          <p>Funcionarios designados por las entidades, usuarios y estadísticas del sistema.</p>
        </div>
      </div>

      <ul class="nav nav-tabs mb-3" role="tablist">
        @for (p of pestanas; track p.id) {
          <li class="nav-item" role="presentation">
            <button
              type="button"
              class="nav-link"
              role="tab"
              [class.active]="pestana() === p.id"
              [attr.aria-selected]="pestana() === p.id"
              (click)="pestana.set(p.id)"
            >
              <i [class]="p.icono + ' me-2'" aria-hidden="true"></i>{{ p.titulo }}
            </button>
          </li>
        }
      </ul>

      @if (mensaje()) {
        <div class="alert alert-success py-2" role="status">{{ mensaje() }}</div>
      }
      @if (error()) {
        <div class="alert alert-danger py-2" role="alert">{{ error() }}</div>
      }

      @if (entregable(); as c) {
        <div class="clave-entrega" role="alert">
          <strong>Credenciales de {{ c.usuario }}</strong>
          <p class="mb-1 mt-2">
            Contraseña temporal: <code>{{ c.clave }}</code>
          </p>
          @if (c.correoEnviado) {
            <p class="text-muted mb-2">
              <i class="fa fa-check-circle me-1" aria-hidden="true"></i>
              También se envió por correo. La persona deberá cambiarla en su primer ingreso.
            </p>
          } @else {
            <p class="text-muted mb-2">
              El correo no está habilitado o no se pudo enviar: entregue la clave por un medio seguro. Se muestra una sola vez.
              La persona deberá cambiarla en su primer ingreso.
            </p>
          }
          <button type="button" class="btn btn-secondary btn-sm" (click)="entregable.set(null)">Entendido</button>
        </div>
      }

      @switch (pestana()) {
        @case ('funcionarios') {
          <h4 class="subtitulo">Nuevo funcionario</h4>
          <form [formGroup]="form" (ngSubmit)="crear()" novalidate>
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
            <p class="text-muted mt-3 mb-2">
              La contraseña la genera el sistema y se envía al correo. El funcionario deberá cambiarla al ingresar.
            </p>
            <button class="btn btn-primary" type="submit" [disabled]="form.invalid || guardando()">
              <i class="fa fa-user-plus me-2" aria-hidden="true"></i>{{ guardando() ? 'Creando...' : 'Crear funcionario' }}
            </button>
          </form>

          <h4 class="subtitulo">Funcionarios registrados</h4>
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
                @for (f of funcionarios(); track f.id) {
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
                      @if (f.estado === 'A') {
                        <button type="button" class="btn btn-secondary btn-sm me-1" (click)="restablecer(f.usuario)">
                          <i class="fa fa-refresh me-1" aria-hidden="true"></i>Restablecer clave
                        </button>
                        <button type="button" class="btn btn-outline-danger btn-sm" (click)="darDeBaja(f)">
                          <i class="fa fa-user-times me-1" aria-hidden="true"></i>Dar de baja
                        </button>
                      }
                    </td>
                  </tr>
                }
                @if (funcionarios().length === 0) {
                  <tr>
                    <td colspan="6" class="text-center text-muted py-4">No hay funcionarios registrados.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @case ('estadisticas') {
          @if (estadisticas(); as s) {
            <h4 class="subtitulo">Total de reportes: {{ s.total }}</h4>
            <h5 class="mt-3">Por estado</h5>
            @for (fila of porEstado(); track fila.nombre) {
              <div class="fila-barra">
                <span>{{ fila.nombre }}</span>
                <div><i [style.width.%]="fila.porcentaje"></i></div>
                <strong>{{ fila.valor }}</strong>
              </div>
            }
            <h5 class="mt-4">Por tipo de incidente</h5>
            @for (fila of porTipo(); track fila.nombre) {
              <div class="fila-barra">
                <span>{{ fila.nombre }}</span>
                <div><i [style.width.%]="fila.porcentaje"></i></div>
                <strong>{{ fila.valor }}</strong>
              </div>
            }
          } @else {
            <p class="text-muted">Cargando...</p>
          }
        }
        @case ('usuarios') {
          <h4 class="subtitulo">Desbloqueo y restablecimiento de contraseña</h4>
          <p class="text-muted">Un usuario se bloquea tras 3 intentos fallidos de ingreso.</p>
          <form [formGroup]="formUsuario" (ngSubmit)="desbloquear()" novalidate class="row g-2 align-items-end">
            <div class="col-md-5">
              <label class="form-label" for="u-usuario">Nombre de usuario</label>
              <input id="u-usuario" class="form-control" formControlName="usuario" />
            </div>
            <div class="col-auto">
              <button type="submit" class="btn btn-primary" [disabled]="formUsuario.invalid">
                <i class="fa fa-unlock me-2" aria-hidden="true"></i>Desbloquear
              </button>
            </div>
            <div class="col-auto">
              <button type="button" class="btn btn-secondary" [disabled]="formUsuario.invalid" (click)="restablecerDesdeFormulario()">
                <i class="fa fa-refresh me-2" aria-hidden="true"></i>Restablecer clave
              </button>
            </div>
          </form>
        }
      }
    </div>
  `,
})
export class AdminComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly pestanas: { id: Pestana; titulo: string; icono: string }[] = [
    { id: 'funcionarios', titulo: 'Funcionarios', icono: 'fa fa-users' },
    { id: 'estadisticas', titulo: 'Estadísticas', icono: 'fa fa-bar-chart' },
    { id: 'usuarios', titulo: 'Usuarios', icono: 'fa fa-key' },
  ];
  readonly pestana = signal<Pestana>('funcionarios');
  readonly funcionarios = signal<Funcionario[]>([]);
  readonly entidades = signal<Entidad[]>([]);
  readonly estadisticas = signal<Estadisticas | null>(null);
  readonly entregable = signal<ClaveEntregable | null>(null);
  readonly error = signal('');
  readonly mensaje = signal('');
  readonly guardando = signal(false);

  readonly porEstado = computed(() => this.filas(this.estadisticas()?.porEstado ?? {}, etiquetaEstado));
  readonly porTipo = computed(() => this.filas(this.estadisticas()?.porTipo ?? {}, (n) => n));

  readonly form = this.fb.nonNullable.group({
    nombreCompleto: ['', [Validators.required, Validators.maxLength(150)]],
    cedula: ['', [Validators.required, Validators.pattern(/^\d{10,13}$/)]],
    correo: ['', [Validators.required, Validators.email]],
    usuario: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]{4,50}$/)]],
    idEntidad: [0, [Validators.required, Validators.min(1)]],
    cargo: [''],
  });
  readonly formUsuario = this.fb.nonNullable.group({ usuario: ['', Validators.required] });

  ngOnInit(): void {
    this.cargarFuncionarios();
    this.api.entidades().subscribe({ next: (e) => this.entidades.set(e), error: (e) => this.fallo(e) });
    this.api.estadisticas().subscribe({ next: (s) => this.estadisticas.set(s), error: (e) => this.fallo(e) });
  }

  crear(): void {
    if (this.form.invalid) return;
    this.guardando.set(true);
    this.limpiar();
    this.api.registrarFuncionario(this.form.getRawValue()).subscribe({
      next: (r) => {
        this.entregable.set({ usuario: r.funcionario.usuario, clave: r.passwordTemporal, correoEnviado: r.correoEnviado });
        this.form.reset({ nombreCompleto: '', cedula: '', correo: '', usuario: '', idEntidad: 0, cargo: '' });
        this.guardando.set(false);
        this.cargarFuncionarios();
      },
      error: (e) => {
        this.fallo(e);
        this.guardando.set(false);
      },
    });
  }

  darDeBaja(f: Funcionario): void {
    if (!confirm(`¿Dar de baja a ${f.nombreCompleto}? Ya no podrá ingresar al sistema.`)) return;
    this.limpiar();
    this.api.darDeBajaFuncionario(f.id).subscribe({
      next: () => {
        this.mensaje.set(`${f.nombreCompleto} fue dado de baja.`);
        this.cargarFuncionarios();
      },
      error: (e) => this.fallo(e),
    });
  }

  restablecer(usuario: string): void {
    if (!confirm(`¿Restablecer la clave de ${usuario}? Se generará una temporal nueva.`)) return;
    this.limpiar();
    this.api.restablecerPassword(usuario).subscribe({
      next: (r) => this.entregable.set({ usuario: r.usuario, clave: r.passwordTemporal, correoEnviado: r.correoEnviado }),
      error: (e) => this.fallo(e),
    });
  }

  restablecerDesdeFormulario(): void {
    if (this.formUsuario.valid) this.restablecer(this.formUsuario.getRawValue().usuario.trim());
  }

  desbloquear(): void {
    if (this.formUsuario.invalid) return;
    const usuario = this.formUsuario.getRawValue().usuario.trim();
    this.limpiar();
    this.api.desbloquearUsuario(usuario).subscribe({
      next: () => this.mensaje.set(`${usuario} fue desbloqueado.`),
      error: (e) => this.fallo(e),
    });
  }

  private cargarFuncionarios(): void {
    this.api.funcionarios().subscribe({ next: (f) => this.funcionarios.set(f), error: (e) => this.fallo(e) });
  }

  private filas(datos: Record<string, number>, etiqueta: (n: string) => string) {
    const maximo = Math.max(1, ...Object.values(datos));
    return Object.entries(datos).map(([nombre, valor]) => ({
      nombre: etiqueta(nombre),
      valor,
      porcentaje: (valor / maximo) * 100,
    }));
  }

  private limpiar(): void {
    this.error.set('');
    this.mensaje.set('');
  }

  private fallo(e: unknown): void {
    this.error.set(mensajeDeError(e));
  }
}
