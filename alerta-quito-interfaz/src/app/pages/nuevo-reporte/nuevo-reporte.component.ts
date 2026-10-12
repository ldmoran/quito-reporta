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
    <section class="tarjeta">
      <h1>Nuevo reporte</h1>
      <p class="suave">Elige qué pasó, marca el lugar en el mapa y sube una foto. Nosotros lo enviamos a la entidad correcta.</p>

      <h2>1. ¿Qué ocurrió?</h2>
      <div class="rejilla-tipos" role="radiogroup" aria-label="Tipo de incidente">
        @for (t of tipos(); track t.id) {
          <button
            type="button"
            role="radio"
            class="tipo"
            [class.elegido]="tipo()?.id === t.id"
            [class.emergencia]="t.esEmergencia"
            [attr.aria-checked]="tipo()?.id === t.id"
            (click)="tipo.set(t)"
          >
            <span class="icono" aria-hidden="true">{{ icono(t.nombre) }}</span>
            <span>{{ t.nombre }}</span>
            <small>{{ t.entidadCodigo }}</small>
          </button>
        }
      </div>
      @if (tipo()?.esEmergencia) {
        <p class="aviso" role="note">
          Esto se trata como emergencia y llega primero a la entidad. Si hay peligro inmediato, llama también al 911.
        </p>
      }

      <h2>2. ¿Dónde?</h2>
      <app-mapa [seleccionable]="true" [seleccion]="ubicacion()" (seleccionado)="elegirUbicacion($event)" />
      <div class="fila">
        <button type="button" (click)="usarMiUbicacion()">📍 Usar mi ubicación</button>
        @if (ubicacion(); as u) {
          <span class="suave">{{ u.lat.toFixed(5) }}, {{ u.lng.toFixed(5) }}</span>
        } @else {
          <span class="suave">Toca el mapa para marcar el lugar.</span>
        }
      </div>
      <label for="direccion">Dirección o calles cercanas (opcional)</label>
      <input id="direccion" [(ngModel)]="direccion" maxlength="250" placeholder="Av. 10 de Agosto y Colón" />
      <label for="referencia">Referencia (opcional)</label>
      <input id="referencia" [(ngModel)]="referencia" maxlength="250" placeholder="Frente al parque" />

      <h2>3. Foto</h2>
      <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" (change)="elegirFoto($event)" aria-label="Foto del incidente" />
      @if (vistaPrevia()) {
        <img class="previa" [src]="vistaPrevia()" alt="Vista previa de la foto del incidente" />
      }

      <label for="descripcion">Detalle (opcional, texto corto)</label>
      <textarea id="descripcion" [(ngModel)]="descripcion" maxlength="500" rows="3"></textarea>

      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <button class="primario" type="button" (click)="enviar()" [disabled]="enviando()">
        {{ enviando() ? 'Enviando…' : 'Enviar reporte' }}
      </button>
    </section>
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
      this.error.set('Tu navegador no permite obtener la ubicación. Márcala en el mapa.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => this.elegirUbicacion({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => this.error.set('No pudimos obtener tu ubicación. Márcala en el mapa.'),
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
    if (!tipo) return this.error.set('Elige qué ocurrió.');
    if (!ubicacion) return this.error.set('Marca el lugar en el mapa.');
    if (!estaEnQuito(ubicacion.lat, ubicacion.lng)) return this.error.set('La ubicación debe estar dentro de Quito.');
    if (!this.foto) return this.error.set('Sube una foto del incidente.');

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
