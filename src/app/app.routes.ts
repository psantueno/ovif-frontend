import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { HomeComponent } from './pages/home/home.component';
import { SeleccionarMunicipioComponent } from './pages/seleccionar-municipio/seleccionar-municipio.component';
import { AuthGuard } from './core/guards/auth.guard'; 

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: SeleccionarMunicipioComponent, canActivate: [AuthGuard] },
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '' }
];
