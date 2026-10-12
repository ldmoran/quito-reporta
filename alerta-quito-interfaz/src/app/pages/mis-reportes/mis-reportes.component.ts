import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription, interval, startWith, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { COLOR_PRIORIDAD, etiquetaEstado, iconoTipo } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/mensajes';
import { ReporteResumen } from '../../core/modelos';
import { EstadoChipComponent } from '../../shared/insignias.component';
import { MapaComponent, PuntoMapa } from '../../shared/mapa.component';

const CADA_MS = 15_000;

@Component({
  selector: 'app-mis-reportes',
  standalone: true,
  imports: [DatePipe, RouterLink, MapaComponent, EstadoChipComponent],
  template: `
    <div class="dashboard-section">
      <div class="section-heading">
        <div>
          <h4>Mis reportes</h4>
          <p>Seguimiento del estado de los incidentes que usted reportó. Se actualiza automáticamente.</p>
        </div>
        <a class="btn btn-primary btn-sm" routerLink="/nuevo-reporte">
          <i class="fa fa-plus-circle me-1" aria-hidden="true"></i> Nuevo reporte
        </a>
      </div>

      @for (aviso of avisos(); track aviso) {
        <div class="alert alert-info py-2" role="status">
          <i class="fa fa-info-circle me-2" aria-hidden="true"></i>{{ aviso }}
        </div>
      }
      @if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      }

      @if (cargado() && reportes().length === 0) {
        <p class="text-muted mb-0">Aún no ha enviado reportes.</p>
      }

      @if (reportes().length > 0) {
        <app-mapa [puntos]="puntos()" (puntoClick)="abrir($event)" altura="280px" />
        <ul class="lista-reportes">
          @for (r of reportes(); track r.id) {
            <li>
              <a class="reporte-item" [routerLink]="['/reporte', r.id]">
                <span class="icono-tipo"><i [class]="icono(r.tipoIncidente)" aria-hidden="true"></i></span>
                <span class="cuerpo">
                  <strong>{{ r.tipoIncidente }}</strong>
                  <small>{{ r.codigo }} - {{ r.fechaCreacion | date: 'dd/MM/yyyy HH:mm' }} - {{ r.entidad }}</small>
                </span>
                <app-estado-chip [estado]="r.estado" />
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class MisReportesComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly reportes = signal<ReporteResumen[]>([]);
  readonly cargado = signal(false);
  readonly error = signal('');
  readonly avisos = signal<string[]>([]);
  readonly icono = iconoTipo;

  readonly puntos = computed<PuntoMapa[]>(() =>
    this.reportes().map((r) => ({
      id: r.id,
      lat: r.latitud,
      lng: r.longitud,
      titulo: `${r.tipoIncidente} - ${etiquetaEstado(r.estado)}`,
      color: COLOR_PRIORIDAD[r.prioridad] ?? '#607d8b',
    })),
  );

  private suscripcion?: Subscription;

  /** Consulta cada 15 s y avisa cuando algún reporte cambió de estado (RF-05). */
  ngOnInit(): void {
    this.suscripcion = interval(CADA_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.api.misReportes()),
      )
      .subscribe({
        next: (nuevos) => {
          this.detectarCambios(this.reportes(), nuevos);
          this.reportes.set(nuevos);
          this.cargado.set(true);
          this.error.set('');
        },
        error: (e) => {
          this.error.set(mensajeDeError(e));
          this.cargado.set(true);
        },
      });
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
  }

  abrir(id: number): void {
    void this.router.navigate(['/reporte', id]);
  }

  private detectarCambios(antes: ReporteResumen[], despues: ReporteResumen[]): void {
    if (antes.length === 0) return;
    const previos = new Map(antes.map((r) => [r.id, r.estado]));
    const cambios = despues
      .filter((r) => previos.has(r.id) && previos.get(r.id) !== r.estado)
      .map((r) => `Su reporte ${r.codigo} (${r.tipoIncidente}) ahora está: ${etiquetaEstado(r.estado)}.`);
    if (cambios.length > 0) this.avisos.update((a) => [...cambios, ...a].slice(0, 5));
  }
}
