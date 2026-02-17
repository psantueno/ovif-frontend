import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { HomeComponent } from './pages/home/home.component';
import { PanelCargaMensualComponent } from './pages/panel-carga-mensual/panel-carga-mensual.component';
import { SeleccionarMunicipioComponent } from './pages/seleccionar-municipio/seleccionar-municipio.component';
import { AuthGuard } from './core/guards/auth.guard';
import { PendingChangesGuard } from './pages/gastos/guards/pending-changes.guard';
import { RecursosPendingChangesGuard } from './pages/recursos/guards/pending-changes.guard';
import { MunicipioGuard } from './core/guards/municipio.guard';
import { AdminGuard } from './core/guards/admin.guard';
import { PanelCargaRectificacionesComponent } from './pages/rectificaciones/panel-carga-rectificaciones.component';

// Admin
import { AdminMenuComponent } from './pages/admin/admin-menu/admin-menu.component';
import { UsuariosComponent } from './pages/admin/usuarios/usuarios.component';
import { AsignacionMunicipiosComponent } from './pages/admin/asignacion-municipios/asignacion-municipios.component';
import { RolesComponent } from './pages/admin/roles/roles.component';
import { EjerciciosFiscalesComponent } from './pages/admin/ejercicios-fiscales/ejercicios-fiscales.component';
import { ProrrogaCierreComponent } from './pages/admin/prorroga-cierre/prorroga-cierre.component';
import { MunicipiosComponent } from './pages/admin/municipios/municipios.component';
import { MainLayout } from './shared/layouts/main-layout.component';
import { ForgotPasswordComponent } from './pages/solicitar-blanqueo/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { SinAccesoComponent } from './pages/sin-acceso/sin-acceso.component';
import { ConveniosComponent } from './pages/admin/convenios/convenios.component';
import { PautasComponent } from './pages/admin/pautas/pautas.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  // ACCESO DENEGADO SIN MUNICIPIO ASIGNADO
  { path: 'sin-acceso', component: SinAccesoComponent },
  {
    path: '',
    component: MainLayout,
    canActivate: [AuthGuard],
    canActivateChild: [MunicipioGuard],
    children: [
      { path: '', component: SeleccionarMunicipioComponent },
      { path: 'home', component: HomeComponent },
      {
        path: 'panel-carga-mensual',
        component: PanelCargaMensualComponent
      },
      {
        path: 'subir-archivos',
        loadComponent: () => import('./pages/subir-archivos/subir-archivos.component').then((m) => m.SubirArchivosComponent)
      },
      {
        path: 'gastos',
        canDeactivate: [PendingChangesGuard],
        loadComponent: () => import('./pages/gastos/gastos.component').then((m) => m.GastosComponent)
      },
      {
        path: 'recursos',
        canDeactivate: [RecursosPendingChangesGuard],
        loadComponent: () => import('./pages/recursos/recursos.component').then((m) => m.RecursosComponent)
      },
      {
        path: 'recaudaciones',
        loadComponent: () => import('./pages/recaudaciones/recaudaciones.component').then((m) => m.RecaudacionesComponent)
      },
      {
        path: 'remuneraciones',
        loadComponent: () => import('./pages/remuneraciones/remuneraciones.component').then((m) => m.RemuneracionesComponent)
      },
      {
        path: 'historico-ejercicios-cerrados',
        loadComponent: () =>
          import('./pages/historico-ejercicios-cerrados/historico-ejercicios-cerrados.component').then(
            (m) => m.HistoricoEjerciciosCerradosComponent
          )
      },
      {
        path: 'panel-carga-rectificaciones',
        component: PanelCargaRectificacionesComponent
      },
      { path: 'admin', component: AdminMenuComponent, canActivate: [AdminGuard] },
      { path: 'admin/usuarios', component: UsuariosComponent, canActivate: [AdminGuard] },
      { path: 'admin/municipios', component: MunicipiosComponent, canActivate: [AdminGuard] },
      { path: 'admin/asignacion-municipios', component: AsignacionMunicipiosComponent, canActivate: [AdminGuard] },
      { path: 'admin/ejercicios', component: EjerciciosFiscalesComponent, canActivate: [AdminGuard] },
      { path: 'admin/prorroga-cierre', component: ProrrogaCierreComponent, canActivate: [AdminGuard] },
      { path: 'admin/roles', component: RolesComponent, canActivate: [AdminGuard] },
      { path: 'admin/convenios', component: ConveniosComponent, canActivate: [AdminGuard] },
      { path: 'admin/pautas', component: PautasComponent, canActivate: [AdminGuard] }
    ]
  },
  { path: '**', redirectTo: '' }
];
