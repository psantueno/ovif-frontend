import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-seleccionar-municipio',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './seleccionar-municipio.component.html',
  styleUrls: ['./seleccionar-municipio.component.scss']
})
export class SeleccionarMunicipioComponent implements OnInit {
  municipios: any[] = [];

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.auth.obtenerMisMunicipios().subscribe({
      next: (municipios) => {
        this.municipios = municipios;
        if (municipios.length === 0) {
          this.router.navigate(['/home']);
        } else if (municipios.length === 1) {
          this.seleccionar(municipios[0]);
        }
      },
      error: (err) => {
        console.error('❌ Error obteniendo municipios', err);
        this.router.navigate(['/login']);
      }
    });
  }

  seleccionar(municipio: any) {
    localStorage.setItem('municipioSeleccionado', JSON.stringify(municipio));
    this.router.navigate(['/home']);
  }
}
