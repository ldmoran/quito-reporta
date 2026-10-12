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
    <div class="dashboard-section">
      <a class="btn btn-secondary btn-sm mb-3" [routerLink]="auth.tienePerfil('FUNCIO') ? '/bandeja' : '/mis-reportes'">
        <i class="fa fa-arrow-left me-1" aria-hidden="true"></i> Volver
      </a>

      @if (error() && !detalle()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
      }

      @if (detalle(); as d) {
        <div class="section-heading">
          <div>
            <h4>{{ d.reporte.tipoIncidente }}</h4>
            <p>
              Reporte <strong>{{ d.reporte.codigo }}</strong> - enviado a {{ d.entidadNombre }} -
              {{ d.reporte.fechaCreacion | date: 'dd/MM/yyyy HH:mm' }} - por {{ d.ciudadano }}
            </p>
          </div>
          <div class="d-flex gap-2">
            <app-prioridad-chip [prioridad]="d.reporte.prioridad" />
            <app-estado-chip [estado]="d.reporte.estado" />
          </div>
        </div>

        @if (d.reporte.descripcion) {
          <p>{{ d.reporte.descripcion }}</p>
        }
        <p class="text-muted">
          <i class="fa fa-map-marker me-1" aria-hidden="true"></i>
          {{ d.reporte.direccion || 'Sin dirección' }}@if (d.referencia) {
            - {{ d.referencia }}
          }
        </p>
        <app-mapa [puntos]="punto()" altura="230px" />

        @if (fotos().length > 0) {
          <h4 class="subtitulo">Evidencias</h4>
          <div class="fotos">
            @for (f of fotos(); track f.id) {
              <figure>
                <img [src]="f.url" [alt]="'Foto de ' + (f.tipo === 'CREACION' ? 'el incidente' : 'la resolución')" />
                <figcaption>{{ f.tipo === 'CREACION' ? 'Foto del reporte' : 'Foto de la resolución' }}</figcaption>
              </figure>
            }
          </div>
        }

        <h4 class="subtitulo">Seguimiento</h4>
        <ol class="linea-tiempo">
          @for (h of d.historial; track $index) {
            <li>
              <strong>{{ etiqueta(h.estadoNuevo) }}</strong>
              <small>{{ h.fecha | date: 'dd/MM/yyyy HH:mm' }} - {{ h.usuario }}</small>
              @if (h.comentario) {
                <span>{{ h.comentario }}</span>
              }
            </li>
          }
        </ol>

        @if (puedeGestionar() && siguientes().length > 0) {
          <h4 class="subtitulo">Atender reporte</h4>
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label" for="nuevoEstado">Nuevo estado</label>
              <select id="nuevoEstado" class="form-select" [(ngModel)]="nuevoEstado">
                <option value="" disabled>Seleccione...</option>
                @for (e of siguientes(); track e) {
                  <option [value]="e">{{ etiquetas[e] }}</option>
                }
              </select>
            </div>
            <div class="col-md-8">
              <label class="form-label" for="comentario">Comentario (opcional)</label>
              <input id="comentario" class="form-control" [(ngModel)]="comentario" maxlength="500" />
            </div>
            @if (nuevoEstado === 'RESUELTO') {
              <div class="col-12">
                <label class="form-label" for="fotoResolucion">Foto de la solución (obligatoria)</label>
                <input id="fotoResolucion" class="form-control" type="file" accept="image/jpeg,image/png,image/webp" (change)="elegirFoto($event)" />
              </div>
            }
          </div>
          @if (error()) {
            <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div>
          }
          <div class="mt-3">
            <button class="btn btn-primary" type="button" (click)="guardar()" [disabled]="!nuevoEstado || guardando()">
              <i class="fa fa-save me-2" aria-hidden="true"></i>
              {{ guardando() ? 'Guardando...' : 'Actualizar estado' }}
            </button>
          </div>
        }
      }
    </div>
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
      this.error.set('Para resolver el reporte debe subir la foto de la solución.');
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
