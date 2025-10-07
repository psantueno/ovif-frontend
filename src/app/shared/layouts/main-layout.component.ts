import { Component } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, MatIconModule],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayout {
  municipioSeleccionado = JSON.parse(localStorage.getItem('municipioSeleccionado') || 'null');

  constructor(private router: Router) {}

  irASeleccionMunicipio() {
    this.router.navigate(['/seleccionar-municipio']);
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('municipioSeleccionado');
    this.router.navigate(['/login']);
  }
}
