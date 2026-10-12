import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Entidad,
  EstadoReporte,
  Estadisticas,
  CredencialesTemporales,
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
