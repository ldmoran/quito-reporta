import { escaparHtml } from './alertas.service';
import { FilaHistorial } from './modelos';

const COLUMNAS_FIJAS = ['id_hist', 'operacion', 'usuario_accion', 'fecha_accion'];
const ETIQUETA_ACCION: Record<string, string> = { INSERT: 'Creación', UPDATE: 'Edición', DELETE: 'Eliminación' };

export interface VistaHistorial {
  columnas: string[];
  filas: { datos: FilaHistorial; cambiados: Set<string> }[];
}

/** Columnas del registro y, por cada versión, qué campos cambiaron respecto a la anterior. */
export function armarVistaHistorial(filas: FilaHistorial[]): VistaHistorial {
  const columnas = filas.length > 0 ? Object.keys(filas[0]).filter((c) => !COLUMNAS_FIJAS.includes(c)) : [];
  return {
    columnas,
    filas: filas.map((datos, i) => ({
      datos,
      cambiados: new Set(i === 0 ? [] : columnas.filter((c) => datos[c] !== filas[i - 1][c])),
    })),
  };
}

export function nombreColumna(c: string): string {
  const texto = c.replace(/^id_/, 'ID ').replace(/_/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function valor(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return String(v);
}

function fecha(iso: unknown): string {
  const d = new Date(String(iso));
  if (isNaN(d.getTime())) return String(iso ?? '-');
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
}

/** Tabla (HTML ya escapado) con las versiones de un registro; lo que cambió respecto a la anterior va resaltado. */
export function htmlHistorial(vista: VistaHistorial): string {
  if (vista.filas.length === 0) return '<p class="text-muted mb-0">No hay versiones guardadas de este registro.</p>';
  const encabezados = vista.columnas.map((c) => `<th>${escaparHtml(nombreColumna(c))}</th>`).join('');
  const filas = vista.filas
    .map((f) => {
      const celdas = vista.columnas
        .map((c) => `<td${f.cambiados.has(c) ? ' class="cambio"' : ''}>${escaparHtml(valor(f.datos[c]))}</td>`)
        .join('');
      const accion = ETIQUETA_ACCION[String(f.datos['operacion'])] ?? String(f.datos['operacion']);
      return `<tr><td>${escaparHtml(accion)}</td><td>${escaparHtml(f.datos['usuario_accion'])}</td><td>${escaparHtml(fecha(f.datos['fecha_accion']))}</td>${celdas}</tr>`;
    })
    .join('');
  return (
    `<p class="text-muted small">Versiones guardadas del registro, de la más antigua a la más reciente. Lo que cambió respecto a la anterior aparece resaltado.</p>` +
    `<div class="custom-table"><table class="table table-sm mb-0"><thead><tr><th>Acción</th><th>Usuario</th><th>Fecha</th>${encabezados}</tr></thead><tbody>${filas}</tbody></table></div>`
  );
}
