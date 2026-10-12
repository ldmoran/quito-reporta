import { Routes } from '@angular/router';
import { perfilGuard, sesionGuard, soloInvitadoGuard } from './core/auth.guard';
import { AuditoriaComponent } from './pages/admin/auditoria.component';
import { EntidadesComponent } from './pages/admin/entidades.component';
import { EstadisticasComponent } from './pages/admin/estadisticas.component';
import { FuncionariosComponent } from './pages/admin/funcionarios.component';
import { TiposIncidenteComponent } from './pages/admin/tipos-incidente.component';
import { UsuariosComponent } from './pages/admin/usuarios.component';
import { OlvidePasswordComponent } from './pages/olvide-password/olvide-password.component';
import { RestablecerPasswordComponent } from './pages/restablecer-password/restablecer-password.component';
import { BandejaComponent } from './pages/bandeja/bandeja.component';
import { CambiarPasswordComponent } from './pages/cambiar-password/cambiar-password.component';
import { LoginComponent } from './pages/login/login.component';
import { MisReportesComponent } from './pages/mis-reportes/mis-reportes.component';
import { NuevoReporteComponent } from './pages/nuevo-reporte/nuevo-reporte.component';
import { RegistroComponent } from './pages/registro/registro.component';
import { ReporteDetalleComponent } from './pages/reporte-detalle/reporte-detalle.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [soloInvitadoGuard], title: 'Iniciar sesión · Alerta Quito' },
  { path: 'olvide-password', component: OlvidePasswordComponent, canActivate: [soloInvitadoGuard], title: 'Recuperar contraseña · Alerta Quito' },
  { path: 'restablecer', component: RestablecerPasswordComponent, title: 'Nueva contraseña · Alerta Quito' },
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
    canActivate: [perfilGuard('ADMINI')],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'estadisticas' },
      { path: 'estadisticas', component: EstadisticasComponent, title: 'Estadísticas · Alerta Quito' },
      { path: 'entidades', component: EntidadesComponent, title: 'Entidades · Alerta Quito' },
      { path: 'tipos-incidente', component: TiposIncidenteComponent, title: 'Tipos de incidente · Alerta Quito' },
      { path: 'funcionarios', component: FuncionariosComponent, title: 'Funcionarios · Alerta Quito' },
      { path: 'usuarios', component: UsuariosComponent, title: 'Usuarios · Alerta Quito' },
      { path: 'auditoria', component: AuditoriaComponent, title: 'Auditoría · Alerta Quito' },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
