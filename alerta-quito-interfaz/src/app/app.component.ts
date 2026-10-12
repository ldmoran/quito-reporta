import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="barra">
      <a class="marca" [routerLink]="auth.autenticado() ? auth.rutaInicio() : '/login'">🚨 Alerta Quito</a>

      @if (auth.sesion(); as s) {
        <nav aria-label="Principal">
          @if (!s.debeCambiarPassword) {
            @if (auth.tienePerfil('CIUDAD')) {
              <a routerLink="/nuevo-reporte" routerLinkActive="activo">Nuevo reporte</a>
              <a routerLink="/mis-reportes" routerLinkActive="activo">Mis reportes</a>
            }
            @if (auth.tienePerfil('FUNCIO')) {
              <a routerLink="/bandeja" routerLinkActive="activo">Bandeja</a>
            }
            @if (auth.tienePerfil('ADMINI')) {
              <a routerLink="/admin" routerLinkActive="activo">Administración</a>
            }
          }
          <a routerLink="/cambiar-password" routerLinkActive="activo">Contraseña</a>
          <span class="usuario">{{ s.nombre }}</span>
          <button type="button" (click)="auth.logout()">Salir</button>
        </nav>
      }
    </header>
    <main>
      <router-outlet />
    </main>
  `,
})
export class AppComponent {
  readonly auth = inject(AuthService);
}
