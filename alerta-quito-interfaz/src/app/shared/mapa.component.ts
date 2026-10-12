import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import * as L from 'leaflet';

export interface PuntoMapa {
  lat: number;
  lng: number;
  titulo: string;
  color: string;
  id?: number;
}

export interface Coordenada {
  lat: number;
  lng: number;
}

/** Centro de Quito: el mapa arranca aquí si no hay ningún punto que mostrar. */
export const CENTRO_QUITO: Coordenada = { lat: -0.1807, lng: -78.4678 };

/** Mismo rectángulo que valida el API y el CHECK de la tabla UBICACION. */
export function estaEnQuito(lat: number, lng: number): boolean {
  return lat >= -0.45 && lat <= 0.2 && lng >= -78.8 && lng <= -78.2;
}

@Component({
  selector: 'app-mapa',
  standalone: true,
  template: '<div #contenedor class="mapa" [style.height]="altura" role="application" aria-label="Mapa"></div>',
  styles: ['.mapa { width: 100%; border-radius: 12px; z-index: 0; border: 1px solid var(--borde); }'],
})
export class MapaComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() puntos: PuntoMapa[] = [];
  @Input() seleccionable = false;
  @Input() seleccion: Coordenada | null = null;
  @Input() altura = '320px';
  @Output() seleccionado = new EventEmitter<Coordenada>();
  @Output() puntoClick = new EventEmitter<number>();

  @ViewChild('contenedor', { static: true }) contenedor!: ElementRef<HTMLDivElement>;

  private mapa?: L.Map;
  private readonly capa = L.layerGroup();
  private marcadorSeleccion?: L.CircleMarker;

  ngAfterViewInit(): void {
    this.mapa = L.map(this.contenedor.nativeElement).setView([CENTRO_QUITO.lat, CENTRO_QUITO.lng], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.mapa);
    this.capa.addTo(this.mapa);

    if (this.seleccionable) {
      this.mapa.on('click', (e: L.LeafletMouseEvent) => this.seleccionado.emit({ lat: e.latlng.lat, lng: e.latlng.lng }));
    }
    this.dibujar(true);
    // El contenedor puede tener tamaño 0 al crearse (pestañas, @if): se recalcula.
    setTimeout(() => this.mapa?.invalidateSize());
  }

  ngOnChanges(): void {
    if (this.mapa) this.dibujar(false);
  }

  ngOnDestroy(): void {
    this.mapa?.remove();
  }

  private dibujar(ajustarVista: boolean): void {
    if (!this.mapa) return;
    this.capa.clearLayers();

    for (const p of this.puntos) {
      const marcador = L.circleMarker([p.lat, p.lng], {
        radius: 9,
        color: '#ffffff',
        weight: 2,
        fillColor: p.color,
        fillOpacity: 0.95,
      }).bindTooltip(p.titulo);
      if (p.id !== undefined) marcador.on('click', () => this.puntoClick.emit(p.id));
      marcador.addTo(this.capa);
    }

    this.marcadorSeleccion?.remove();
    this.marcadorSeleccion = undefined;
    if (this.seleccion) {
      this.marcadorSeleccion = L.circleMarker([this.seleccion.lat, this.seleccion.lng], {
        radius: 11,
        color: '#ffffff',
        weight: 3,
        fillColor: '#1565c0',
        fillOpacity: 1,
      }).addTo(this.mapa);
    }

    if (ajustarVista && this.puntos.length > 0) {
      const limites = L.latLngBounds(this.puntos.map((p) => [p.lat, p.lng] as [number, number]));
      this.mapa.fitBounds(limites, { padding: [40, 40], maxZoom: 16 });
    } else if (ajustarVista && this.seleccion) {
      this.mapa.setView([this.seleccion.lat, this.seleccion.lng], 16);
    }
  }
}
