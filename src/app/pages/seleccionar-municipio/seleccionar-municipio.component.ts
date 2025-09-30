import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';   // 👈 importa CommonModule
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-seleccionar-municipio',
  standalone: true,
  imports: [CommonModule],   // 👈 agregalo acá
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

      if (this.municipios.length === 0) {
        // 👉 No tiene municipios asignados → va directo a Home
        this.router.navigate(['/home']);
      } else if (this.municipios.length === 1) {
        // 👉 Tiene uno solo → lo selecciona automático
        this.seleccionar(this.municipios[0]);
      }
      // 👉 Si tiene más de uno, se queda mostrando la vista para elegir
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
