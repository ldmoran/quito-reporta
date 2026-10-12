import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';
import { MARCA } from '../core/marca';

/**
 * Estructura de las pantallas de acceso (igual que el login del SGFDM): imágenes que rotan
 * de fondo y un panel claro con borde curvo a la izquierda con el logo y el formulario.
 *
 * Las fotos se precargan y solo rotan las que existen: si falta alguna de la lista (por ejemplo
 * imagen3.jpg todavía no se subió) simplemente se omite. Si no carga ninguna se usan las de respaldo.
 */
@Component({
  selector: 'app-fondo-acceso',
  standalone: true,
  template: `
    <main class="login-page">
      <div class="login-background" aria-hidden="true">
        @for (slide of slides(); track slide; let i = $index) {
          <img class="login-slide" [class.activa]="i === activa()" [src]="slide" alt="" />
        }
      </div>

      <section class="login-panel">
        <div class="login-brand">
          <img class="logo" [src]="marca.logo" [alt]="marca.nombre" />
        </div>
        <div class="login-form">
          <ng-content />
        </div>
      </section>
    </main>
  `,
})
export class FondoAccesoComponent implements OnInit, OnDestroy {
  /** Fotos a mostrar, en orden. */
  @Input() imagenes: readonly string[] = MARCA.slides;
  /** Se usan solo si ninguna de `imagenes` se pudo cargar. */
  @Input() respaldo: readonly string[] = MARCA.slidesRespaldo;
  @Input() intervaloMs: number = MARCA.intervaloSlidesMs;

  readonly marca = MARCA;
  readonly slides = signal<string[]>([]);
  readonly activa = signal(0);

  private temporizador?: ReturnType<typeof setInterval>;
  private destruido = false;

  ngOnInit(): void {
    void this.prepararSlides();
  }

  ngOnDestroy(): void {
    this.destruido = true;
    clearInterval(this.temporizador);
  }

  private async prepararSlides(): Promise<void> {
    const resultados = await Promise.all(this.imagenes.map((url) => this.cargar(url)));
    if (this.destruido) return;
    let disponibles = this.imagenes.filter((_, i) => resultados[i]);
    if (disponibles.length === 0) {
      const respaldos = await Promise.all(this.respaldo.map((url) => this.cargar(url)));
      if (this.destruido) return;
      disponibles = this.respaldo.filter((_, i) => respaldos[i]);
    }
    this.slides.set([...disponibles]);
    this.activa.set(0);
    if (disponibles.length > 1) {
      this.temporizador = setInterval(() => this.activa.update((i) => (i + 1) % this.slides().length), this.intervaloMs);
    }
  }

  private cargar(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const imagen = new Image();
      imagen.onload = () => resolve(true);
      imagen.onerror = () => resolve(false);
      imagen.src = url;
    });
  }
}
