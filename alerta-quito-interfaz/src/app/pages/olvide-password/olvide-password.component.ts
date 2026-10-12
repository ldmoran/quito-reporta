import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { mensajeDeError } from '../../core/mensajes';
import { FondoAccesoComponent } from '../../shared/fondo-acceso.component';

/** "¿Olvidó su contraseña?": pide un enlace por correo para elegir una nueva. */
@Component({
  selector: 'app-olvide-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FondoAccesoComponent],
  template: `
    <app-fondo-acceso>
      <h1>Recuperar contraseña</h1>
      <p>Escriba su usuario o su correo. Le enviaremos un enlace para elegir una contraseña nueva.</p>

      @if (!enviado()) {
        <form [formGroup]="form" (ngSubmit)="enviar()" novalidate>
          <div class="input-group login-input">
            <span class="input-group-text"><i class="fa fa-user" aria-hidden="true"></i></span>
            <label for="identificador" class="visually-hidden">Usuario o correo</label>
            <input
              id="identificador"
              type="text"
              class="form-control"
              placeholder="Usuario o correo"
              formControlName="identificador"
              autocomplete="username"
            />
          </div>

          <button type="submit" class="btn btn-primary login-btn" [disabled]="form.invalid || cargando()">
            <i class="fa fa-envelope-o me-2" aria-hidden="true"></i>
            {{ cargando() ? 'Enviando...' : 'Enviar enlace' }}
          </button>
        </form>
      } @else {
        <div class="alert alert-success" role="status">
          <i class="fa fa-check-circle me-2" aria-hidden="true"></i>{{ mensaje() }}
        </div>
        <p class="small text-muted">Revise también la carpeta de correo no deseado. Si no le llega, pida al administrador que restablezca su clave.</p>
      }

      @if (error()) {
        <div class="alert alert-danger text-center mt-3" role="alert">{{ error() }}</div>
      }

      <div class="login-help mt-3"><a routerLink="/login">Volver a iniciar sesión</a></div>
    </app-fondo-acceso>
  `,
})
export class OlvidePasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly form = this.fb.nonNullable.group({ identificador: ['', [Validators.required, Validators.maxLength(150)]] });
  readonly cargando = signal(false);
  readonly enviado = signal(false);
  readonly mensaje = signal('');
  readonly error = signal('');

  enviar(): void {
    if (this.form.invalid) return;
    this.cargando.set(true);
    this.error.set('');
    this.auth.olvidePassword(this.form.getRawValue().identificador.trim()).subscribe({
      next: (r) => {
        this.mensaje.set(r.mensaje);
        this.enviado.set(true);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }
}
