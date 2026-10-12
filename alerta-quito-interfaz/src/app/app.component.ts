import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { MARCA } from './core/marca';

const CLAVE_MENU = 'alerta-quito.menu-oculto';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (auth.sesion(); as s) {
      <div class="layout-container">
        <nav class="top-navbar" aria-label="Cabecera">
          <div class="d-flex align-items-center gap-3">
            <button
              type="button"
              class="hamburger-btn"
              (click)="alternarMenu()"
              [attr.aria-expanded]="!menuOculto()"
              [attr.aria-label]="menuOculto() ? 'Mostrar menú' : 'Ocultar menú'"
            >
              <i class="fa fa-bars" aria-hidden="true"></i>
            </button>
            <img class="header-logo" [src]="marca.logoHorizontal" [alt]="marca.nombre" />
            <span class="header-title d-none d-lg-inline">{{ marca.tituloSistema }}</span>
          </div>

          <div class="d-flex align-items-center gap-2">
            <div class="header-user d-none d-sm-flex">
              <span class="fw-semibold">{{ s.nombre }}</span>
              <small>{{ etiquetaPerfil() }}</small>
            </div>
            <button type="button" class="btn btn-light btn-sm px-3" (click)="auth.logout()">
              <i class="fa fa-sign-out me-1" aria-hidden="true"></i>
              Salir
            </button>
          </div>
        </nav>

        <div class="layout-body">
          <aside class="sidebar" [class.oculta]="menuOculto()" aria-label="Menú principal">
            <div class="sidebar-container">
              <div class="sidebar-brand">
                <div class="brand-title">{{ marca.tituloSistema }}</div>
                <div class="brand-subtitle">{{ marca.version }}</div>
              </div>

              <ul class="sidebar-nav">
                @if (!s.debeCambiarPassword) {
                  @if (auth.tienePerfil('CIUDAD')) {
                    <li>
                      <a class="sidebar-link" routerLink="/mis-reportes" routerLinkActive="active" (click)="cerrarEnMovil()">
                        <i class="fa fa-list-alt" aria-hidden="true"></i><span>Mis reportes</span>
                      </a>
                    </li>
                    <li>
                      <a class="sidebar-link" routerLink="/nuevo-reporte" routerLinkActive="active" (click)="cerrarEnMovil()">
                        <i class="fa fa-plus-circle" aria-hidden="true"></i><span>Nuevo reporte</span>
                      </a>
                    </li>
                  }
                  @if (auth.tienePerfil('FUNCIO')) {
                    <li>
                      <a class="sidebar-link" routerLink="/bandeja" routerLinkActive="active" (click)="cerrarEnMovil()">
                        <i class="fa fa-inbox" aria-hidden="true"></i><span>Bandeja de reportes</span>
                      </a>
                    </li>
                  }
                  @if (auth.tienePerfil('ADMINI')) {
                    <li>
                      <a class="sidebar-link" routerLink="/admin/estadisticas" routerLinkActive="active" (click)="cerrarEnMovil()">
                        <i class="fa fa-bar-chart" aria-hidden="true"></i><span>Estadísticas</span>
                      </a>
                    </li>
                    <li>
                      <button
                        type="button"
                        class="sidebar-link sidebar-toggle"
                        [class.grupo-activo]="enMantenimiento()"
                        [attr.aria-expanded]="mantenimientoAbierto()"
                        (click)="mantenimientoAbierto.set(!mantenimientoAbierto())"
                      >
                        <i class="fa fa-wrench" aria-hidden="true"></i><span>Mantenimiento</span>
                        <i [class]="mantenimientoAbierto() ? 'fa fa-chevron-down flecha' : 'fa fa-chevron-right flecha'" aria-hidden="true"></i>
                      </button>
                      @if (mantenimientoAbierto()) {
                        <ul class="submenu-list">
                          <li>
                            <a class="submenu-link" routerLink="/admin/entidades" routerLinkActive="active" (click)="cerrarEnMovil()">
                              <i class="fa fa-building-o" aria-hidden="true"></i><span>Entidades</span>
                            </a>
                          </li>
                          <li>
                            <a class="submenu-link" routerLink="/admin/tipos-incidente" routerLinkActive="active" (click)="cerrarEnMovil()">
                              <i class="fa fa-list-ul" aria-hidden="true"></i><span>Tipos de incidente</span>
                            </a>
                          </li>
                          <li>
                            <a class="submenu-link" routerLink="/admin/funcionarios" routerLinkActive="active" (click)="cerrarEnMovil()">
                              <i class="fa fa-users" aria-hidden="true"></i><span>Funcionarios</span>
                            </a>
                          </li>
                        </ul>
                      }
                    </li>
                    <li>
                      <a class="sidebar-link" routerLink="/admin/usuarios" routerLinkActive="active" (click)="cerrarEnMovil()">
                        <i class="fa fa-key" aria-hidden="true"></i><span>Usuarios</span>
                      </a>
                    </li>
                    <li>
                      <a class="sidebar-link" routerLink="/admin/auditoria" routerLinkActive="active" (click)="cerrarEnMovil()">
                        <i class="fa fa-history" aria-hidden="true"></i><span>Auditoría</span>
                      </a>
                    </li>
                  }
                }
                <li>
                  <a class="sidebar-link" routerLink="/cambiar-password" routerLinkActive="active" (click)="cerrarEnMovil()">
                    <i class="fa fa-lock" aria-hidden="true"></i><span>Cambiar contraseña</span>
                  </a>
                </li>
              </ul>
            </div>
          </aside>

          <div class="content-area">
            <div class="content-wrapper">
              <router-outlet />
            </div>
          </div>
        </div>
      </div>
    } @else {
      <router-outlet />
    }
  `,
})
export class AppComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly marca = MARCA;
  /** El grupo Mantenimiento arranca abierto si se está dentro de alguna de sus pantallas. */
  readonly mantenimientoAbierto = signal(true);
  readonly menuOculto = signal(this.leerMenuOculto());
  private eraGrande = typeof window === 'undefined' || window.innerWidth >= 992;

  enMantenimiento(): boolean {
    return /^\/admin\/(entidades|tipos-incidente|funcionarios)/.test(this.router.url);
  }

  etiquetaPerfil(): string {
    if (this.auth.tienePerfil('ADMINI')) return 'Administrador';
    if (this.auth.tienePerfil('FUNCIO')) return 'Funcionario';
    return 'Ciudadano';
  }

  alternarMenu(): void {
    this.menuOculto.update((v) => !v);
    try {
      localStorage.setItem(CLAVE_MENU, String(this.menuOculto()));
    } catch {
      /* sin almacenamiento */
    }
  }

  /** En pantallas angostas el menú es un panel flotante: se cierra al elegir una opción. */
  cerrarEnMovil(): void {
    if (window.innerWidth < 992) this.menuOculto.set(true);
  }

  /**
   * Solo reacciona al pasar de pantalla grande a celular. En un telefono el evento resize tambien
   * salta al mostrar u ocultar la barra del navegador y no debe cerrar el menu a mitad de uso.
   */
  @HostListener('window:resize')
  alCambiarTamano(): void {
    const esGrande = window.innerWidth >= 992;
    if (this.eraGrande && !esGrande) this.menuOculto.set(true);
    this.eraGrande = esGrande;
  }

  private leerMenuOculto(): boolean {
    if (typeof window !== 'undefined' && window.innerWidth < 992) return true;
    try {
      return localStorage.getItem(CLAVE_MENU) === 'true';
    } catch {
      return false;
    }
  }
}
