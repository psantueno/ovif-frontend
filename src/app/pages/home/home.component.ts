import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';



@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  municipioSeleccionado: any = null;
  ejercicioMes: string = '';
  ejerciciosMeses: any[] = [];

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Recuperar municipio seleccionado desde localStorage
    this.municipioSeleccionado = JSON.parse(localStorage.getItem('municipioSeleccionado') || 'null');

    // Simulación de carga desde backend (ejercicios y meses)
    this.ejerciciosMeses = [
      { valor: '2025_3', texto: '2025 - Marzo (cierra el 31/03/2025)' },
      { valor: '2025_2', texto: '2025 - Febrero (cierra el 28/02/2025)' },
      { valor: '2025_1', texto: '2025 - Enero (cierra el 31/01/2025)' }
    ];
  }

  irA(modulo: string) {
    if (!this.ejercicioMes) {
      alert('Seleccione ejercicio/mes');
      return;
    }
    // 🚀 Lógica de navegación según módulo
    this.router.navigate([`/${modulo}`], {
      queryParams: { ejercicioMes: this.ejercicioMes }
    });
  }

  cerrarMes() {
    if (!this.ejercicioMes) {
      alert('Seleccione ejercicio/mes');
      return;
    }
    if (confirm(`¿Seguro desea cerrar el mes seleccionado?`)) {
      console.log('Cerrar mes:', this.ejercicioMes);
      // 🚀 Acá iría la llamada al backend
    }
  }
}
