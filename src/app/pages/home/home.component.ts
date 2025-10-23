import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MunicipioService } from '../../services/municipio.service';
import { take } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  municipioSeleccionado: any = null;
  ejercicioMes: string = '';
  ejerciciosMeses: any[] = [];
  cargando = false;
  private periodoPersistido: { ejercicio: number; mes: number } | null = null;
  private municipioSub?: Subscription;
  private sinMunicipioAlertado = false;

  constructor(private router: Router, private readonly municipioService: MunicipioService) {}

  ngOnInit(): void {
    this.municipioSub = this.municipioService.municipio$.subscribe((municipio) => {
      this.municipioSeleccionado = municipio;
      this.periodoPersistido = null;
      this.ejerciciosMeses = [];
      this.ejercicioMes = '';

      if (!municipio?.municipio_id) {
        this.cargando = false;
        if (!this.sinMunicipioAlertado) {
          this.sinMunicipioAlertado = true;
          Swal.fire({
            icon: 'warning',
            title: 'Municipio no seleccionado',
            text: 'Debes elegir un municipio para consultar los ejercicios disponibles.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#3085d6'
          });
        }
        return;
      }

      this.sinMunicipioAlertado = false;
      this.periodoPersistido = this.municipioService.getPeriodoSeleccionado(municipio.municipio_id);
      this.cargarEjerciciosDisponibles(municipio.municipio_id);
    });
  }

  private cargarEjerciciosDisponibles(municipioId: number): void {
    this.cargando = true;
    this.ejerciciosMeses = [];
    const periodoGuardado = this.periodoPersistido;
    this.ejercicioMes = periodoGuardado ? `${periodoGuardado.ejercicio}_${periodoGuardado.mes}` : '';

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

          if (periodoGuardado) {
            const valorPersistido = `${periodoGuardado.ejercicio}_${periodoGuardado.mes}`;
            const disponible = this.ejerciciosMeses.some((item) => item.valor === valorPersistido);

            if (disponible) {
              this.ejercicioMes = valorPersistido;
              this.periodoPersistido = periodoGuardado;
            } else {
              this.ejercicioMes = '';
              this.periodoPersistido = null;
              if (this.municipioSeleccionado?.municipio_id) {
                this.municipioService.clearPeriodoSeleccionado(this.municipioSeleccionado.municipio_id);
              }
            }
          } else {
            this.ejercicioMes = '';
            this.periodoPersistido = null;
          }

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


  onPeriodoChange(valor: string): void {
    this.ejercicioMes = valor;

    const municipioId = this.municipioSeleccionado?.municipio_id;
    if (!municipioId) {
      return;
    }

    if (!valor) {
      this.periodoPersistido = null;
      this.municipioService.clearPeriodoSeleccionado(municipioId);
      return;
    }

    const [ejercicioStr, mesStr] = valor.split('_');
    const ejercicio = Number(ejercicioStr);
    const mes = Number(mesStr);

    if (Number.isInteger(ejercicio) && Number.isInteger(mes)) {
      const periodo = { ejercicio, mes };
      this.periodoPersistido = periodo;
      this.municipioService.setPeriodoSeleccionado(municipioId, periodo);
    } else {
      this.periodoPersistido = null;
      this.municipioService.clearPeriodoSeleccionado(municipioId);
    }
  }

  ngOnDestroy(): void {
    this.municipioSub?.unsubscribe();
  }

  private persistirPeriodoActual(): void {
    const municipioId = this.municipioSeleccionado?.municipio_id;
    if (!municipioId || !this.ejercicioMes) {
      if (municipioId) {
        this.periodoPersistido = null;
        this.municipioService.clearPeriodoSeleccionado(municipioId);
      }
      return;
    }

    const [ejercicioStr, mesStr] = this.ejercicioMes.split('_');
    const ejercicio = Number(ejercicioStr);
    const mes = Number(mesStr);

    if (Number.isInteger(ejercicio) && Number.isInteger(mes)) {
      const periodo = { ejercicio, mes };
      this.periodoPersistido = periodo;
      this.municipioService.setPeriodoSeleccionado(municipioId, periodo);
    }
  }

  irA(modulo: string) {
    this.persistirPeriodoActual();

    if (!this.ejercicioMes) {
      Swal.fire({
        icon: 'info',
        title: 'Selecciona un periodo',
        text: 'Debes elegir un ejercicio y mes antes de continuar.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#3085d6',
      });
      return;
    }
    // 🚀 Lógica de navegación según módulo
    this.router.navigate([`/${modulo}`], {
      queryParams: { ejercicioMes: this.ejercicioMes }
    });
  }

  async cerrarMes() {
    this.persistirPeriodoActual();

    if (!this.ejercicioMes) {
      await Swal.fire({
        icon: 'info',
        title: 'Selecciona un periodo',
        text: 'Debes elegir un ejercicio y mes antes de cerrar el periodo.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Cerrar periodo',
      text: '¿Seguro deseas cerrar el mes seleccionado?',
      showCancelButton: true,
      confirmButtonText: 'Si, cerrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
    });

    if (isConfirmed) {
      console.log('Cerrar mes:', this.ejercicioMes);
      // 🚀 Acá iría la llamada al backend
    }
  }
}
