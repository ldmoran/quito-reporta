import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { mensajeDeError } from '../../core/mensajes';
import { claveSegura } from '../../core/validadores';
import { FondoAccesoComponent } from '../../shared/fondo-acceso.component';
import { RequisitosClaveComponent } from '../../shared/requisitos-clave.component';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FondoAccesoComponent, RequisitosClaveComponent],
  template: `
    <app-fondo-acceso>
      <h1>Crear cuenta</h1>
      <p>Registro de ciudadanos para reportar incidentes.</p>

      <form [formGroup]="form" (ngSubmit)="registrar()" novalidate>
        <div class="input-group login-input">
          <span class="input-group-text"><i class="fa fa-user" aria-hidden="true"></i></span>
          <label for="nombre" class="visually-hidden">Nombre completo</label>
          <input id="nombre" class="form-control" placeholder="Nombre completo" formControlName="nombreCompleto" autocomplete="name" />
        </div>

        <div class="input-group login-input">
          <span class="input-group-text"><i class="fa fa-id-card-o" aria-hidden="true"></i></span>
          <label for="cedula" class="visually-hidden">Cédula</label>
          <input id="cedula" class="form-control" placeholder="Cédula" formControlName="cedula" inputmode="numeric" maxlength="13" />
        </div>
        @if (invalido('cedula')) {
          <small class="campo-error">Ingrese entre 10 y 13 dígitos.</small>
        }

        <div class="input-group login-input">
          <span class="input-group-text"><i class="fa fa-envelope-o" aria-hidden="true"></i></span>
          <label for="correo" class="visually-hidden">Correo</label>
          <input id="correo" type="email" class="form-control" placeholder="Correo electrónico" formControlName="correo" autocomplete="email" />
        </div>
        @if (invalido('correo')) {
          <small class="campo-error">Ingrese un correo válido.</small>
        }

        <div class="input-group login-input">
          <span class="input-group-text"><i class="fa fa-at" aria-hidden="true"></i></span>
          <label for="usuario" class="visually-hidden">Usuario</label>
          <input id="usuario" class="form-control" placeholder="Usuario" formControlName="usuario" autocomplete="username" />
        </div>
        @if (invalido('usuario')) {
          <small class="campo-error">De 4 a 50 caracteres: letras, números, punto, guion o guion bajo.</small>
        }

        <div class="input-group login-input">
          <span class="input-group-text"><i class="fa fa-key" aria-hidden="true"></i></span>
          <label for="password" class="visually-hidden">Contraseña</label>
          <input id="password" type="password" class="form-control" placeholder="Contraseña" formControlName="password" autocomplete="new-password" />
        </div>
        <app-requisitos-clave [valor]="form.controls.password.value" [usuario]="form.controls.usuario.value" />

        <button type="submit" class="btn btn-primary login-btn" [disabled]="form.invalid || cargando()">
          <i class="fa fa-user-plus me-2" aria-hidden="true"></i>
          {{ cargando() ? 'Creando...' : 'Crear cuenta' }}
        </button>

        <div class="login-help">
          ¿Ya tiene cuenta? <a routerLink="/login">Inicie sesión</a>
        </div>

        @if (error()) {
          <div class="alert alert-danger text-center mt-4" role="alert">{{ error() }}</div>
        }
      </form>
    </app-fondo-acceso>
  `,
})
export class RegistroComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly usuarioCtl = this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]{4,50}$/)]);

  readonly form = this.fb.nonNullable.group({
    nombreCompleto: ['', [Validators.required, Validators.maxLength(150)]],
    cedula: ['', [Validators.required, Validators.pattern(/^\d{10,13}$/)]],
    correo: ['', [Validators.required, Validators.email]],
    usuario: this.usuarioCtl,
    password: ['', [Validators.required, claveSegura(() => this.usuarioCtl.value)]],
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
