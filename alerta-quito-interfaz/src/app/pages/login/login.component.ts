import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { MARCA } from '../../core/marca';
import { mensajeDeError } from '../../core/mensajes';
import { FondoAccesoComponent } from '../../shared/fondo-acceso.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FondoAccesoComponent],
  template: `
    <app-fondo-acceso>
      <h1>Iniciar sesión</h1>
      <p>Bienvenido, ingrese sus credenciales para continuar.</p>

      <form [formGroup]="form" (ngSubmit)="entrar()" novalidate>
        <div class="input-group login-input">
          <span class="input-group-text"><i class="fa fa-user" aria-hidden="true"></i></span>
          <label for="usuario" class="visually-hidden">Usuario</label>
          <input
            id="usuario"
            type="text"
            class="form-control"
            placeholder="Usuario"
            formControlName="usuario"
            autocomplete="username"
          />
        </div>

        <div class="input-group login-input">
          <span class="input-group-text"><i class="fa fa-key" aria-hidden="true"></i></span>
          <label for="password" class="visually-hidden">Clave</label>
          <input
            id="password"
            type="password"
            class="form-control"
            placeholder="Clave"
            formControlName="password"
            autocomplete="current-password"
          />
        </div>

        <button type="submit" class="btn btn-primary login-btn" [disabled]="form.invalid || cargando()">
          <i class="fa fa-sign-in me-2" aria-hidden="true"></i>
          {{ cargando() ? 'Ingresando...' : 'Ingresar' }}
        </button>

        <div class="login-help">
          ¿Olvidó su contraseña?<br />
          {{ ayuda }}<br />
          <a routerLink="/registro">Crear cuenta de ciudadano</a>
        </div>

        @if (error()) {
          <div class="alert alert-danger text-center mt-4" role="alert">{{ error() }}</div>
        }
      </form>
    </app-fondo-acceso>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly ayuda = MARCA.ayudaContrasena;
  readonly form = this.fb.nonNullable.group({
    usuario: ['', Validators.required],
    password: ['', Validators.required],
  });
  readonly error = signal('');
  readonly cargando = signal(false);

  entrar(): void {
    if (this.form.invalid) return;
    this.cargando.set(true);
    this.error.set('');
    const { usuario, password } = this.form.getRawValue();
    this.auth.login(usuario.trim(), password).subscribe({
      next: () => void this.router.navigate([this.auth.rutaInicio()]),
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }
}
