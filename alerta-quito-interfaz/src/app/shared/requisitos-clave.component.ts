import { Component, Input } from '@angular/core';
import { evaluarClave } from '../core/validadores';

/** Lista de reglas de la contraseña que se va marcando mientras la persona escribe. */
@Component({
  selector: 'app-requisitos-clave',
  standalone: true,
  template: `
    <ul class="requisitos-clave" aria-label="Requisitos de la contraseña">
      @for (r of requisitos; track r.clave) {
        <li [class.cumple]="r.cumple">
          <i [class]="r.cumple ? 'fa fa-check-circle' : 'fa fa-circle-o'" aria-hidden="true"></i>
          <span>{{ r.texto }}</span>
          <span class="visually-hidden">{{ r.cumple ? '(cumple)' : '(falta)' }}</span>
        </li>
      }
    </ul>
  `,
  styles: [
    `
      .requisitos-clave {
        list-style: none;
        margin: 0 0 14px;
        padding: 0;
        display: grid;
        gap: 2px;
        font-size: 0.82rem;
        color: #6c757d;
      }
      .requisitos-clave li {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .requisitos-clave li.cumple {
        color: #2e7d32;
      }
    `,
  ],
})
export class RequisitosClaveComponent {
  @Input() valor = '';
  @Input() usuario = '';

  get requisitos() {
    return evaluarClave(this.valor, this.usuario);
  }
}
