import { DatePipe } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { COLOR_PRIORIDAD, ETIQUETA_ESTADO, SIGUIENTES_ESTADOS, etiquetaEstado } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/mensajes';
import { EstadoReporte, ReporteDetalle } from '../../core/modelos';
import { EstadoChipComponent, PrioridadChipComponent } from '../../shared/insignias.component';
import { MapaComponent, PuntoMapa } from '../../shared/mapa.component';

interface Foto {
  id: number;
  tipo: string;
  url: SafeUrl;
}

@Component({
  selector: 'app-reporte-detalle',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, MapaComponent, EstadoChipComponent, PrioridadChipComponent],
  template: `
    <section class="tarjeta">
      <a [routerLink]="auth.tienePerfil('FUNCIO') ? '/bandeja' : '/mis-reportes'">← Volver</a>

      @if (error() && !detalle()) {
        <p class="error" role="alert">{{ error() }}</p>
      }

      @if (detalle(); as d) {
        <div class="fila entre">
          <h1>{{ d.reporte.tipoIncidente }}</h1>
          <span class="fila">
            <app-prioridad-chip [prioridad]="d.reporte.prioridad" />
            <app-estado-chip [estado]="d.reporte.estado" />
          </span>
        </div>
        <p class="suave">
          Reporte <strong>{{ d.reporte.codigo }}</strong> · enviado a {{ d.entidadNombre }} ·
          {{ d.reporte.fechaCreacion | date: 'dd/MM/yyyy HH:mm' }} · por {{ d.ciudadano }}
        </p>
        @if (d.reporte.descripcion) {
          <p>{{ d.reporte.descripcion }}</p>
        }
        <p class="suave">
          📍 {{ d.reporte.direccion || 'Sin dirección' }}@if (d.referencia) {
            · {{ d.referencia }}
          }
        </p>
        <app-mapa [puntos]="punto()" altura="220px" />

        @if (fotos().length > 0) {
          <h2>Evidencias</h2>
          <div class="fotos">
            @for (f of fotos(); track f.id) {
              <figure>
                <img [src]="f.url" [alt]="'Foto de ' + (f.tipo === 'CREACION' ? 'el incidente' : 'la resolución')" />
                <figcaption>{{ f.tipo === 'CREACION' ? 'Reporte' : 'Resolución' }}</figcaption>
              </figure>
            }
          </div>
        }

        <h2>Seguimiento</h2>
        <ol class="linea">
          @for (h of d.historial; track $index) {
            <li>
              <strong>{{ etiqueta(h.estadoNuevo) }}</strong>
              <small>{{ h.fecha | date: 'dd/MM/yyyy HH:mm' }} · {{ h.usuario }}</small>
              @if (h.comentario) {
                <span>{{ h.comentario }}</span>
              }
            </li>
          }
        </ol>

        @if (puedeGestionar() && siguientes().length > 0) {
          <h2>Atender reporte</h2>
          <label for="nuevoEstado">Nuevo estado</label>
          <select id="nuevoEstado" [(ngModel)]="nuevoEstado">
            <option value="" disabled>Elige…</option>
            @for (e of siguientes(); track e) {
              <option [value]="e">{{ etiquetas[e] }}</option>
            }
          </select>

          <label for="comentario">Comentario (opcional)</label>
          <textarea id="comentario" [(ngModel)]="comentario" maxlength="500" rows="2"></textarea>

          @if (nuevoEstado === 'RESUELTO') {
            <label for="fotoResolucion">Foto de la solución (obligatoria)</label>
            <input id="fotoResolucion" type="file" accept="image/jpeg,image/png,image/webp" (change)="elegirFoto($event)" />
          }

          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          <button class="primario" type="button" (click)="guardar()" [disabled]="!nuevoEstado || guardando()">
            {{ guardando() ? 'Guardando…' : 'Actualizar estado' }}
          </button>
        }
      }
    </section>
  `,
})
export class ReporteDetalleComponent implements OnInit, OnDestroy {
  /** Llega de la ruta /reporte/:id (withComponentInputBinding). */
  @Input() id!: string;

  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly detalle = signal<ReporteDetalle | null>(null);
  readonly fotos = signal<Foto[]>([]);
  readonly error = signal('');
  readonly guardando = signal(false);
  readonly etiquetas = ETIQUETA_ESTADO;
  readonly etiqueta = etiquetaEstado;

  nuevoEstado: EstadoReporte | '' = '';
  comentario = '';
  private fotoResolucion: File | null = null;
  private urls: string[] = [];

  readonly puedeGestionar = computed(() => this.auth.tienePerfil('FUNCIO'));
  readonly siguientes = computed<EstadoReporte[]>(() => {
    const d = this.detalle();
    return d ? SIGUIENTES_ESTADOS[d.reporte.estado] : [];
  });
  readonly punto = computed<PuntoMapa[]>(() => {
    const r = this.detalle()?.reporte;
    return r
      ? [{ lat: r.latitud, lng: r.longitud, titulo: r.tipoIncidente, color: COLOR_PRIORIDAD[r.prioridad] ?? '#607d8b' }]
      : [];
  });

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.liberarUrls();
  }

  elegirFoto(evento: Event): void {
    this.fotoResolucion = (evento.target as HTMLInputElement).files?.[0] ?? null;
  }

  guardar(): void {
    if (!this.nuevoEstado) return;
    if (this.nuevoEstado === 'RESUELTO' && !this.fotoResolucion) {
      this.error.set('Para resolver el reporte debes subir la foto de la solución.');
      return;
    }
    this.guardando.set(true);
    this.error.set('');
    this.api.cambiarEstado(Number(this.id), this.nuevoEstado, this.comentario.trim(), this.fotoResolucion).subscribe({
      next: (d) => {
        this.nuevoEstado = '';
        this.comentario = '';
        this.fotoResolucion = null;
        this.guardando.set(false);
        this.mostrar(d);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.guardando.set(false);
      },
    });
  }

  private cargar(): void {
    this.api.detalle(Number(this.id)).subscribe({
      next: (d) => this.mostrar(d),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  private mostrar(d: ReporteDetalle): void {
    this.detalle.set(d);
    this.liberarUrls();
    this.fotos.set([]);
    for (const ev of d.evidencias) {
      this.api.archivoEvidencia(d.reporte.id, ev.id).subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.urls.push(url);
          this.fotos.update((f) => [...f, { id: ev.id, tipo: ev.tipo, url: this.sanitizer.bypassSecurityTrustUrl(url) }]);
        },
      });
    }
  }

  private liberarUrls(): void {
    this.urls.forEach((u) => URL.revokeObjectURL(u));
    this.urls = [];
  }
}
