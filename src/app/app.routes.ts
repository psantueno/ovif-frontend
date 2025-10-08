import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { HomeComponent } from './pages/home/home.component';
import { SeleccionarMunicipioComponent } from './pages/seleccionar-municipio/seleccionar-municipio.component';
import { AuthGuard } from './core/guards/auth.guard';

// Admin
import { AdminMenuComponent } from './pages/admin/admin-menu/admin-menu.component';
import { UsuariosComponent } from './pages/admin/usuarios/usuarios.component';
import { MainLayout } from './shared/layouts/main-layout.component';
// cuando crees estos módulos, importalos acá
// import { RolesComponent } from './pages/admin/roles/roles.component';
// import { EjerciciosComponent } from './pages/admin/ejercicios/ejercicios.component';
// import { AuditoriasComponent } from './pages/admin/auditorias/auditorias.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: MainLayout,
    canActivate: [AuthGuard],
    children: [
      { path: '', component: SeleccionarMunicipioComponent },
      { path: 'home', component: HomeComponent },
      { path: 'admin', component: AdminMenuComponent },
      { path: 'admin/usuarios', component: UsuariosComponent },
      // { path: 'admin/roles', component: RolesComponent },
      // { path: 'admin/ejercicios', component: EjerciciosComponent },
      // { path: 'admin/auditorias', component: AuditoriasComponent },
    ]
  },
  { path: '**', redirectTo: '' }
];
