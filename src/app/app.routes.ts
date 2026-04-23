import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { PendingChangesGuard } from './pages/gastos/guards/pending-changes.guard';
import { RecursosPendingChangesGuard } from './pages/recursos/guards/pending-changes.guard';
import { MunicipioGuard } from './core/guards/municipio.guard';
import { AdminGuard } from './core/guards/admin.guard';
import { MainLayout } from './shared/layouts/main-layout.component';
import { MaintenanceGuard } from './core/guards/maintenance.guard';
import { MaintenancePageGuard } from './core/guards/maintenance-page.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [MaintenanceGuard],
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'forgot-password',
    canActivate: [MaintenanceGuard],
    loadComponent: () => import('./pages/solicitar-blanqueo/forgot-password.component').then((m) => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    canActivate: [MaintenanceGuard],
    loadComponent: () => import('./pages/reset-password/reset-password.component').then((m) => m.ResetPasswordComponent)
  },
  // ACCESO DENEGADO SIN MUNICIPIO ASIGNADO
  {
    path: 'sin-acceso',
    canActivate: [MaintenanceGuard],
    loadComponent: () => import('./pages/sin-acceso/sin-acceso.component').then((m) => m.SinAccesoComponent)
  },
  // Página 404
  {
    path: 'not-found',
    loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent)
  },
  // Página acceso no autorizado
  {
    path: 'unauthorized',
    loadComponent: () => import('./pages/unauthorized/unauthorized.component').then((m) => m.UnauthorizedComponent)
  },
  // Página de mantenimiento (MaintenancePageGuard redirige si el sistema NO está en mantenimiento)
  {
    path: 'mantenimiento',
    canActivate: [MaintenancePageGuard],
    loadComponent: () => import('./pages/mantenimiento/mantenimiento.component').then((m) => m.MantenimientoComponent)
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [MaintenanceGuard, AuthGuard],
    canActivateChild: [MunicipioGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/seleccionar-municipio/seleccionar-municipio.component').then((m) => m.SeleccionarMunicipioComponent)
      },
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent)
      },
      {
        path: 'panel-carga-mensual',
        loadComponent: () =>
          import('./pages/panel-carga-mensual/panel-carga-mensual.component').then((m) => m.PanelCargaMensualComponent)
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
        path: 'determinacion-tributaria',
        loadComponent: () =>
          import('./pages/determinacion-tributaria/determinacion-tributaria.component').then(
            (m) => m.DeterminacionTributariaComponent
          )
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
        loadComponent: () =>
          import('./pages/rectificaciones/panel-carga-rectificaciones.component').then((m) => m.PanelCargaRectificacionesComponent)
      },
      // Admin
      {
        path: 'admin',
        canActivate: [AdminGuard],
        loadComponent: () => import('./pages/admin/admin-menu/admin-menu.component').then((m) => m.AdminMenuComponent)
      },
      {
        path: 'admin/usuarios',
        canActivate: [AdminGuard],
        loadComponent: () => import('./pages/admin/usuarios/usuarios.component').then((m) => m.UsuariosComponent)
      },
      {
        path: 'admin/municipios',
        canActivate: [AdminGuard],
        loadComponent: () => import('./pages/admin/municipios/municipios.component').then((m) => m.MunicipiosComponent)
      },
      {
        path: 'admin/asignacion-municipios',
        canActivate: [AdminGuard],
        loadComponent: () =>
          import('./pages/admin/asignacion-municipios/asignacion-municipios.component').then(
            (m) => m.AsignacionMunicipiosComponent
          )
      },
      {
        path: 'admin/ejercicios',
        canActivate: [AdminGuard],
        loadComponent: () =>
          import('./pages/admin/ejercicios-fiscales/ejercicios-fiscales.component').then((m) => m.EjerciciosFiscalesComponent)
      },
      {
        path: 'admin/prorroga-cierre',
        canActivate: [AdminGuard],
        loadComponent: () =>
          import('./pages/admin/prorroga-cierre/prorroga-cierre.component').then((m) => m.ProrrogaCierreComponent)
      },
      {
        path: 'admin/roles',
        canActivate: [AdminGuard],
        loadComponent: () => import('./pages/admin/roles/roles.component').then((m) => m.RolesComponent)
      },
      {
        path: 'admin/convenios',
        canActivate: [AdminGuard],
        loadComponent: () => import('./pages/admin/convenios/convenios.component').then((m) => m.ConveniosComponent)
      },
      {
        path: 'admin/pautas',
        canActivate: [AdminGuard],
        loadComponent: () => import('./pages/admin/pautas/pautas.component').then((m) => m.PautasComponent)
      },
      {
        path: 'admin/conceptos-recaudacion',
        canActivate: [AdminGuard],
        loadComponent: () => import('./pages/admin/conceptos/conceptos.component').then((m) => m.ConceptosComponent)
      },
      {
        path: 'admin/tipos-pauta',
        canActivate: [AdminGuard],
        loadComponent: () => import('./pages/admin/tipos-pauta/tipos-pauta.component').then((m) => m.TiposPautaComponent)
      },
      {
        path: 'admin/logs',
        canActivate: [AdminGuard],
        loadComponent: () => import('./pages/admin/logs/logs.component').then((m) => m.LogsComponent)
      },
      {
        path: 'admin/parametros',
        canActivate: [AdminGuard],
        loadComponent: () =>
          import('./pages/admin/configuracion-parametros/configuracion-parametros.component').then(
            (m) => m.ConfiguracionParametrosComponent
          )
      },
      {
        path: 'admin/municipios-mails',
        canActivate: [AdminGuard],
        loadComponent: () =>
          import('./pages/admin/municipios-mails/municipios-mails.component').then((m) => m.MunicipioMailsComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'not-found' }
];
