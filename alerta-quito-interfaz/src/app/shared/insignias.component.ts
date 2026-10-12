import { Component, Input } from '@angular/core';
import { ETIQUETA_ESTADO, ETIQUETA_PRIORIDAD } from '../core/etiquetas';
import { EstadoReporte } from '../core/modelos';

@Component({
  selector: 'app-estado-chip',
  standalone: true,
  template: `<span [class]="'etiqueta estado-' + estado">{{ etiqueta }}</span>`,
})
export class EstadoChipComponent {
  @Input({ required: true }) estado!: EstadoReporte;

  get etiqueta(): string {
    return ETIQUETA_ESTADO[this.estado] ?? this.estado;
  }
}

@Component({
  selector: 'app-prioridad-chip',
  standalone: true,
  template: `<span [class]="'etiqueta prioridad-' + prioridad">{{ etiqueta }}</span>`,
})
export class PrioridadChipComponent {
  @Input({ required: true }) prioridad!: number;

  get etiqueta(): string {
    return ETIQUETA_PRIORIDAD[this.prioridad] ?? String(this.prioridad);
  }
}
