import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { HomeComponent } from './pages/home/home.component';
import { SeleccionarMunicipioComponent } from './pages/seleccionar-municipio/seleccionar-municipio.component';
import { AuthGuard } from './core/guards/auth.guard';

// Admin
import { AdminMenuComponent } from './pages/admin/admin-menu/admin-menu.component';
import { UsuariosComponent } from './pages/admin/usuarios/usuarios.component';
// cuando crees estos módulos, importalos acá
// import { RolesComponent } from './pages/admin/roles/roles.component';
// import { EjerciciosComponent } from './pages/admin/ejercicios/ejercicios.component';
// import { AuditoriasComponent } from './pages/admin/auditorias/auditorias.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: SeleccionarMunicipioComponent, canActivate: [AuthGuard] },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },

  // Admin
  { path: 'admin', component: AdminMenuComponent, canActivate: [AuthGuard] },
  { path: 'admin/usuarios', component: UsuariosComponent, canActivate: [AuthGuard] },
  // { path: 'admin/roles', component: RolesComponent, canActivate: [AuthGuard] },
  // { path: 'admin/ejercicios', component: EjerciciosComponent, canActivate: [AuthGuard] },
  // { path: 'admin/auditorias', component: AuditoriasComponent, canActivate: [AuthGuard] },

  { path: '**', redirectTo: '' }
];
