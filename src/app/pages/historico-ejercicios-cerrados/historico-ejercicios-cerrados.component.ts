import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import Swal from 'sweetalert2';

import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { MunicipioService } from '../../services/municipio.service';
import { EjerciciosService, ModuloCerrado } from '../../services/ejercicios.service';

type MensajeTipo = 'info' | 'error' | 'success';

@Component({
  selector: 'app-historico-ejercicios-cerrados',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule, BackButtonComponent],
  templateUrl: './historico-ejercicios-cerrados.component.html',
  styleUrls: ['./historico-ejercicios-cerrados.component.scss']
})
export class HistoricoEjerciciosCerradosComponent implements OnInit {
  private readonly municipioService = inject(MunicipioService);
  private readonly ejerciciosService = inject(EjerciciosService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  municipioActual: any = null;
  //filtros: InformesFiltrosResponse = { ejercicios: [], meses: [], modulos: [] };
  modulosCerrados: ModuloCerrado[] = []
  filtroEjercicios: number[] = []
  filtroMeses: number[] = []
  filtroModulos: string[] = []

  cargandoFiltros = false;
  cargandoInforme = false;
  mensaje: { tipo: MensajeTipo; texto: string } | null = null;

  readonly mesesNombres = [
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
    'Diciembre'
  ];

  readonly form = this.fb.group({
    ejercicio: [null as number | null, [Validators.required]],
    mes: [null as number | null, [Validators.required]],
    modulo: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.municipioActual = this.municipioService.getMunicipioActual();

    if (!this.municipioActual?.municipio_id) {
      this.mostrarAlerta('Municipio no seleccionado', 'Seleccioná un municipio para ver los informes.', 'info');
      this.router.navigate(['/panel-carga-mensual']);
      return;
    }

    this.cargarFiltros();

    this.form.valueChanges.subscribe(() => {
      this.actualizarFiltros();
    })
  }

  private unique<T>(array: T[]): T[] {
    return [...new Set(array)];
  }

  private actualizarFiltros(): void {
    const { ejercicio, mes, modulo } = this.form.value;
    this.filtroEjercicios = this.unique(
    this.modulosCerrados
      .filter(i => (!mes || i.mes === mes) && (!modulo || i.modulo === modulo))
      .map(i => i.ejercicio)
    );
    this.filtroMeses = this.unique(
      this.modulosCerrados
        .filter(i => (!ejercicio || i.ejercicio === ejercicio) && (!modulo || i.modulo === modulo))
        .map(i => i.mes)
        .sort((a, b) => a - b)
    );
    this.filtroModulos = this.unique(
      this.modulosCerrados
        .filter(i => (!ejercicio || i.ejercicio === ejercicio) && (!mes || i.mes === mes))
        .map(i => i.modulo)
    );
  }

  limpiarFiltros() {
    this.form.patchValue({ ejercicio: null }, { emitEvent: false });
    this.form.patchValue({ mes: null }, { emitEvent: false });
    this.form.patchValue({ modulo: '' }, { emitEvent: false });

    // 2️⃣ recalcular opciones disponibles
    this.filtroEjercicios = this.unique(this.modulosCerrados.map(f => f.ejercicio));
    this.filtroMeses = this.unique(this.modulosCerrados.map(f => f.mes));
    this.filtroModulos = this.unique(this.modulosCerrados.map(f => f.modulo));
  }

  get municipioNombre(): string {
    return this.municipioActual?.municipio_nombre ?? 'Municipio';
  }

  get mesSeleccionadoLabel(): string {
    const mes = this.form.value.mes;
    if (!mes || mes < 1 || mes > 12) {
      return '';
    }
    return this.mesesNombres[mes - 1] ?? '';
  }

  formatModulo(modulo: string | null | undefined): string {
    if (!modulo) {
      return '';
    }

    return String(modulo)
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  cargarFiltros(): void {
    if (!this.municipioActual?.municipio_id) {
      return;
    }
    this.cargandoFiltros = true;
    this.ejerciciosService
      .obtenerFiltrosInformes(this.municipioActual.municipio_id)
      .subscribe({
        next: (modulosCerrados) => {
          this.modulosCerrados = modulosCerrados
          this.cargandoFiltros = false;
          this.resetMensaje();
          this.filtroEjercicios = this.unique(modulosCerrados.map(d => d.ejercicio));
          this.filtroMeses = this.unique(modulosCerrados.map(d => d.mes)).sort((a, b) => a - b);
          this.filtroModulos = this.unique(modulosCerrados.map(d => d.modulo));
        },
        error: () => {
          this.cargandoFiltros = false;
          this.mostrarAlerta('Error', 'No pudimos obtener los filtros disponibles. Probá nuevamente.', 'error');
        }
      });
  }

  descargarInforme(): void {
    if (this.cargandoInforme) {
      return;
    }
    if (this.form.invalid || !this.municipioActual?.municipio_id) {
      this.mostrarAlerta('Filtros incompletos', 'Seleccioná ejercicio, mes y módulo para descargar.', 'info');
      this.form.markAllAsTouched();
      return;
    }

    const { ejercicio, mes, modulo } = this.form.value;
    this.cargandoInforme = true;
    this.resetMensaje();

    this.ejerciciosService
      .descargarInformeModulo({
        municipio_id: this.municipioActual.municipio_id,
        ejercicio: Number(ejercicio),
        mes: Number(mes),
        modulo: String(modulo ?? '')
      })
      .subscribe({
        next: (response) => {
            this.cargandoInforme = false;

            const blob = response.body!;

            // ⭐ obtener header
            const contentDisposition =
              response.headers.get('content-disposition');

            let filename = 'archivo.pdf';

            if (contentDisposition) {
              const match = contentDisposition.match(/filename="?([^"]+)"?/);
              if (match?.[1]) {
                filename = match[1];
              }
            }

            // crear descarga
            const url = window.URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();

            window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          this.cargandoInforme = false;
          const status = error?.status;
          if (status === 404) {
            this.mostrarAlerta('Sin datos', 'No hay informe disponible con esos filtros.', 'info');
          } else if (status === 400) {
            this.mostrarAlerta('Datos inválidos', 'Revisá los filtros seleccionados.', 'error');
          } else {
            this.mostrarAlerta('Error', 'No pudimos obtener el informe. Intentá nuevamente.', 'error');
          }
        }
      });
  }

  private mostrarAlerta(titulo: string, texto: string, icon: MensajeTipo): void {
    Swal.fire({
      title: titulo,
      text: texto,
      icon,
      confirmButtonText: 'Aceptar'
    });
  }

  private resetMensaje(): void {
    this.mensaje = null;
  }
}
