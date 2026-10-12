import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { mensajeDeError } from '../../core/mensajes';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="tarjeta estrecha">
      <h1>Iniciar sesión</h1>
      <p class="suave">Reporta incidentes viales y de seguridad en Quito, sin llamar por teléfono.</p>

      <form [formGroup]="form" (ngSubmit)="entrar()" novalidate>
        <label for="usuario">Usuario</label>
        <input id="usuario" formControlName="usuario" autocomplete="username" />

        <label for="password">Contraseña</label>
        <input id="password" type="password" formControlName="password" autocomplete="current-password" />

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <button class="primario" type="submit" [disabled]="form.invalid || cargando()">
          {{ cargando() ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>

      <p class="suave">¿Eres ciudadano y aún no tienes cuenta? <a routerLink="/registro">Regístrate</a></p>
    </section>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

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
