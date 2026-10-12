import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { mensajeDeError } from '../../core/mensajes';
import { Entidad, Estadisticas, Funcionario } from '../../core/modelos';
import { etiquetaEstado } from '../../core/etiquetas';

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
    <section class="tarjeta">
      <h1>Administración</h1>
      <nav class="pestanas" role="tablist">
        @for (p of pestanas; track p.id) {
          <button type="button" role="tab" [class.activa]="pestana() === p.id" [attr.aria-selected]="pestana() === p.id" (click)="pestana.set(p.id)">
            {{ p.titulo }}
          </button>
        }
      </nav>

      @if (mensaje()) {
        <p class="aviso" role="status">{{ mensaje() }}</p>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      @if (entregable(); as c) {
        <div class="clave-entrega" role="alert">
          <strong>Credenciales de {{ c.usuario }}</strong>
          <p>
            Contraseña temporal: <code>{{ c.clave }}</code>
          </p>
          @if (c.correoEnviado) {
            <p class="suave">✔ También se envió por correo. La persona deberá cambiarla en su primer ingreso.</p>
          } @else {
            <p class="suave">
              El correo no está habilitado o no se pudo enviar: entrégala por un medio seguro. Se muestra una sola vez.
              La persona deberá cambiarla en su primer ingreso.
            </p>
          }
          <button type="button" (click)="entregable.set(null)">Entendido</button>
        </div>
      }

      @switch (pestana()) {
        @case ('funcionarios') {
          <h2>Nuevo funcionario</h2>
          <form [formGroup]="form" (ngSubmit)="crear()" novalidate class="rejilla-form">
            <div>
              <label for="f-nombre">Nombre completo</label>
              <input id="f-nombre" formControlName="nombreCompleto" />
            </div>
            <div>
              <label for="f-cedula">Cédula</label>
              <input id="f-cedula" formControlName="cedula" inputmode="numeric" maxlength="13" />
            </div>
            <div>
              <label for="f-correo">Correo</label>
              <input id="f-correo" type="email" formControlName="correo" />
            </div>
            <div>
              <label for="f-usuario">Usuario</label>
              <input id="f-usuario" formControlName="usuario" />
            </div>
            <div>
              <label for="f-entidad">Entidad</label>
              <select id="f-entidad" formControlName="idEntidad">
                <option [ngValue]="0" disabled>Elige…</option>
                @for (e of entidades(); track e.id) {
                  <option [ngValue]="e.id">{{ e.codigo }} — {{ e.nombre }}</option>
                }
              </select>
            </div>
            <div>
              <label for="f-cargo">Cargo</label>
              <input id="f-cargo" formControlName="cargo" />
            </div>
            <p class="suave ancho">La contraseña la genera el sistema y se envía al correo. Deberá cambiarla al ingresar.</p>
            <button class="primario" type="submit" [disabled]="form.invalid || guardando()">
              {{ guardando() ? 'Creando…' : 'Crear funcionario' }}
            </button>
          </form>

          <h2>Funcionarios</h2>
          <div class="tabla-scroll">
            <table>
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
                    <td>
                      {{ f.nombreCompleto }}<br /><small>{{ f.correo }}</small>
                    </td>
                    <td>{{ f.usuario }}</td>
                    <td>{{ f.entidadCodigo }}</td>
                    <td>{{ f.cargo }}</td>
                    <td>{{ f.estado === 'A' ? 'Activo' : 'Dado de baja' }} <small>{{ f.fechaDesignacion | date: 'dd/MM/yy' }}</small></td>
                    <td class="acciones">
                      @if (f.estado === 'A') {
                        <button type="button" (click)="restablecer(f.usuario)">Restablecer clave</button>
                        <button type="button" class="peligro" (click)="darDeBaja(f)">Dar de baja</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @case ('estadisticas') {
          @if (estadisticas(); as s) {
            <h2>{{ s.total }} reportes en total</h2>
            <h3>Por estado</h3>
            @for (fila of porEstado(); track fila.nombre) {
              <div class="fila-barra">
                <span>{{ fila.nombre }}</span>
                <div><i [style.width.%]="fila.porcentaje"></i></div>
                <b>{{ fila.valor }}</b>
              </div>
            }
            <h3>Por tipo de incidente</h3>
            @for (fila of porTipo(); track fila.nombre) {
              <div class="fila-barra">
                <span>{{ fila.nombre }}</span>
                <div><i [style.width.%]="fila.porcentaje"></i></div>
                <b>{{ fila.valor }}</b>
              </div>
            }
          } @else {
            <p class="suave">Cargando…</p>
          }
        }
        @case ('usuarios') {
          <h2>Desbloquear usuario</h2>
          <p class="suave">Un usuario se bloquea tras 3 intentos fallidos de ingreso.</p>
          <form [formGroup]="formUsuario" (ngSubmit)="desbloquear()" novalidate class="fila">
            <input formControlName="usuario" placeholder="Nombre de usuario" aria-label="Nombre de usuario" />
            <button type="submit" [disabled]="formUsuario.invalid">Desbloquear</button>
            <button type="button" [disabled]="formUsuario.invalid" (click)="restablecerDesdeFormulario()">Restablecer clave</button>
          </form>
        }
      }
    </section>
  `,
})
export class AdminComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly pestanas: { id: Pestana; titulo: string }[] = [
    { id: 'funcionarios', titulo: 'Funcionarios' },
    { id: 'estadisticas', titulo: 'Estadísticas' },
    { id: 'usuarios', titulo: 'Usuarios' },
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
    const v = this.form.getRawValue();
    this.api.registrarFuncionario(v).subscribe({
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
