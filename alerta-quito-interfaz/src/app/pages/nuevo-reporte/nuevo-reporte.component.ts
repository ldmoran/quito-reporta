import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { iconoTipo } from '../../core/etiquetas';
import { mensajeDeError } from '../../core/mensajes';
import { TipoIncidente } from '../../core/modelos';
import { Coordenada, MapaComponent, estaEnQuito } from '../../shared/mapa.component';

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-nuevo-reporte',
  standalone: true,
  imports: [FormsModule, MapaComponent],
  template: `
    <div class="dashboard-section">
      <div class="section-heading">
        <div>
          <h4>Nuevo reporte</h4>
          <p>Elija qué ocurrió, marque el lugar en el mapa y adjunte una foto. El reporte se envía a la entidad competente.</p>
        </div>
      </div>

      <h4 class="subtitulo">1. Tipo de incidente</h4>
      <div class="rejilla-tipos" role="radiogroup" aria-label="Tipo de incidente">
        @for (t of tipos(); track t.id) {
          <button
            type="button"
            role="radio"
            class="tipo-opcion"
            [class.elegido]="tipo()?.id === t.id"
            [class.emergencia]="t.esEmergencia"
            [attr.aria-checked]="tipo()?.id === t.id"
            (click)="tipo.set(t)"
          >
            <i [class]="icono(t.nombre)" aria-hidden="true"></i>
            <span class="fw-semibold">{{ t.nombre }}</span>
            <small>{{ t.entidadCodigo }}{{ t.esEmergencia ? ' - Emergencia' : '' }}</small>
          </button>
        }
      </div>
      @if (tipo()?.esEmergencia) {
        <div class="alert alert-warning mt-3 mb-0" role="note">
          <i class="fa fa-exclamation-triangle me-2" aria-hidden="true"></i>
          Este incidente se trata como emergencia y llega primero a la entidad. Si hay peligro inmediato, llame también al 911.
        </div>
      }

      <h4 class="subtitulo">2. Ubicación</h4>
      <app-mapa [seleccionable]="true" [seleccion]="ubicacion()" (seleccionado)="elegirUbicacion($event)" />
      <div class="d-flex flex-wrap align-items-center gap-3 mt-2">
        <button type="button" class="btn btn-secondary btn-sm" (click)="usarMiUbicacion()">
          <i class="fa fa-crosshairs me-1" aria-hidden="true"></i> Usar mi ubicación
        </button>
        @if (ubicacion(); as u) {
          <span class="text-muted">Lat {{ u.lat.toFixed(5) }} / Lng {{ u.lng.toFixed(5) }}</span>
        } @else {
          <span class="text-muted">Haga clic en el mapa para marcar el lugar.</span>
        }
      </div>
      <div class="row g-3 mt-1">
        <div class="col-md-6">
          <label class="form-label" for="direccion">Dirección o calles cercanas (opcional)</label>
          <input id="direccion" class="form-control" [(ngModel)]="direccion" maxlength="250" placeholder="Av. 10 de Agosto y Colón" />
        </div>
        <div class="col-md-6">
          <label class="form-label" for="referencia">Referencia (opcional)</label>
          <input id="referencia" class="form-control" [(ngModel)]="referencia" maxlength="250" placeholder="Frente al parque" />
        </div>
      </div>

      <h4 class="subtitulo">3. Evidencia</h4>
      <label class="form-label" for="foto">Foto del incidente (JPG, PNG o WEBP, máximo 5 MB)</label>
      <input id="foto" class="form-control" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" (change)="elegirFoto($event)" />
      @if (vistaPrevia()) {
        <img class="foto-previa" [src]="vistaPrevia()" alt="Vista previa de la foto del incidente" />
      }

      <label class="form-label mt-3" for="descripcion">Detalle (opcional)</label>
      <textarea id="descripcion" class="form-control" [(ngModel)]="descripcion" maxlength="500" rows="3"></textarea>

      @if (error()) {
        <div class="alert alert-danger mt-3 mb-0" role="alert">{{ error() }}</div>
      }
      <div class="mt-4">
        <button class="btn btn-primary" type="button" (click)="enviar()" [disabled]="enviando()">
          <i class="fa fa-paper-plane me-2" aria-hidden="true"></i>
          {{ enviando() ? 'Enviando...' : 'Enviar reporte' }}
        </button>
      </div>
    </div>
  `,
})
export class NuevoReporteComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly tipos = signal<TipoIncidente[]>([]);
  readonly tipo = signal<TipoIncidente | null>(null);
  readonly ubicacion = signal<Coordenada | null>(null);
  readonly vistaPrevia = signal('');
  readonly error = signal('');
  readonly enviando = signal(false);

  direccion = '';
  referencia = '';
  descripcion = '';
  private foto: File | null = null;

  readonly icono = iconoTipo;

  ngOnInit(): void {
    this.api.tiposIncidente().subscribe({
      next: (t) => this.tipos.set(t),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  ngOnDestroy(): void {
    this.liberarVistaPrevia();
  }

  elegirUbicacion(c: Coordenada): void {
    this.ubicacion.set(c);
    this.error.set('');
  }

  usarMiUbicacion(): void {
    if (!navigator.geolocation) {
      this.error.set('Su navegador no permite obtener la ubicación. Márquela en el mapa.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => this.elegirUbicacion({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => this.error.set('No se pudo obtener su ubicación. Márquela en el mapa.'),
    );
  }

  elegirFoto(evento: Event): void {
    const archivo = (evento.target as HTMLInputElement).files?.[0] ?? null;
    this.liberarVistaPrevia();
    this.foto = null;
    if (!archivo) return;
    if (!TIPOS_FOTO.includes(archivo.type)) {
      this.error.set('La foto debe ser JPG, PNG o WEBP.');
      return;
    }
    if (archivo.size > MAX_BYTES) {
      this.error.set('La foto supera el tamaño máximo de 5 MB.');
      return;
    }
    this.error.set('');
    this.foto = archivo;
    this.vistaPrevia.set(URL.createObjectURL(archivo));
  }

  enviar(): void {
    const tipo = this.tipo();
    const ubicacion = this.ubicacion();
    if (!tipo) return this.error.set('Elija el tipo de incidente.');
    if (!ubicacion) return this.error.set('Marque el lugar en el mapa.');
    if (!estaEnQuito(ubicacion.lat, ubicacion.lng)) return this.error.set('La ubicación debe estar dentro de Quito.');
    if (!this.foto) return this.error.set('Adjunte una foto del incidente.');

    this.enviando.set(true);
    this.error.set('');
    this.api
      .crearReporte(
        {
          idTipoIncidente: tipo.id,
          descripcion: this.descripcion.trim(),
          latitud: Number(ubicacion.lat.toFixed(6)),
          longitud: Number(ubicacion.lng.toFixed(6)),
          direccion: this.direccion.trim(),
          referencia: this.referencia.trim(),
        },
        this.foto,
      )
      .subscribe({
        next: (r) => void this.router.navigate(['/reporte', r.reporte.id]),
        error: (e) => {
          this.error.set(mensajeDeError(e));
          this.enviando.set(false);
        },
      });
  }

  private liberarVistaPrevia(): void {
    const url = this.vistaPrevia();
    if (url) URL.revokeObjectURL(url);
    this.vistaPrevia.set('');
  }
}
