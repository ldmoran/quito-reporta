import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { mensajeDeError } from '../../core/mensajes';

function coinciden(control: AbstractControl): ValidationErrors | null {
  const nueva = control.get('passwordNueva')?.value;
  const repetir = control.get('repetir')?.value;
  return nueva && repetir && nueva !== repetir ? { noCoinciden: true } : null;
}

@Component({
  selector: 'app-cambiar-password',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="tarjeta estrecha">
      <h1>Cambiar contraseña</h1>
      @if (auth.sesion()?.debeCambiarPassword) {
        <p class="aviso" role="note">
          Ingresaste con una contraseña temporal. Por seguridad debes crear una propia para continuar.
        </p>
      }

      <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        <label for="actual">Contraseña actual (o temporal)</label>
        <input id="actual" type="password" formControlName="passwordActual" autocomplete="current-password" />

        <label for="nueva">Contraseña nueva (mínimo 8 caracteres)</label>
        <input id="nueva" type="password" formControlName="passwordNueva" autocomplete="new-password" />

        <label for="repetir">Repite la contraseña nueva</label>
        <input id="repetir" type="password" formControlName="repetir" autocomplete="new-password" />
        @if (form.hasError('noCoinciden') && form.controls.repetir.dirty) {
          <small class="error">Las contraseñas no coinciden.</small>
        }

        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button class="primario" type="submit" [disabled]="form.invalid || cargando()">
          {{ cargando() ? 'Guardando…' : 'Guardar contraseña' }}
        </button>
      </form>
    </section>
  `,
})
export class CambiarPasswordComponent {
  readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group(
    {
      passwordActual: ['', Validators.required],
      passwordNueva: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      repetir: ['', Validators.required],
    },
    { validators: coinciden },
  );
  readonly error = signal('');
  readonly cargando = signal(false);

  guardar(): void {
    if (this.form.invalid) return;
    this.cargando.set(true);
    this.error.set('');
    const { passwordActual, passwordNueva } = this.form.getRawValue();
    this.auth.cambiarPassword(passwordActual, passwordNueva).subscribe({
      next: () => void this.router.navigate([this.auth.rutaInicio()]),
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }
}
