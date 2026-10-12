import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { MARCA } from '../core/marca';

/**
 * Estructura de las pantallas de acceso (igual que el login del SGFDM): imágenes que rotan
 * de fondo y un panel claro con borde curvo a la izquierda con el logo y el formulario.
 */
@Component({
  selector: 'app-fondo-acceso',
  standalone: true,
  template: `
    <main class="login-page">
      <div class="login-background" aria-hidden="true">
        @for (slide of slides; track slide; let i = $index) {
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
  readonly marca = MARCA;
  readonly slides = MARCA.slides;
  readonly activa = signal(0);
  private temporizador?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    if (this.slides.length > 1) {
      this.temporizador = setInterval(
        () => this.activa.update((i) => (i + 1) % this.slides.length),
        MARCA.intervaloSlidesMs,
      );
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.temporizador);
  }
}
