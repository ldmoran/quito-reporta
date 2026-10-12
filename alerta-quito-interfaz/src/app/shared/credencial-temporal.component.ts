import { Component, EventEmitter, Input, Output } from '@angular/core';

/** Muestra una sola vez la contraseña temporal que el administrador debe entregar si el correo no se envió. */
@Component({
  selector: 'app-credencial-temporal',
  standalone: true,
  template: `
    <div class="clave-entrega" role="alert">
      <strong>Credenciales de {{ usuario }}</strong>
      <p class="mb-1 mt-2">
        Contraseña temporal: <code>{{ clave }}</code>
      </p>
      @if (correoEnviado) {
        <p class="text-muted mb-2">
          <i class="fa fa-check-circle me-1" aria-hidden="true"></i>
          También se envió por correo. La persona deberá cambiarla en su primer ingreso.
        </p>
      } @else {
        <p class="text-muted mb-2">
          El correo no está habilitado o no se pudo enviar: entregue la clave por un medio seguro. Se muestra una sola vez.
          La persona deberá cambiarla en su primer ingreso.
        </p>
      }
      <button type="button" class="btn btn-secondary btn-sm" (click)="cerrar.emit()">Entendido</button>
    </div>
  `,
})
export class CredencialTemporalComponent {
  @Input({ required: true }) usuario = '';
  @Input({ required: true }) clave = '';
  @Input() correoEnviado = false;
  @Output() cerrar = new EventEmitter<void>();
}
