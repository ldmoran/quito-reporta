import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Entidad,
  EstadoReporte,
  Estadisticas,
  CredencialesTemporales,
  EdicionFuncionario,
  EntidadAdmin,
  FilaHistorial,
  FiltroAuditoria,
  FormEntidad,
  FormTipoIncidente,
  PaginaAuditoria,
  TipoIncidenteAdmin,
  Funcionario,
  FuncionarioCreado,
  NuevoFuncionario,
  NuevoReporte,
  ReporteDetalle,
  ReporteResumen,
  TipoIncidente,
} from './modelos';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  tiposIncidente(): Observable<TipoIncidente[]> {
    return this.http.get<TipoIncidente[]>(`${this.base}/tipos-incidente`);
  }

  entidades(): Observable<Entidad[]> {
    return this.http.get<Entidad[]>(`${this.base}/entidades`);
  }

  crearReporte(datos: NuevoReporte, foto: File): Observable<ReporteDetalle> {
    const form = new FormData();
    form.append('datos', new Blob([JSON.stringify(datos)], { type: 'application/json' }));
    form.append('foto', foto);
    return this.http.post<ReporteDetalle>(`${this.base}/reportes`, form);
  }

  misReportes(): Observable<ReporteResumen[]> {
    return this.http.get<ReporteResumen[]>(`${this.base}/reportes/mios`);
  }

  bandeja(incluirCerrados: boolean): Observable<ReporteResumen[]> {
    const params = new HttpParams().set('incluirCerrados', incluirCerrados);
    return this.http.get<ReporteResumen[]>(`${this.base}/reportes/bandeja`, { params });
  }

  detalle(id: number): Observable<ReporteDetalle> {
    return this.http.get<ReporteDetalle>(`${this.base}/reportes/${id}`);
  }

  cambiarEstado(id: number, estado: EstadoReporte, comentario: string, foto: File | null): Observable<ReporteDetalle> {
    const form = new FormData();
    form.append('estado', estado);
    if (comentario) form.append('comentario', comentario);
    if (foto) form.append('foto', foto);
    return this.http.post<ReporteDetalle>(`${this.base}/reportes/${id}/estado`, form);
  }

  /** La foto está protegida por JWT: no sirve un <img src>, se baja como blob. */
  archivoEvidencia(idReporte: number, idEvidencia: number): Observable<Blob> {
    return this.http.get(`${this.base}/reportes/${idReporte}/evidencias/${idEvidencia}/archivo`, {
      responseType: 'blob',
    });
  }

  funcionarios(): Observable<Funcionario[]> {
    return this.http.get<Funcionario[]>(`${this.base}/admin/funcionarios`);
  }

  registrarFuncionario(datos: NuevoFuncionario): Observable<FuncionarioCreado> {
    return this.http.post<FuncionarioCreado>(`${this.base}/admin/funcionarios`, datos);
  }

  actualizarFuncionario(id: number, datos: EdicionFuncionario): Observable<Funcionario> {
    return this.http.put<Funcionario>(`${this.base}/admin/funcionarios/${id}`, datos);
  }

  /** activo = false: dar de baja; activo = true: volver a dar de alta. */
  estadoFuncionario(id: number, activo: boolean): Observable<Funcionario> {
    return this.http.patch<Funcionario>(`${this.base}/admin/funcionarios/${id}/estado`, { activo });
  }

  // --- Mantenimiento: entidades y tipos de incidente
  entidadesAdmin(): Observable<EntidadAdmin[]> {
    return this.http.get<EntidadAdmin[]>(`${this.base}/admin/mantenimiento/entidades`);
  }

  crearEntidad(datos: FormEntidad): Observable<EntidadAdmin> {
    return this.http.post<EntidadAdmin>(`${this.base}/admin/mantenimiento/entidades`, datos);
  }

  actualizarEntidad(id: number, datos: FormEntidad): Observable<EntidadAdmin> {
    return this.http.put<EntidadAdmin>(`${this.base}/admin/mantenimiento/entidades/${id}`, datos);
  }

  estadoEntidad(id: number, activo: boolean): Observable<EntidadAdmin> {
    return this.http.patch<EntidadAdmin>(`${this.base}/admin/mantenimiento/entidades/${id}/estado`, { activo });
  }

  tiposAdmin(): Observable<TipoIncidenteAdmin[]> {
    return this.http.get<TipoIncidenteAdmin[]>(`${this.base}/admin/mantenimiento/tipos-incidente`);
  }

  crearTipo(datos: FormTipoIncidente): Observable<TipoIncidenteAdmin> {
    return this.http.post<TipoIncidenteAdmin>(`${this.base}/admin/mantenimiento/tipos-incidente`, datos);
  }

  actualizarTipo(id: number, datos: FormTipoIncidente): Observable<TipoIncidenteAdmin> {
    return this.http.put<TipoIncidenteAdmin>(`${this.base}/admin/mantenimiento/tipos-incidente/${id}`, datos);
  }

  estadoTipo(id: number, activo: boolean): Observable<TipoIncidenteAdmin> {
    return this.http.patch<TipoIncidenteAdmin>(`${this.base}/admin/mantenimiento/tipos-incidente/${id}/estado`, { activo });
  }

  // --- Auditoria
  auditoria(f: FiltroAuditoria): Observable<PaginaAuditoria> {
    let params = new HttpParams().set('pagina', f.pagina);
    if (f.tabla) params = params.set('tabla', f.tabla);
    if (f.accion) params = params.set('accion', f.accion);
    if (f.usuario.trim()) params = params.set('usuario', f.usuario.trim());
    return this.http.get<PaginaAuditoria>(`${this.base}/admin/auditoria`, { params });
  }

  historialAuditoria(origen: string, tabla: string, idRegistro: string): Observable<FilaHistorial[]> {
    const params = new HttpParams().set('origen', origen).set('tabla', tabla).set('idRegistro', idRegistro);
    return this.http.get<FilaHistorial[]>(`${this.base}/admin/auditoria/historial`, { params });
  }

  darDeBajaFuncionario(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/admin/funcionarios/${id}`);
  }

  desbloquearUsuario(usuario: string): Observable<void> {
    return this.http.post<void>(`${this.base}/admin/usuarios/${encodeURIComponent(usuario)}/desbloquear`, {});
  }

  restablecerPassword(usuario: string): Observable<CredencialesTemporales> {
    return this.http.post<CredencialesTemporales>(
      `${this.base}/admin/usuarios/${encodeURIComponent(usuario)}/restablecer-password`,
      {},
    );
  }

  estadisticas(): Observable<Estadisticas> {
    return this.http.get<Estadisticas>(`${this.base}/admin/estadisticas`);
  }
}
