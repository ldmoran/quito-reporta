import { HttpErrorResponse } from '@angular/common/http';

/** Texto amigable para mostrar cuando falla una llamada al API. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'No hay conexión con el servidor. Intente de nuevo en un momento.';
    const mensaje = (error.error as { mensaje?: string } | null)?.mensaje;
    if (mensaje) return mensaje;
    if (error.status === 403) return 'No tiene permisos para realizar esta acción.';
    if (error.status === 413) return 'La foto supera el tamaño máximo de 5 MB.';
  }
  return 'Ocurrió un error inesperado.';
}
