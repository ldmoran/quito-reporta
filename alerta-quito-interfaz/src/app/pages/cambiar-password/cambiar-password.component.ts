import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { mensajeDeError } from '../../core/mensajes';
import { claveSegura } from '../../core/validadores';
import { RequisitosClaveComponent } from '../../shared/requisitos-clave.component';

function coinciden(control: AbstractControl): ValidationErrors | null {
  const nueva = control.get('passwordNueva')?.value;
  const repetir = control.get('repetir')?.value;
  return nueva && repetir && nueva !== repetir ? { noCoinciden: true } : null;
}

@Component({
  selector: 'app-cambiar-password',
  standalone: true,
  imports: [ReactiveFormsModule, RequisitosClaveComponent],
  template: `
    <div class="dashboard-section" style="max-width: 560px">
      <div class="section-heading">
        <div>
          <h4>Cambiar contraseña</h4>
          <p>Elija una contraseña nueva que cumpla los requisitos.</p>
        </div>
      </div>

      @if (auth.sesion()?.debeCambiarPassword) {
        <div class="alert alert-warning" role="note">
          <i class="fa fa-exclamation-triangle me-2" aria-hidden="true"></i>
          Ingresó con una contraseña temporal. Por seguridad debe crear una propia para continuar.
        </div>
      }

      <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        <div class="mb-3">
          <label class="form-label" for="actual">Contraseña actual (o temporal)</label>
          <input id="actual" type="password" class="form-control" formControlName="passwordActual" autocomplete="current-password" />
        </div>
        <div class="mb-3">
          <label class="form-label" for="nueva">Contraseña nueva</label>
          <input id="nueva" type="password" class="form-control" formControlName="passwordNueva" autocomplete="new-password" />
        </div>
        <app-requisitos-clave [valor]="form.controls.passwordNueva.value" [usuario]="auth.sesion()?.usuario ?? ''" />
        <div class="mb-3">
          <label class="form-label" for="repetir">Repita la contraseña nueva</label>
          <input id="repetir" type="password" class="form-control" formControlName="repetir" autocomplete="new-password" />
          @if (form.hasError('noCoinciden') && form.controls.repetir.dirty) {
            <div class="text-danger small mt-1">Las contraseñas no coinciden.</div>
          }
        </div>

        @if (error()) {
          <div class="alert alert-danger" role="alert">{{ error() }}</div>
        }
        <button class="btn btn-primary" type="submit" [disabled]="form.invalid || cargando()">
          <i class="fa fa-save me-2" aria-hidden="true"></i>
          {{ cargando() ? 'Guardando...' : 'Guardar contraseña' }}
        </button>
      </form>
    </div>
  `,
})
export class CambiarPasswordComponent {
  readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group(
    {
      passwordActual: ['', Validators.required],
      passwordNueva: ['', [Validators.required, claveSegura(() => this.auth.sesion()?.usuario ?? '')]],
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
