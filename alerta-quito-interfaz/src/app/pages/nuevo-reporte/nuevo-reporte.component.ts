import { Component, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { DictadoService, SesionDictado } from '../../core/dictado.service';
import { iconoTipo } from '../../core/etiquetas';
import { GeocodificacionService, Lugar } from '../../core/geocodificacion.service';
import { mensajeDeError } from '../../core/mensajes';
import { TipoIncidente } from '../../core/modelos';
import { Coordenada, MapaComponent, estaEnQuito } from '../../shared/mapa.component';

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DETALLE = 500;

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
          Puede <strong>dictar el detalle por voz</strong> con el micrófono.
        </div>
      }

      <h4 class="subtitulo">2. Ubicación</h4>
      <div class="input-group mb-2">
        <input
          id="direccion"
          class="form-control"
          [ngModel]="direccion"
          (ngModelChange)="alEscribirDireccion($event)"
          (keydown.enter)="$event.preventDefault(); buscarDireccion()"
          maxlength="250"
          placeholder="Escriba una dirección (Av. 10 de Agosto y Colón) y pulse Buscar"
          aria-label="Dirección o calles cercanas"
        />
        <button type="button" class="btn btn-primary" (click)="buscarDireccion()" [disabled]="buscando() || !direccion.trim()">
          <i class="fa fa-search me-1" aria-hidden="true"></i>{{ buscando() ? 'Buscando...' : 'Buscar' }}
        </button>
      </div>

      @if (sugerencias().length > 1) {
        <div class="list-group mb-2" role="listbox" aria-label="Resultados de la búsqueda">
          @for (s of sugerencias(); track $index) {
            <button type="button" class="list-group-item list-group-item-action" role="option" (click)="elegirSugerencia(s)">
              <i class="fa fa-map-marker me-2" aria-hidden="true"></i>{{ s.direccion }}
              @if (s.referencia) {
                <small class="text-muted"> - {{ s.referencia }}</small>
              }
            </button>
          }
        </div>
      }
      @if (avisoUbicacion()) {
        <div class="text-muted small mb-2" role="status">{{ avisoUbicacion() }}</div>
      }

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
          <label class="form-label" for="referencia">Referencia (opcional)</label>
          <input
            id="referencia"
            class="form-control"
            [ngModel]="referencia"
            (ngModelChange)="referencia = $event; referenciaEditada = true"
            maxlength="250"
            placeholder="Frente al parque"
          />
        </div>
      </div>

      <h4 class="subtitulo">3. Evidencia</h4>
      <label class="form-label" for="foto">Foto del incidente (JPG, PNG o WEBP, máximo 5 MB)</label>
      <input id="foto" class="form-control" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" (change)="elegirFoto($event)" />
      @if (vistaPrevia()) {
        <img class="foto-previa" [src]="vistaPrevia()" alt="Vista previa de la foto del incidente" />
      }

      <label class="form-label mt-3" for="descripcion">Detalle (opcional)</label>
      <div class="input-group">
        <textarea
          id="descripcion"
          class="form-control"
          [(ngModel)]="descripcion"
          [readOnly]="dictando()"
          [maxLength]="maxDetalle"
          rows="3"
          placeholder="Escriba o dicte qué está pasando"
        ></textarea>
        @if (dictado.disponible) {
          <button
            type="button"
            class="btn"
            [class.btn-danger]="dictando()"
            [class.btn-secondary]="!dictando()"
            (click)="alternarDictado()"
            [attr.aria-pressed]="dictando()"
            [attr.aria-label]="dictando() ? 'Detener el dictado' : 'Dictar el detalle por voz'"
          >
            <i [class]="dictando() ? 'fa fa-stop' : 'fa fa-microphone'" aria-hidden="true"></i>
          </button>
        }
      </div>
      <div class="d-flex justify-content-between small text-muted mt-1">
        <span role="status">
          @if (dictando()) {
            <span class="indicador-grabando"></span> Escuchando... hable ahora y pulse el botón rojo para terminar.
          } @else if (!dictado.disponible) {
            El dictado por voz no está disponible en este navegador (use Chrome o Edge).
          } @else {
            Pulse el micrófono y cuente qué pasa; el texto se escribe solo.
          }
        </span>
        <span>{{ descripcion.length }}/{{ maxDetalle }}</span>
      </div>
      @if (errorDictado()) {
        <div class="text-danger small mt-1" role="alert">{{ errorDictado() }}</div>
      }

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
  private readonly geo = inject(GeocodificacionService);
  readonly dictado = inject(DictadoService);

  @ViewChild(MapaComponent) private mapa?: MapaComponent;

  readonly tipos = signal<TipoIncidente[]>([]);
  readonly tipo = signal<TipoIncidente | null>(null);
  readonly ubicacion = signal<Coordenada | null>(null);
  readonly vistaPrevia = signal('');
  readonly error = signal('');
  readonly enviando = signal(false);
  readonly buscando = signal(false);
  readonly sugerencias = signal<Lugar[]>([]);
  readonly avisoUbicacion = signal('');
  readonly dictando = signal(false);
  readonly errorDictado = signal('');

  direccion = '';
  referencia = '';
  descripcion = '';
  readonly maxDetalle = MAX_DETALLE;
  /** Si la persona escribió la dirección o la referencia, el mapa ya no las pisa. */
  private direccionEditada = false;
  referenciaEditada = false;

  private foto: File | null = null;
  private consulta?: Subscription;
  private sesionDictado: SesionDictado | null = null;

  readonly icono = iconoTipo;

  ngOnInit(): void {
    this.api.tiposIncidente().subscribe({
      next: (t) => this.tipos.set(t),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  ngOnDestroy(): void {
    this.liberarVistaPrevia();
    this.consulta?.unsubscribe();
    this.sesionDictado?.detener();
  }

  // ------------------------------------------------------------ ubicación

  alEscribirDireccion(texto: string): void {
    this.direccion = texto;
    this.direccionEditada = true;
    this.sugerencias.set([]);
  }

  /** Clic en el mapa: marca el punto y rellena la dirección y la referencia. */
  elegirUbicacion(c: Coordenada, centrar = false): void {
    this.error.set('');
    this.sugerencias.set([]);
    if (!estaEnQuito(c.lat, c.lng)) {
      this.avisoUbicacion.set('');
      this.error.set('La ubicación debe estar dentro de Quito.');
      return;
    }
    this.ubicacion.set(c);
    if (centrar) this.mapa?.centrarEn(c);
    this.autocompletarDesde(c);
  }

  private autocompletarDesde(c: Coordenada): void {
    this.consulta?.unsubscribe();
    this.avisoUbicacion.set('Obteniendo la dirección...');
    this.consulta = this.geo.direccionDe(c.lat, c.lng).subscribe({
      next: (lugar) => {
        this.aplicarLugar(lugar);
        this.avisoUbicacion.set(lugar.direccion ? 'Dirección completada automáticamente. Puede corregirla.' : '');
      },
      error: () => this.avisoUbicacion.set('No se pudo obtener la dirección automáticamente. Escríbala usted.'),
    });
  }

  private aplicarLugar(lugar: Lugar): void {
    if (!this.direccionEditada && lugar.direccion) this.direccion = lugar.direccion;
    if (!this.referenciaEditada && lugar.referencia) this.referencia = lugar.referencia;
  }

  /** Busca la dirección escrita y la ubica en el mapa. */
  buscarDireccion(): void {
    const texto = this.direccion.trim();
    if (!texto) return;
    this.consulta?.unsubscribe();
    this.buscando.set(true);
    this.sugerencias.set([]);
    this.avisoUbicacion.set('');
    this.consulta = this.geo.buscar(texto).subscribe({
      next: (lista) => {
        this.buscando.set(false);
        if (lista.length === 0) {
          this.avisoUbicacion.set('No se encontró esa dirección en Quito. Pruebe con otra calle o marque el punto en el mapa.');
        } else if (lista.length === 1) {
          this.elegirSugerencia(lista[0]);
        } else {
          this.sugerencias.set(lista);
          this.avisoUbicacion.set('Se encontraron varias coincidencias: elija una.');
        }
      },
      error: () => {
        this.buscando.set(false);
        this.avisoUbicacion.set('No se pudo buscar la dirección ahora. Marque el punto en el mapa.');
      },
    });
  }

  elegirSugerencia(lugar: Lugar): void {
    this.sugerencias.set([]);
    if (!estaEnQuito(lugar.lat, lugar.lng)) {
      this.avisoUbicacion.set('Ese resultado está fuera de Quito.');
      return;
    }
    const punto = { lat: lugar.lat, lng: lugar.lng };
    this.ubicacion.set(punto);
    this.mapa?.centrarEn(punto);
    if (lugar.direccion) this.direccion = lugar.direccion;
    this.direccionEditada = false;
    if (!this.referenciaEditada && lugar.referencia) this.referencia = lugar.referencia;
    this.avisoUbicacion.set('Ubicación marcada en el mapa. Puede mover el punto haciendo clic en otro lugar.');
    this.error.set('');
  }

  usarMiUbicacion(): void {
    if (!navigator.geolocation) {
      this.error.set('Su navegador no permite obtener la ubicación. Márquela en el mapa.');
      return;
    }
    this.avisoUbicacion.set('Obteniendo su ubicación...');
    navigator.geolocation.getCurrentPosition(
      (p) => this.elegirUbicacion({ lat: p.coords.latitude, lng: p.coords.longitude }, true),
      () => {
        this.avisoUbicacion.set('');
        this.error.set('No se pudo obtener su ubicación. Permita el acceso o márquela en el mapa.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  // ------------------------------------------------------------ dictado

  alternarDictado(): void {
    if (this.dictando()) {
      this.sesionDictado?.detener();
      return;
    }
    this.errorDictado.set('');
    const base = this.descripcion.trim();
    this.sesionDictado = this.dictado.iniciar({
      alTexto: (confirmado, provisional) => {
        const dictado = [confirmado, provisional].filter(Boolean).join(' ');
        this.descripcion = this.capitalizar([base, dictado].filter(Boolean).join(' ')).slice(0, MAX_DETALLE);
      },
      alTerminar: (error) => {
        this.dictando.set(false);
        this.sesionDictado = null;
        if (error) this.errorDictado.set(error);
      },
    });
    this.dictando.set(this.sesionDictado !== null);
  }

  private capitalizar(texto: string): string {
    return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
  }

  // ------------------------------------------------------------ foto y envío

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

    this.sesionDictado?.detener();
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
