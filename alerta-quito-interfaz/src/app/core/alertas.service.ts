import { Injectable } from '@angular/core';
import Swal from 'sweetalert2';

export type ValorCampo = string | number | boolean;
export type Valores = Record<string, ValorCampo>;

export interface CampoFormulario {
  nombre: string;
  etiqueta: string;
  tipo?: 'texto' | 'email' | 'area' | 'select' | 'casilla';
  valor?: ValorCampo;
  /** Para tipo select. El primer valor de la lista que sea '' funciona como "Seleccione...". */
  opciones?: { valor: string | number; texto: string }[];
  requerido?: boolean;
  deshabilitado?: boolean;
  maxlength?: number;
  patron?: RegExp;
  mensajePatron?: string;
  ayuda?: string;
  placeholder?: string;
  /** Ancho en columnas de 12 (6 = mitad). Por defecto 12. */
  columnas?: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;
  /** Convierte a mayúsculas mientras se escribe (para códigos). */
  mayusculas?: boolean;
}

export interface OpcionesFormulario<T> {
  titulo: string;
  subtitulo?: string;
  campos: CampoFormulario[];
  confirmar: string;
  /**
   * Se ejecuta al confirmar, con los valores ya validados. Si lanza un error el formulario NO se cierra y el
   * mensaje se muestra dentro, así la persona no pierde lo que escribió.
   */
  guardar: (valores: Valores) => Promise<T>;
  /** Para reglas que dependen de varios campos, ej.: una emergencia fuerza prioridad 1. */
  alCambiar?: (nombre: string, valores: Valores, asignar: (campo: string, valor: ValorCampo) => void) => void;
  /** Convierte el error en texto para la persona. */
  mensajeDeError?: (error: unknown) => string;
}

const COLOR_PRIMARIO = '#006699';
const COLOR_SECUNDARIO = '#6c757d';
const COLOR_PELIGRO = '#ef5350';

export function escaparHtml(texto: unknown): string {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const idCampo = (nombre: string) => `aq-campo-${nombre}`;

/**
 * Ventanas emergentes de la aplicación (SweetAlert2): confirmaciones, formularios de alta y edición, avisos y
 * detalles. Todo el sistema las usa en lugar de los cuadros feos del navegador (confirm/alert).
 */
@Injectable({ providedIn: 'root' })
export class AlertasService {
  private readonly aviso = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
  });

  async confirmar(o: { titulo: string; texto?: string; boton?: string; peligro?: boolean }): Promise<boolean> {
    const r = await Swal.fire({
      icon: o.peligro ? 'warning' : 'question',
      title: o.titulo,
      text: o.texto,
      showCancelButton: true,
      confirmButtonText: o.boton ?? 'Aceptar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: !!o.peligro,
      confirmButtonColor: o.peligro ? COLOR_PELIGRO : COLOR_PRIMARIO,
      cancelButtonColor: COLOR_SECUNDARIO,
    });
    return r.isConfirmed;
  }

  /** Aviso breve en una esquina que se cierra solo. */
  exito(mensaje: string): void {
    void this.aviso.fire({ icon: 'success', title: mensaje });
  }

  async error(mensaje: string, titulo = 'No se pudo completar'): Promise<void> {
    await Swal.fire({ icon: 'error', title: titulo, text: mensaje, confirmButtonText: 'Entendido', confirmButtonColor: COLOR_PRIMARIO });
  }

  /** Ventana informativa con HTML ya escapado por quien llama (ver `escaparHtml`). */
  async detalle(o: { titulo: string; html: string; ancho?: string }): Promise<void> {
    await Swal.fire({
      title: o.titulo,
      html: o.html,
      width: o.ancho ?? '960px',
      confirmButtonText: 'Cerrar',
      confirmButtonColor: COLOR_PRIMARIO,
      customClass: { htmlContainer: 'text-start aq-detalle' },
    });
  }

  /** Muestra la contraseña temporal una sola vez, con botón para copiarla. */
  async credencial(o: { usuario: string; clave: string; correoEnviado: boolean }): Promise<void> {
    const nota = o.correoEnviado
      ? 'También se envió por correo. La persona deberá cambiarla en su primer ingreso.'
      : 'El correo no está habilitado o no se pudo enviar: entregue la clave por un medio seguro. Se muestra una sola vez. La persona deberá cambiarla en su primer ingreso.';
    await Swal.fire({
      icon: 'success',
      title: `Credenciales de ${o.usuario}`,
      html:
        `<p class="mb-2">Contraseña temporal</p>` +
        `<div class="aq-clave"><code id="aq-clave-texto">${escaparHtml(o.clave)}</code>` +
        `<button type="button" class="btn btn-secondary btn-sm" id="aq-copiar"><i class="fa fa-clipboard me-1" aria-hidden="true"></i>Copiar</button></div>` +
        `<p class="text-muted small mt-3 mb-0">${escaparHtml(nota)}</p>`,
      confirmButtonText: 'Entendido',
      confirmButtonColor: COLOR_PRIMARIO,
      allowOutsideClick: false,
      didOpen: (popup) => {
        popup.querySelector('#aq-copiar')?.addEventListener('click', () => {
          void navigator.clipboard?.writeText(o.clave).then(() => this.exito('Contraseña copiada'));
        });
      },
    });
  }

  /**
   * Formulario en ventana emergente. Devuelve lo que devolvió `guardar`, o null si la persona canceló.
   * Valida (obligatorios, formato, largo) antes de llamar a `guardar`, y si `guardar` falla muestra el
   * mensaje dentro de la misma ventana sin cerrarla.
   */
  async formulario<T>(o: OpcionesFormulario<T>): Promise<T | null> {
    const leer = (): Valores => {
      const v: Valores = {};
      for (const c of o.campos) {
        const el = document.getElementById(idCampo(c.nombre)) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (!el) continue;
        if (c.tipo === 'casilla') v[c.nombre] = (el as HTMLInputElement).checked;
        else if (c.tipo === 'select') {
          const elegido = c.opciones?.find((op) => String(op.valor) === el.value);
          v[c.nombre] = elegido ? elegido.valor : el.value;
        } else v[c.nombre] = el.value.trim();
      }
      return v;
    };

    const validar = (v: Valores): string | null => {
      for (const c of o.campos) {
        if (c.deshabilitado) continue;
        const valor = v[c.nombre];
        const vacio = valor === '' || valor === undefined || valor === 0 || (c.tipo === 'select' && valor === '');
        if (c.requerido && vacio) return `${c.etiqueta}: es obligatorio.`;
        if (typeof valor === 'string' && valor !== '') {
          if (c.tipo === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return `${c.etiqueta}: ingrese un correo válido.`;
          if (c.patron && !c.patron.test(valor)) return `${c.etiqueta}: ${c.mensajePatron ?? 'formato inválido.'}`;
          if (c.maxlength && valor.length > c.maxlength) return `${c.etiqueta}: máximo ${c.maxlength} caracteres.`;
        }
      }
      return null;
    };

    const resultado = await Swal.fire({
      title: o.titulo,
      html: this.htmlFormulario(o),
      width: '760px',
      showCancelButton: true,
      confirmButtonText: o.confirmar,
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      confirmButtonColor: COLOR_PRIMARIO,
      cancelButtonColor: COLOR_SECUNDARIO,
      allowOutsideClick: () => !Swal.isLoading(),
      customClass: { htmlContainer: 'text-start aq-formulario' },
      focusConfirm: false,
      didOpen: (popup) => {
        const asignar = (campo: string, valor: ValorCampo) => {
          const el = popup.querySelector<HTMLInputElement>(`#${idCampo(campo)}`);
          if (!el) return;
          if (typeof valor === 'boolean') el.checked = valor;
          else el.value = String(valor);
        };
        popup.querySelectorAll<HTMLElement>('[data-aq-campo]').forEach((el) => {
          el.addEventListener('change', () => o.alCambiar?.(el.dataset['aqCampo'] ?? '', leer(), asignar));
        });
        popup.querySelectorAll<HTMLInputElement>('input[data-aq-mayusculas]').forEach((el) => {
          el.addEventListener('input', () => (el.value = el.value.toUpperCase()));
        });
        (popup.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled])') as HTMLElement | null)?.focus();
        popup.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            Swal.clickConfirm();
          }
        });
      },
      preConfirm: async () => {
        const valores = leer();
        const problema = validar(valores);
        if (problema) {
          Swal.showValidationMessage(problema);
          return false;
        }
        try {
          return { valor: await o.guardar(valores) };
        } catch (e) {
          Swal.showValidationMessage(o.mensajeDeError ? o.mensajeDeError(e) : e instanceof Error ? e.message : 'No se pudo guardar.');
          return false;
        }
      },
    });
    return resultado.isConfirmed && resultado.value ? (resultado.value as { valor: T }).valor : null;
  }

  private htmlFormulario<T>(o: OpcionesFormulario<T>): string {
    const campos = o.campos.map((c) => this.htmlCampo(c)).join('');
    const subtitulo = o.subtitulo ? `<p class="text-muted mb-3">${escaparHtml(o.subtitulo)}</p>` : '';
    return `${subtitulo}<form class="row g-3" autocomplete="off" novalidate onsubmit="return false">${campos}</form>`;
  }

  private htmlCampo(c: CampoFormulario): string {
    const id = idCampo(c.nombre);
    const columnas = c.columnas ?? 12;
    const comunes = `id="${id}" data-aq-campo="${escaparHtml(c.nombre)}"${c.deshabilitado ? ' disabled' : ''}`;
    let control: string;
    switch (c.tipo ?? 'texto') {
      case 'select': {
        const opciones = (c.opciones ?? [])
          .map((op) => `<option value="${escaparHtml(op.valor)}"${String(op.valor) === String(c.valor ?? '') ? ' selected' : ''}>${escaparHtml(op.texto)}</option>`)
          .join('');
        control = `<select class="form-select" ${comunes}>${opciones}</select>`;
        break;
      }
      case 'casilla':
        return (
          `<div class="col-12"><div class="form-check">` +
          `<input class="form-check-input" type="checkbox" ${comunes}${c.valor ? ' checked' : ''}>` +
          `<label class="form-check-label" for="${id}">${escaparHtml(c.etiqueta)}</label></div>` +
          (c.ayuda ? `<div class="form-text">${escaparHtml(c.ayuda)}</div>` : '') +
          `</div>`
        );
      case 'area':
        control = `<textarea class="form-control" rows="3" ${comunes}${c.maxlength ? ` maxlength="${c.maxlength}"` : ''}${c.placeholder ? ` placeholder="${escaparHtml(c.placeholder)}"` : ''}>${escaparHtml(c.valor ?? '')}</textarea>`;
        break;
      default:
        control =
          `<input class="form-control${c.mayusculas ? ' text-uppercase' : ''}" type="${c.tipo === 'email' ? 'email' : 'text'}" ${comunes}` +
          ` value="${escaparHtml(c.valor ?? '')}"${c.maxlength ? ` maxlength="${c.maxlength}"` : ''}` +
          `${c.placeholder ? ` placeholder="${escaparHtml(c.placeholder)}"` : ''}${c.mayusculas ? ' data-aq-mayusculas' : ''}>`;
    }
    const asterisco = c.requerido && !c.deshabilitado ? ' <span class="text-danger">*</span>' : '';
    return (
      `<div class="col-md-${columnas} col-12"><label class="form-label" for="${id}">${escaparHtml(c.etiqueta)}${asterisco}</label>` +
      `${control}${c.ayuda ? `<div class="form-text">${escaparHtml(c.ayuda)}</div>` : ''}</div>`
    );
  }
}
