import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import Swal from 'sweetalert2';

import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { MunicipioService } from '../../services/municipio.service';
import { EjerciciosService, InformesFiltrosResponse } from '../../services/ejercicios.service';

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
  filtros: InformesFiltrosResponse = { ejercicios: [], meses: [], modulos: [] };

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

  cargarFiltros(): void {
    if (!this.municipioActual?.municipio_id) {
      return;
    }
    this.cargandoFiltros = true;
    this.ejerciciosService
      .obtenerFiltrosInformes(this.municipioActual.municipio_id)
      .subscribe({
        next: (filtros) => {
          this.filtros = filtros ?? { ejercicios: [], meses: [], modulos: [] };
          this.cargandoFiltros = false;
          this.resetMensaje();
          // Autoselección básica si hay un solo valor disponible
          if (this.filtros.ejercicios.length === 1) {
            this.form.patchValue({ ejercicio: this.filtros.ejercicios[0] });
          }
          if (this.filtros.meses.length === 1) {
            this.form.patchValue({ mes: this.filtros.meses[0] });
          }
          if (this.filtros.modulos.length === 1) {
            this.form.patchValue({ modulo: this.filtros.modulos[0] });
          }
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
      .obtenerInformeModulo({
        municipio_id: this.municipioActual.municipio_id,
        ejercicio: Number(ejercicio),
        mes: Number(mes),
        modulo: String(modulo ?? '')
      })
      .subscribe({
        next: (resp) => {
          this.cargandoInforme = false;
          if (!resp?.downloadUrl) {
            this.mostrarAlerta('Sin datos', 'No encontramos un informe para esos filtros.', 'info');
            return;
          }
          this.dispararDescarga(resp.downloadUrl);
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

  private dispararDescarga(url: string): void {
    this.ejerciciosService.descargarInformePDF(url, this.municipioActual.municipio_id).subscribe({
      next: (response) => {
        // 1️⃣ Obtener el nombre del archivo desde headers
        const contentDisposition = response.headers.get('Content-Disposition');

        let fileName = 'informe.pdf'; // fallback

        if (contentDisposition) {
          // Soporta: filename="archivo.pdf"
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match && match[1]) {
            fileName = match[1];
          }
        }

        // 2️⃣ Obtener el Blob real
        const blob = response.body!;
        const objectUrl = URL.createObjectURL(blob);

        // 3️⃣ Descargar
        const downloadLink = document.createElement('a');
        downloadLink.href = objectUrl;
        downloadLink.download = fileName;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        URL.revokeObjectURL(objectUrl);
      },
      error: () => {
        this.mostrarAlerta('Error', 'No pudimos descargar el informe. Intentá nuevamente.', 'error');
      }
    });
  }
}
