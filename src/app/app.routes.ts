import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { HomeComponent } from './pages/home/home.component';

export const routes: Routes = [
  { path: '', component: LoginComponent }, // Ruta para la página de login
  { path: 'home', component: HomeComponent }, // Ruta para la página de inicio (Home)
  { path: '**', redirectTo: '' } // Redirige cualquier ruta no encontrada al login
];