import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { mensajeDeError } from '../../core/mensajes';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="tarjeta estrecha">
      <h1>Crear cuenta de ciudadano</h1>

      <form [formGroup]="form" (ngSubmit)="registrar()" novalidate>
        <label for="nombre">Nombre completo</label>
        <input id="nombre" formControlName="nombreCompleto" autocomplete="name" />

        <label for="cedula">Cédula</label>
        <input id="cedula" formControlName="cedula" inputmode="numeric" maxlength="13" />
        @if (invalido('cedula')) {
          <small class="error">Ingresa entre 10 y 13 dígitos.</small>
        }

        <label for="correo">Correo</label>
        <input id="correo" type="email" formControlName="correo" autocomplete="email" />
        @if (invalido('correo')) {
          <small class="error">Ingresa un correo válido.</small>
        }

        <label for="usuario">Usuario</label>
        <input id="usuario" formControlName="usuario" autocomplete="username" />
        @if (invalido('usuario')) {
          <small class="error">De 4 a 50 caracteres: letras, números, punto, guion o guion bajo.</small>
        }

        <label for="password">Contraseña (mínimo 8 caracteres)</label>
        <input id="password" type="password" formControlName="password" autocomplete="new-password" />

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }

        <button class="primario" type="submit" [disabled]="form.invalid || cargando()">
          {{ cargando() ? 'Creando…' : 'Crear cuenta' }}
        </button>
      </form>

      <p class="suave">¿Ya tienes cuenta? <a routerLink="/login">Inicia sesión</a></p>
    </section>
  `,
})
export class RegistroComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    nombreCompleto: ['', [Validators.required, Validators.maxLength(150)]],
    cedula: ['', [Validators.required, Validators.pattern(/^\d{10,13}$/)]],
    correo: ['', [Validators.required, Validators.email]],
    usuario: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]{4,50}$/)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
  });
  readonly error = signal('');
  readonly cargando = signal(false);

  invalido(campo: 'cedula' | 'correo' | 'usuario'): boolean {
    const c = this.form.controls[campo];
    return c.invalid && c.dirty;
  }

  registrar(): void {
    if (this.form.invalid) return;
    this.cargando.set(true);
    this.error.set('');
    const datos = this.form.getRawValue();
    this.auth.registrar(datos).subscribe({
      next: () =>
        this.auth.login(datos.usuario, datos.password).subscribe({
          next: () => void this.router.navigate([this.auth.rutaInicio()]),
          error: () => void this.router.navigate(['/login']),
        }),
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }
}
