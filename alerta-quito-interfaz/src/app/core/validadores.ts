import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Misma política que valida el API (PoliticaPassword.java). */
export const POLITICA = { minimo: 8, maximo: 72 } as const;

export interface RequisitoClave {
  clave: 'largo' | 'mayuscula' | 'minuscula' | 'numero' | 'simbolo' | 'espacios' | 'usuario';
  texto: string;
  cumple: boolean;
}

/** Evalúa cada regla por separado para poder mostrar cuáles faltan mientras la persona escribe. */
export function evaluarClave(valor: string, usuario = ''): RequisitoClave[] {
  const clave = valor ?? '';
  const nombre = usuario.trim().toLowerCase();
  return [
    {
      clave: 'largo',
      texto: `Entre ${POLITICA.minimo} y ${POLITICA.maximo} caracteres`,
      cumple: clave.length >= POLITICA.minimo && clave.length <= POLITICA.maximo,
    },
    { clave: 'mayuscula', texto: 'Una letra mayúscula', cumple: /\p{Lu}/u.test(clave) },
    { clave: 'minuscula', texto: 'Una letra minúscula', cumple: /\p{Ll}/u.test(clave) },
    { clave: 'numero', texto: 'Un número', cumple: /\d/.test(clave) },
    { clave: 'simbolo', texto: 'Un símbolo (* # @ $ % !)', cumple: /[^\p{L}\p{N}\s]/u.test(clave) },
    { clave: 'espacios', texto: 'Sin espacios', cumple: !/\s/.test(clave) },
    {
      clave: 'usuario',
      texto: 'No contiene el nombre de usuario',
      cumple: nombre.length < 3 || !clave.toLowerCase().includes(nombre),
    },
  ];
}

/**
 * Validador de contraseña segura. `usuario` es opcional: una función que devuelve el nombre de
 * usuario actual (por ejemplo el campo "usuario" del registro) para prohibir que la clave lo contenga.
 */
export function claveSegura(usuario: () => string = () => ''): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value as string;
    if (!valor) return null; // "obligatorio" lo revisa Validators.required
    const faltan = evaluarClave(valor, usuario()).filter((r) => !r.cumple).map((r) => r.clave);
    return faltan.length > 0 ? { claveSegura: faltan } : null;
  };
}
