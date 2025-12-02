import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { finalize, take } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { MunicipioService } from '../../services/municipio.service';
import { ArchivosService, ArchivoMunicipio } from '../../services/archivos.service';

@Component({
  selector: 'app-subir-archivos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, MatIconModule, MatButtonModule],
  templateUrl: './subir-archivos.component.html',
  styleUrls: ['./subir-archivos.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubirArchivosComponent implements OnInit {
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  readonly extensionesPermitidas = [
    'doc',
    'docx',
    'gif',
    'jpeg',
    'jpg',
    'xls',
    'xlsx',
    'pdf',
    'png',
    'ppt',
    'pptx',
    'ppsx',
    'ps',
    'tif',
    'txt',
    'zip',
    'sql',
    'b64',
    'xml',
    'rar'
  ];

  readonly acceptExt = this.extensionesPermitidas.map((ext) => `.${ext}`).join(',');
  readonly tamanioMaximoBytes = 8 * 1024 * 1024; // 8MB

  municipioActual: any = null;
  ejercicioSeleccionado?: number;
  mesSeleccionado?: number;

  archivos: ArchivoMunicipio[] = [];
  cargandoLista = false;
  subiendoArchivo = false;
  archivoSeleccionado: File | null = null;
  nombreArchivoSeleccionado = '';

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly municipioService = inject(MunicipioService);
  private readonly archivosService = inject(ArchivosService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly formulario = this.fb.group({
    descripcion: ['', [Validators.maxLength(200)]]
  });

  ngOnInit(): void {
    this.municipioActual = this.municipioService.getMunicipioActual();

    if (!this.municipioActual?.municipio_id) {
      this.mostrarAlerta('Municipio no seleccionado', 'Debes elegir un municipio antes de subir archivos.', 'warning');
      this.router.navigate(['/panel-carga-mensual']);
      return;
    }

    this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
      const ejercicioMes = params.get('ejercicioMes');

      if (!ejercicioMes) {
        this.mostrarAlerta('Ejercicio inválido', 'Seleccioná un ejercicio y mes desde la pantalla principal.', 'info');
        this.router.navigate(['/panel-carga-mensual']);
        return;
      }

      const [ejercicioStr, mesStr] = ejercicioMes.split('_');
      const ejercicio = Number(ejercicioStr);
      const mes = Number(mesStr);

      if (!ejercicio || !mes) {
        this.mostrarAlerta('Datos inválidos', 'Los datos recibidos no son válidos. Probá nuevamente.', 'error');
        this.router.navigate(['/panel-carga-mensual']);
        return;
      }

      this.ejercicioSeleccionado = ejercicio;
      this.mesSeleccionado = mes;

      this.cargarArchivos();
    });
  }

  get nombreMesSeleccionado(): string {
    if (!this.mesSeleccionado) {
      return '';
    }

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
      'Diciembre'
    ];

    return meses[Math.max(0, Math.min(this.mesSeleccionado - 1, meses.length - 1))];
  }

  get descripcionControl() {
    return this.formulario.get('descripcion');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.archivoSeleccionado = null;
      this.nombreArchivoSeleccionado = '';
      return;
    }

    if (!this.esExtensionPermitida(file.name)) {
      this.mostrarAlerta('Formato no permitido', 'Ese tipo de archivo no está permitido para subir.', 'error');
      this.resetArchivoSeleccionado();
      return;
    }

    if (file.size > this.tamanioMaximoBytes) {
      const pesoMb = (file.size / (1024 * 1024)).toFixed(2);
      this.mostrarAlerta('Archivo muy grande', `El archivo pesa ${pesoMb} MB. El máximo permitido es de 8 MB.`, 'error');
      this.resetArchivoSeleccionado();
      return;
    }

    this.archivoSeleccionado = file;
    this.nombreArchivoSeleccionado = file.name;
    this.cdr.markForCheck();
  }

  subirArchivo(): void {
    if (this.subiendoArchivo) {
      return;
    }

    if (!this.archivoSeleccionado) {
      this.mostrarAlerta('Seleccioná un archivo', 'Debes elegir un archivo para poder subirlo.', 'info');
      return;
    }

    if (!this.ejercicioSeleccionado || !this.mesSeleccionado) {
      this.mostrarAlerta('Ejercicio no definido', 'Seleccioná nuevamente el ejercicio y mes desde la pantalla principal.', 'error');
      return;
    }

    this.subiendoArchivo = true;

    this.archivosService
      .subirArchivo(
        this.municipioActual.municipio_id,
        this.ejercicioSeleccionado,
        this.mesSeleccionado,
        this.archivoSeleccionado,
        this.formulario.value.descripcion ?? ''
      )
      .pipe(finalize(() => (this.subiendoArchivo = false)))
      .subscribe({
        next: () => {
          this.mostrarAlerta('Archivo cargado', 'El archivo se guardó correctamente.', 'success');
          this.formulario.reset();
          this.resetArchivoSeleccionado();
          this.cdr.markForCheck();
          this.cargarArchivos();
        },
        error: () => {
          this.mostrarAlerta('Error', 'No pudimos subir el archivo. Intentá nuevamente.', 'error');
          this.cdr.markForCheck();
        }
      });
  }

  cargarArchivos(): void {
    if (!this.ejercicioSeleccionado || !this.mesSeleccionado) {
      return;
    }

    this.cargandoLista = true;

    this.archivosService
      .listarArchivos(this.municipioActual.municipio_id, this.ejercicioSeleccionado, this.mesSeleccionado)
      .pipe(finalize(() => (this.cargandoLista = false)))
      .subscribe({
        next: (archivos) => {
          this.archivos = archivos ?? [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.archivos = [];
          this.mostrarAlerta('Error', 'No pudimos obtener los archivos existentes.', 'error');
          this.cdr.markForCheck();
        }
      });
  }

  obtenerNombreArchivo(archivo: ArchivoMunicipio): string {
    if (!archivo?.archivo_path) {
      return archivo?.archivo_descripcion ?? 'Archivo';
    }

    const partes = archivo.archivo_path.split(/[\\/]/);
    return partes.pop() ?? archivo.archivo_descripcion;
  }

  formatearFecha(fecha?: string): string {
    if (!fecha) {
      return '';
    }

    const parsed = new Date(fecha);
    if (Number.isNaN(parsed.getTime())) {
      return fecha;
    }

    return parsed.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  volverAlInicio(): void {
    this.router.navigate(['/panel-carga-mensual']);
  }

  private esExtensionPermitida(nombreArchivo: string): boolean {
    const extension = nombreArchivo.split('.').pop()?.toLowerCase() ?? '';
    return this.extensionesPermitidas.includes(extension);
  }

  resetArchivoSeleccionado(): void {
    this.archivoSeleccionado = null;
    this.nombreArchivoSeleccionado = '';
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
    this.cdr.markForCheck();
  }

  private mostrarAlerta(titulo: string, texto: string, icon: 'success' | 'error' | 'warning' | 'info'): void {
    Swal.fire({
      title: titulo,
      text: texto,
      icon,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#3085d6'
    });
  }
}
