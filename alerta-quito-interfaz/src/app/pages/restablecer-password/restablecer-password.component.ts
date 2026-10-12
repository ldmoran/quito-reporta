import { Component, Input, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { mensajeDeError } from '../../core/mensajes';
import { claveSegura } from '../../core/validadores';
import { FondoAccesoComponent } from '../../shared/fondo-acceso.component';
import { RequisitosClaveComponent } from '../../shared/requisitos-clave.component';

function coinciden(control: AbstractControl): ValidationErrors | null {
  const nueva = control.get('passwordNueva')?.value;
  const repetir = control.get('repetir')?.value;
  return nueva && repetir && nueva !== repetir ? { noCoinciden: true } : null;
}

/** Destino del enlace del correo: /restablecer?token=... */
@Component({
  selector: 'app-restablecer-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FondoAccesoComponent, RequisitosClaveComponent],
  template: `
    <app-fondo-acceso>
      <h1>Nueva contraseña</h1>

      @if (listo()) {
        <div class="alert alert-success" role="status">
          <i class="fa fa-check-circle me-2" aria-hidden="true"></i>{{ mensaje() }}
        </div>
        <a class="btn btn-primary login-btn" routerLink="/login"><i class="fa fa-sign-in me-2" aria-hidden="true"></i>Iniciar sesión</a>
      } @else if (!token) {
        <div class="alert alert-danger" role="alert">El enlace no es válido. Solicite uno nuevo desde "¿Olvidó su contraseña?".</div>
        <div class="login-help"><a routerLink="/olvide-password">Solicitar un enlace nuevo</a></div>
      } @else {
        <p>Elija una contraseña nueva que cumpla los requisitos.</p>
        <form [formGroup]="form" (ngSubmit)="guardar()" novalidate>
          <div class="input-group login-input">
            <span class="input-group-text"><i class="fa fa-key" aria-hidden="true"></i></span>
            <label for="nueva" class="visually-hidden">Contraseña nueva</label>
            <input id="nueva" type="password" class="form-control" placeholder="Contraseña nueva" formControlName="passwordNueva" autocomplete="new-password" />
          </div>
          <app-requisitos-clave [valor]="form.controls.passwordNueva.value" />
          <div class="input-group login-input">
            <span class="input-group-text"><i class="fa fa-lock" aria-hidden="true"></i></span>
            <label for="repetir" class="visually-hidden">Repita la contraseña</label>
            <input id="repetir" type="password" class="form-control" placeholder="Repita la contraseña" formControlName="repetir" autocomplete="new-password" />
          </div>
          @if (form.hasError('noCoinciden') && form.controls.repetir.dirty) {
            <small class="campo-error">Las contraseñas no coinciden.</small>
          }

          <button type="submit" class="btn btn-primary login-btn" [disabled]="form.invalid || cargando()">
            <i class="fa fa-save me-2" aria-hidden="true"></i>{{ cargando() ? 'Guardando...' : 'Guardar' }}
          </button>
          @if (error()) {
            <div class="alert alert-danger text-center" role="alert">
              {{ error() }}
              <div class="mt-1"><a routerLink="/olvide-password">Solicitar un enlace nuevo</a></div>
            </div>
          }
        </form>
      }
    </app-fondo-acceso>
  `,
})
export class RestablecerPasswordComponent {
  /** Llega del parámetro ?token= de la URL (withComponentInputBinding). */
  @Input() token = '';

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly form = this.fb.nonNullable.group(
    {
      passwordNueva: ['', [Validators.required, claveSegura()]],
      repetir: ['', Validators.required],
    },
    { validators: coinciden },
  );
  readonly cargando = signal(false);
  readonly listo = signal(false);
  readonly mensaje = signal('');
  readonly error = signal('');

  guardar(): void {
    if (this.form.invalid || !this.token) return;
    this.cargando.set(true);
    this.error.set('');
    this.auth.restablecerPassword(this.token, this.form.getRawValue().passwordNueva).subscribe({
      next: (r) => {
        this.mensaje.set(r.mensaje);
        this.listo.set(true);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }
}
