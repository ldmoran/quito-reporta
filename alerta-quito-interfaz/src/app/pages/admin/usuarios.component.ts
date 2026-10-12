import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { mensajeDeError } from '../../core/mensajes';
import { CredencialTemporalComponent } from '../../shared/credencial-temporal.component';

interface Entregable {
  usuario: string;
  clave: string;
  correoEnviado: boolean;
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [ReactiveFormsModule, CredencialTemporalComponent],
  template: `
    <div class="dashboard-section">
      <div class="section-heading">
        <div>
          <h4>Usuarios</h4>
          <p>Desbloqueo de cuentas y restablecimiento de contraseñas (ciudadanos, funcionarios y administradores).</p>
        </div>
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

      <p class="text-muted">
        Un usuario se bloquea tras 3 intentos fallidos de ingreso. Quien olvida su contraseña puede recuperarla solo desde el
        login con el enlace que llega a su correo; esta opción es para cuando no puede hacerlo.
      </p>
      <form [formGroup]="form" (ngSubmit)="desbloquear()" novalidate class="row g-2 align-items-end">
        <div class="col-md-5">
          <label class="form-label" for="u-usuario">Nombre de usuario</label>
          <input id="u-usuario" class="form-control" formControlName="usuario" />
        </div>
        <div class="col-auto">
          <button type="submit" class="btn btn-primary" [disabled]="form.invalid">
            <i class="fa fa-unlock me-2" aria-hidden="true"></i>Desbloquear
          </button>
        </div>
        <div class="col-auto">
          <button type="button" class="btn btn-secondary" [disabled]="form.invalid" (click)="restablecer()">
            <i class="fa fa-refresh me-2" aria-hidden="true"></i>Restablecer clave
          </button>
        </div>
      </form>
    </div>
  `,
})
export class UsuariosComponent {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({ usuario: ['', Validators.required] });
  readonly entregable = signal<Entregable | null>(null);
  readonly error = signal('');
  readonly mensaje = signal('');

  desbloquear(): void {
    if (this.form.invalid) return;
    const usuario = this.form.getRawValue().usuario.trim();
    this.limpiar();
    this.api.desbloquearUsuario(usuario).subscribe({
      next: () => this.mensaje.set(`${usuario} fue desbloqueado.`),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  restablecer(): void {
    if (this.form.invalid) return;
    const usuario = this.form.getRawValue().usuario.trim();
    if (!confirm(`¿Restablecer la clave de ${usuario}? Se generará una temporal nueva.`)) return;
    this.limpiar();
    this.api.restablecerPassword(usuario).subscribe({
      next: (r) => this.entregable.set({ usuario: r.usuario, clave: r.passwordTemporal, correoEnviado: r.correoEnviado }),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  private limpiar(): void {
    this.error.set('');
    this.mensaje.set('');
  }
}
