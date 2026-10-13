import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AlertasService } from '../../core/alertas.service';
import { mensajeDeError } from '../../core/mensajes';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="dashboard-section">
      <div class="section-heading">
        <div>
          <h4>Usuarios</h4>
          <p>Desbloqueo de cuentas y restablecimiento de contraseñas (ciudadanos, funcionarios y administradores).</p>
        </div>
      </div>

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
  private readonly alertas = inject(AlertasService);

  readonly form = this.fb.nonNullable.group({ usuario: ['', Validators.required] });

  async desbloquear(): Promise<void> {
    if (this.form.invalid) return;
    const usuario = this.form.getRawValue().usuario.trim();
    try {
      await firstValueFrom(this.api.desbloquearUsuario(usuario));
      this.alertas.exito(`${usuario} fue desbloqueado.`);
    } catch (e) {
      await this.alertas.error(mensajeDeError(e));
    }
  }

  async restablecer(): Promise<void> {
    if (this.form.invalid) return;
    const usuario = this.form.getRawValue().usuario.trim();
    const ok = await this.alertas.confirmar({
      titulo: `¿Restablecer la clave de ${usuario}?`,
      texto: 'Se generará una contraseña temporal nueva y deberá cambiarla al ingresar.',
      boton: 'Sí, restablecer',
    });
    if (!ok) return;
    try {
      const r = await firstValueFrom(this.api.restablecerPassword(usuario));
      await this.alertas.credencial({ usuario: r.usuario, clave: r.passwordTemporal, correoEnviado: r.correoEnviado });
    } catch (e) {
      await this.alertas.error(mensajeDeError(e));
    }
  }
}
