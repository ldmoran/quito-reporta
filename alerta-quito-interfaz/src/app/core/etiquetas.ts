import { EstadoReporte } from './modelos';

export const ETIQUETA_ESTADO: Record<EstadoReporte, string> = {
  REGISTRADO: 'Registrado',
  EN_REVISION: 'En revisión',
  EN_ATENCION: 'En atención',
  RESUELTO: 'Resuelto',
  RECHAZADO: 'Rechazado',
};

export const ETIQUETA_PRIORIDAD: Record<number, string> = {
  1: 'Crítica',
  2: 'Alta',
  3: 'Media',
  4: 'Baja',
};

/** Mismas transiciones que valida el trigger fn_reporte_antes_actualizar en la base. */
export const SIGUIENTES_ESTADOS: Record<EstadoReporte, EstadoReporte[]> = {
  REGISTRADO: ['EN_REVISION', 'EN_ATENCION', 'RECHAZADO'],
  EN_REVISION: ['EN_ATENCION', 'RECHAZADO'],
  EN_ATENCION: ['RESUELTO'],
  RESUELTO: [],
  RECHAZADO: [],
};

export const COLOR_PRIORIDAD: Record<number, string> = {
  1: '#c62828',
  2: '#ef6c00',
  3: '#f9a825',
  4: '#2e7d32',
};

/** Clase de icono (Font Awesome 4.7) por tipo de incidente: se elige tocando, sin leer (RF-06). */
export function iconoTipo(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes('bache')) return 'fa fa-road';
  if (n.includes('semaforo') || n.includes('semáforo')) return 'fa fa-exclamation-triangle';
  if (n.includes('senal') || n.includes('señal')) return 'fa fa-ban';
  if (n.includes('accidente')) return 'fa fa-car';
  if (n.includes('alumbrado')) return 'fa fa-lightbulb-o';
  if (n.includes('robo') || n.includes('asalto')) return 'fa fa-shield';
  if (n.includes('arbol') || n.includes('árbol')) return 'fa fa-tree';
  return 'fa fa-exclamation-circle';
}

export function etiquetaEstado(estado: string): string {
  return ETIQUETA_ESTADO[estado as EstadoReporte] ?? estado;
}
