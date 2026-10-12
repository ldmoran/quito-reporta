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
    <section class="tarjeta">
      <div class="fila entre">
        <h1>Bandeja de reportes</h1>
        <label class="casilla">
          <input type="checkbox" [checked]="incluirCerrados()" (change)="alternarCerrados($event)" />
          Incluir cerrados
        </label>
      </div>
      <p class="suave">Reportes derivados a tu entidad, las emergencias primero. Se actualiza solo cada 10 segundos.</p>

      @if (nuevasEmergencias() > 0) {
        <p class="aviso urgente" role="alert">🚨 Llegaron {{ nuevasEmergencias() }} reporte(s) de prioridad crítica.</p>
      }
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      @if (cargado() && reportes().length === 0) {
        <p class="suave">No hay reportes pendientes. 🎉</p>
      }

      @if (reportes().length > 0) {
        <app-mapa [puntos]="puntos()" (puntoClick)="abrir($event)" altura="280px" />
        <ul class="lista">
          @for (r of reportes(); track r.id) {
            <li>
              <a class="item" [class.critico]="r.prioridad === 1" [routerLink]="['/reporte', r.id]">
                <span class="icono" aria-hidden="true">{{ icono(r.tipoIncidente) }}</span>
                <span class="cuerpo">
                  <strong>{{ r.tipoIncidente }}</strong>
                  <small>{{ r.codigo }} · {{ r.fechaCreacion | date: 'dd/MM HH:mm' }} · {{ r.direccion || 'Sin dirección' }}</small>
                </span>
                <app-prioridad-chip [prioridad]="r.prioridad" />
                <app-estado-chip [estado]="r.estado" />
              </a>
            </li>
          }
        </ul>
      }
    </section>
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
      titulo: `${r.tipoIncidente} — ${etiquetaEstado(r.estado)}`,
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
