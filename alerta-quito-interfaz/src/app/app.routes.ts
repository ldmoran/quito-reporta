import { Routes } from '@angular/router';
import { perfilGuard, sesionGuard, soloInvitadoGuard } from './core/auth.guard';
import { AdminComponent } from './pages/admin/admin.component';
import { BandejaComponent } from './pages/bandeja/bandeja.component';
import { CambiarPasswordComponent } from './pages/cambiar-password/cambiar-password.component';
import { LoginComponent } from './pages/login/login.component';
import { MisReportesComponent } from './pages/mis-reportes/mis-reportes.component';
import { NuevoReporteComponent } from './pages/nuevo-reporte/nuevo-reporte.component';
import { RegistroComponent } from './pages/registro/registro.component';
import { ReporteDetalleComponent } from './pages/reporte-detalle/reporte-detalle.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [soloInvitadoGuard], title: 'Iniciar sesión · Alerta Quito' },
  { path: 'registro', component: RegistroComponent, canActivate: [soloInvitadoGuard], title: 'Crear cuenta · Alerta Quito' },
  {
    path: 'cambiar-password',
    component: CambiarPasswordComponent,
    canActivate: [sesionGuard],
    title: 'Cambiar contraseña · Alerta Quito',
  },
  {
    path: 'nuevo-reporte',
    component: NuevoReporteComponent,
    canActivate: [perfilGuard('CIUDAD')],
    title: 'Nuevo reporte · Alerta Quito',
  },
  {
    path: 'mis-reportes',
    component: MisReportesComponent,
    canActivate: [perfilGuard('CIUDAD')],
    title: 'Mis reportes · Alerta Quito',
  },
  {
    path: 'bandeja',
    component: BandejaComponent,
    canActivate: [perfilGuard('FUNCIO')],
    title: 'Bandeja · Alerta Quito',
  },
  {
    path: 'reporte/:id',
    component: ReporteDetalleComponent,
    canActivate: [perfilGuard('CIUDAD', 'FUNCIO', 'ADMINI')],
    title: 'Reporte · Alerta Quito',
  },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [perfilGuard('ADMINI')],
    title: 'Administración · Alerta Quito',
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
