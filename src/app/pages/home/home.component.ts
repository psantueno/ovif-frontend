import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MunicipioService } from '../../services/municipio.service';
import { take } from 'rxjs/operators';
import Swal from 'sweetalert2';

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
  cargando = false;

  constructor(private router: Router, private readonly municipioService: MunicipioService) {}

  ngOnInit(): void {
    this.municipioSeleccionado = this.municipioService.getMunicipioActual();

    if (!this.municipioSeleccionado?.municipio_id) {
      Swal.fire({
        icon: 'warning',
        title: 'Municipio no seleccionado',
        text: 'Debes elegir un municipio para consultar los ejercicios disponibles.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    this.cargarEjerciciosDisponibles(this.municipioSeleccionado.municipio_id);
  }

  private cargarEjerciciosDisponibles(municipioId: number): void {
    this.cargando = true;
    this.ejerciciosMeses = [];
    this.ejercicioMes = '';

    this.municipioService
      .getEjerciciosDisponibles(municipioId)
      .pipe(take(1))
      .subscribe({
        next: (ejercicios) => {
          this.ejerciciosMeses = ejercicios.map((item: any) => ({
            valor: `${item.ejercicio}_${item.mes}`,
            texto: `${item.ejercicio} - ${this.obtenerNombreMes(item.mes)} (cierra el ${this.formatearFecha(item.fecha_fin || item.fecha_fin_oficial)})`,
            metadata: item,
          }));

          if (this.ejerciciosMeses.length === 0) {
            Swal.fire({
              icon: 'info',
              title: 'Sin ejercicios disponibles',
              text: 'No hay ejercicios abiertos para este municipio en este momento.',
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#3085d6',
            });
          }
        },
        error: () => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No fue posible obtener los ejercicios disponibles.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33',
          });
          this.cargando = false;
        },
        complete: () => {
          this.cargando = false;
        },
      });
  }

  private obtenerNombreMes(mes: number): string {
    const meses = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
    ];
    return meses[Math.max(0, Math.min(mes - 1, meses.length - 1))];
  }

  private formatearFecha(fecha: string | null): string {
    if (!fecha) {
      return 'Sin fecha';
    }

    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) {
      return fecha;
    }

    return parsed.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
