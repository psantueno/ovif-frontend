import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { HomeComponent } from './pages/home/home.component';
import { SeleccionarMunicipioComponent } from './pages/seleccionar-municipio/seleccionar-municipio.component';
import { AuthGuard } from './core/guards/auth.guard';
import { PendingChangesGuard } from './pages/gastos/guards/pending-changes.guard';
import { RecursosPendingChangesGuard } from './pages/recursos/guards/pending-changes.guard';

// Admin
import { AdminMenuComponent } from './pages/admin/admin-menu/admin-menu.component';
import { UsuariosComponent } from './pages/admin/usuarios/usuarios.component';
import { AsignacionMunicipiosComponent } from './pages/admin/asignacion-municipios/asignacion-municipios.component';
import { RolesComponent } from './pages/admin/roles/roles.component';
import { EjerciciosFiscalesComponent } from './pages/admin/ejercicios-fiscales/ejercicios-fiscales.component';
import { MainLayout } from './shared/layouts/main-layout.component';
import { ForgotPasswordComponent } from './pages/solicitar-blanqueo/forgot-password.component';
import { ResetPasswordComponent } from './pages/reset-password/reset-password.component';
import { SinAccesoComponent } from './pages/sin-acceso/sin-acceso.component';

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
    children: [
      { path: '', component: SeleccionarMunicipioComponent },
      { path: 'home', component: HomeComponent },
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
      { path: 'admin', component: AdminMenuComponent },
      { path: 'admin/usuarios', component: UsuariosComponent },
      { path: 'admin/asignacion-municipios', component: AsignacionMunicipiosComponent },
      { path: 'admin/ejercicios', component: EjerciciosFiscalesComponent },
      { path: 'admin/roles', component: RolesComponent },
    ]
  },
  { path: '**', redirectTo: '' }
];
