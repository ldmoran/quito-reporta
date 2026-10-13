import { OpcionesFormulario, Valores } from '../core/alertas.service';

/**
 * Reemplazo de AlertasService para probar pantallas sin abrir ventanas reales.
 * `valores` simula lo que la persona escribió en el formulario (null = canceló).
 */
export class AlertasFalso {
  valores: Valores | null = null;
  confirmacion = true;
  ultimoFormulario?: OpcionesFormulario<unknown>;

  confirmar = jasmine.createSpy('confirmar').and.callFake(async () => this.confirmacion);
  exito = jasmine.createSpy('exito');
  error = jasmine.createSpy('error').and.resolveTo();
  detalle = jasmine.createSpy('detalle').and.resolveTo();
  credencial = jasmine.createSpy('credencial').and.resolveTo();
  formulario = jasmine.createSpy('formulario').and.callFake(async (o: OpcionesFormulario<unknown>) => {
    this.ultimoFormulario = o;
    return this.valores === null ? null : o.guardar(this.valores);
  });
}
