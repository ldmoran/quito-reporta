import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription, interval, startWith, switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { COLOR_PRIORIDAD, etiquetaEstado, iconoTipo } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/mensajes';
import { ReporteResumen } from '../../core/modelos';
import { EstadoChipComponent, PrioridadChipComponent } from '../../shared/insignias.component';
import { MapaComponent, PuntoMapa } from '../../shared/mapa.component';

const CADA_MS = 10_000;

@Component({
  selector: 'app-bandeja',
  standalone: true,
  imports: [DatePipe, RouterLink, MapaComponent, EstadoChipComponent, PrioridadChipComponent],
  template: `
    <div class="dashboard-section">
      <div class="section-heading">
        <div>
          <h4>Bandeja de reportes</h4>
          <p>Reportes derivados a su entidad, con las emergencias primero. Se actualiza cada 10 segundos.</p>
        </div>
        <div class="form-check">
          <input class="form-check-input" type="checkbox" id="cerrados" [checked]="incluirCerrados()" (change)="alternarCerrados($event)" />
          <label class="form-check-label" for="cerrados">Incluir cerrados</label>
        </div>
      </div>

      @if (nuevasEmergencias() > 0) {
        <div class="alert alert-danger py-2" role="alert">
          <i class="fa fa-bell me-2" aria-hidden="true"></i>
          Llegaron {{ nuevasEmergencias() }} reporte(s) de prioridad crítica.
        </div>
      }
      @if (error()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      }
      @if (cargado() && reportes().length === 0) {
        <p class="text-muted mb-0">No hay reportes pendientes.</p>
      }

      @if (reportes().length > 0) {
        <app-mapa [puntos]="puntos()" (puntoClick)="abrir($event)" altura="280px" />
        <ul class="lista-reportes">
          @for (r of reportes(); track r.id) {
            <li>
              <a class="reporte-item" [class.critico]="r.prioridad === 1" [routerLink]="['/reporte', r.id]">
                <span class="icono-tipo"><i [class]="icono(r.tipoIncidente)" aria-hidden="true"></i></span>
                <span class="cuerpo">
                  <strong>{{ r.tipoIncidente }}</strong>
                  <small>{{ r.codigo }} - {{ r.fechaCreacion | date: 'dd/MM HH:mm' }} - {{ r.direccion || 'Sin dirección' }}</small>
                </span>
                <app-prioridad-chip [prioridad]="r.prioridad" />
                <app-estado-chip [estado]="r.estado" />
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class BandejaComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly reportes = signal<ReporteResumen[]>([]);
  readonly incluirCerrados = signal(false);
  readonly cargado = signal(false);
  readonly error = signal('');
  readonly nuevasEmergencias = signal(0);
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
  private conocidos = new Set<number>();

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.suscripcion?.unsubscribe();
  }

  alternarCerrados(evento: Event): void {
    this.incluirCerrados.set((evento.target as HTMLInputElement).checked);
    this.cargar();
  }

  abrir(id: number): void {
    void this.router.navigate(['/reporte', id]);
  }

  private cargar(): void {
    this.suscripcion?.unsubscribe();
    this.suscripcion = interval(CADA_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.api.bandeja(this.incluirCerrados())),
      )
      .subscribe({
        next: (lista) => {
          if (this.cargado()) {
            const nuevas = lista.filter((r) => r.prioridad === 1 && !this.conocidos.has(r.id)).length;
            if (nuevas > 0) this.nuevasEmergencias.update((n) => n + nuevas);
          }
          this.conocidos = new Set(lista.map((r) => r.id));
          this.reportes.set(lista);
          this.cargado.set(true);
          this.error.set('');
        },
        error: (e) => {
          this.error.set(mensajeDeError(e));
          this.cargado.set(true);
        },
      });
  }
}
