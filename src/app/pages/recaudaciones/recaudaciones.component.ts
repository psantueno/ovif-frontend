import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, take } from 'rxjs/operators';
import Swal from 'sweetalert2';

import {
  MunicipioService,
  PeriodoSeleccionadoMunicipio,
  ConceptoRecaudacionUpsertPayload,
} from '../../services/municipio.service';
import { EjerciciosService } from '../../services/ejercicios.service';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { LoadingOverlayComponent } from '../../shared/components/loading-overlay/loading-overlay.component';
import {
  parseRecaudacionesExcelFile,
  RecaudacionPreviewRow,
} from '../../core/utils/recaudacionesExcelParser.util';

type MensajeTipo = 'info' | 'error';

@Component({
  selector: 'app-recaudaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, BackButtonComponent, LoadingOverlayComponent],
  templateUrl: './recaudaciones.component.html',
  styleUrls: ['./recaudaciones.component.scss'],
})
export class RecaudacionesComponent implements OnInit, OnDestroy {
  private readonly municipioService = inject(MunicipioService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ejerciciosService = inject(EjerciciosService);

  readonly meses = [
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

  municipioActual: any = null;
  municipioNombre = '';
  ejercicioSeleccionado?: number;
  mesSeleccionado?: number;
  periodoSeleccionado: PeriodoSeleccionadoMunicipio | null = null;
  esRectificacion = false;

  mesCerrado = false;
  mensaje: { tipo: MensajeTipo; texto: string } | null = null;
  mensajeTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly plantillaRecaudacionesExcelUrl = 'assets/plantillas/plantilla_recaudaciones.xlsx';
  readonly plantillaRecaudacionesManualUrl = 'assets/plantillas/manual.pdf';

  archivoMasivoSeleccionado: File | null = null;
  previsualizacionMasiva: RecaudacionPreviewRow[] = [];

  totalFilasLeidas = 0;
  filasValidas = 0;
  filasConErrores = 0;

  erroresCargaMasiva: string[] = [];
  cargandoArchivoMasivo = false;

  guardando = false;
  descargandoInforme = false;

  ngOnInit(): void {
    this.municipioActual = this.municipioService.getMunicipioActual();

    if (!this.municipioActual?.municipio_id) {
      this.mostrarAlerta(
        'Municipio no seleccionado',
        'Elegí un municipio desde la pantalla principal para continuar.',
        'warning'
      );
      this.router.navigate(['/panel-carga-mensual']);
      return;
    }

    this.municipioNombre = this.municipioActual.municipio_nombre ?? 'Municipio';

    this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
      const ejercicioMes = params.get('ejercicioMes');
      const rectificacion = params.get('rectificacion');
      this.esRectificacion = rectificacion === 'true';

      if (!ejercicioMes) {
        this.mostrarAlerta(
          'Período no definido',
          'Seleccioná un ejercicio y mes desde el menú principal.',
          'info'
        );
        this.router.navigate(['/panel-carga-mensual']);
        return;
      }

      const partes = ejercicioMes.split('_');
      const parsedValor = this.municipioService.parsePeriodoValor(ejercicioMes);
      const ejercicio = parsedValor?.ejercicio ?? Number(partes[0]);
      const mes = parsedValor?.mes ?? Number(partes[1]);

      if (!Number.isInteger(ejercicio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        this.mostrarAlerta(
          'Datos inválidos',
          'Los datos recibidos no son válidos. Probá nuevamente.',
          'error'
        );
        this.router.navigate(['/panel-carga-mensual']);
        return;
      }

      this.ejercicioSeleccionado = ejercicio;
      this.mesSeleccionado = mes;
      this.sincronizarPeriodoSeleccionado(ejercicio, mes, parsedValor ?? undefined);

      if (!this.esModuloPermitido()) {
        this.mostrarAlerta(
          'Pauta no habilitada',
          'El período seleccionado no permite cargar Recaudaciones. Elegí otra opción desde el inicio.',
          'info'
        );
        this.router.navigate(['/panel-carga-mensual']);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.mensajeTimeout) {
      clearTimeout(this.mensajeTimeout);
    }
  }

  get mesActualLabel(): string {
    const periodo = this.periodoSeleccionado;
    if (!periodo?.mes || !periodo?.ejercicio) {
      return '';
    }

    const index = periodo.mes - 1;
    const nombreMes = this.meses[index] ?? '';
    return nombreMes ? `${nombreMes} ${periodo.ejercicio}` : '';
  }

  get obtenerTotalFilasMasivas(): number {
    return this.totalFilasLeidas;
  }

  get totalesAgrupadosPorCodigo(): Array<{ codigo_tributo: number; descripcion: string; total: number }> {
    const totales = new Map<number, { codigo_tributo: number; descripcion: string; total: number }>();

    this.previsualizacionMasiva.forEach((fila) => {
      if (fila.tieneError || fila.codigo_tributo === null || fila.importe_recaudacion === null) {
        return;
      }

      const acumulado = totales.get(fila.codigo_tributo) ?? {
        codigo_tributo: fila.codigo_tributo,
        descripcion: fila.descripcion,
        total: 0,
      };

      if (!acumulado.descripcion && fila.descripcion) {
        acumulado.descripcion = fila.descripcion;
      }

      acumulado.total += Number(fila.importe_recaudacion);
      totales.set(fila.codigo_tributo, acumulado);
    });

    return Array.from(totales.values()).sort((a, b) => a.codigo_tributo - b.codigo_tributo);
  }

  get puedeSubirMasiva(): boolean {
    if (this.cargandoArchivoMasivo) {
      return false;
    }

    if (this.guardando) {
      return false;
    }

    if (!this.previsualizacionMasiva.length) {
      return false;
    }

    if (this.erroresCargaMasiva.length > 0) {
      return false;
    }

    return this.filasConErrores === 0;
  }

  get tieneErroresPrevisualizacion(): boolean {
    return this.filasConErrores > 0;
  }

  async onArchivoSeleccionado(event: Event, input?: HTMLInputElement): Promise<void> {
    const target = event.target as HTMLInputElement | null;
    const archivo = target?.files?.[0] ?? null;

    this.resetEstadoCargaMasiva();
    this.archivoMasivoSeleccionado = null;

    if (!archivo) {
      if (input) {
        input.value = '';
      }
      return;
    }

    const archivoNombre = archivo.name.toLowerCase();
    if (!archivoNombre.endsWith('.xlsx') && !archivoNombre.endsWith('.xls')) {
      this.erroresCargaMasiva.push('Seleccioná un archivo en formato .xlsx o .xls.');
      return;
    }

    this.archivoMasivoSeleccionado = archivo;
    this.cargandoArchivoMasivo = true;

    try {
      const resultado = await parseRecaudacionesExcelFile(archivo);

      this.previsualizacionMasiva = resultado.rows;
      this.totalFilasLeidas = resultado.totalRowsRead;
      this.filasValidas = resultado.validRows;
      this.filasConErrores = resultado.invalidRows;
      this.erroresCargaMasiva = [...resultado.globalErrors];

      if (resultado.totalRowsRead === 0 && this.erroresCargaMasiva.length === 0) {
        this.erroresCargaMasiva.push('El archivo no contiene datos de recaudaciones para importar.');
      }
    } catch (error) {
      console.error('Error al procesar archivo de recaudaciones:', error);
      this.erroresCargaMasiva.push('No se pudo procesar el archivo. Verificá que sea una planilla Excel válida.');
    } finally {
      this.cargandoArchivoMasivo = false;
    }
  }

  async insertarRecaudacionesMasivas(): Promise<void> {
    const municipioId = this.municipioActual?.municipio_id ?? null;
    if (!municipioId) {
      this.mostrarError('No pudimos identificar el municipio seleccionado.');
      return;
    }

    if (!this.previsualizacionMasiva.length) {
      this.mostrarError('No hay datos cargados para enviar.');
      return;
    }

    if (this.erroresCargaMasiva.length > 0) {
      this.mostrarError('La planilla contiene errores de estructura. Corregila y volvé a intentar.');
      return;
    }

    if (this.filasConErrores > 0) {
      this.mostrarError(`No se puede guardar: hay ${this.filasConErrores} fila(s) con errores.`);
      return;
    }

    const periodo = this.periodoSeleccionado;
    const ejercicio = periodo?.ejercicio ?? this.ejercicioSeleccionado ?? null;
    const mes = periodo?.mes ?? this.mesSeleccionado ?? null;

    if (!ejercicio || !mes) {
      this.mostrarError('No pudimos identificar el período seleccionado.');
      return;
    }

    const conceptosPayload: ConceptoRecaudacionUpsertPayload[] = this.previsualizacionMasiva
      .filter((fila) => !fila.tieneError)
      .map((fila) => ({
        codigo_tributo: fila.codigo_tributo as number,
        descripcion: fila.descripcion,
        importe_recaudacion: fila.importe_recaudacion as number,
        ente_recaudador: fila.ente_recaudador,
      }));

    if (!conceptosPayload.length) {
      this.mostrarError('No hay filas válidas para guardar.');
      return;
    }

    const ejecutarGuardado = (): void => {
      this.guardando = true;

      const request$ = this.esRectificacion
        ? this.municipioService.guardarConceptosRecaudacionRectificada({
            municipioId,
            ejercicio,
            mes,
            conceptos: conceptosPayload,
          })
        : this.municipioService.guardarConceptosRecaudacion({
            municipioId,
            ejercicio,
            mes,
            conceptos: conceptosPayload,
          });

      request$
        .pipe(
          take(1),
          finalize(() => {
            this.guardando = false;
          })
        )
        .subscribe({
          next: (response) => {
            if (response.resumen.errores?.length) {
              const erroresConcatenados = response.resumen.errores.join('\n');
              this.mostrarToastAviso('La carga se completó con observaciones.', erroresConcatenados);
            } else {
              this.mostrarToastExito('Los importes fueron guardados correctamente.');
            }

            this.archivoMasivoSeleccionado = null;
            this.resetEstadoCargaMasiva();
          },
          error: (error) => {
            console.error('Error al guardar recaudaciones:', error);
            this.mostrarError('No pudimos guardar los importes. Intentá nuevamente más tarde.');
          },
        });
    };

    if (this.esRectificacion) {
      Swal.fire({
        title: '¿Confirma que desea guardar los importes de rectificación?',
        text: 'No se volverá a habilitar un período de rectificación para este ejercicio y mes. Asegurate de que los datos ingresados sean correctos antes de confirmar.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'No, revisar',
      }).then((result) => {
        if (result.isConfirmed) {
          ejecutarGuardado();
        }
      });
      return;
    }

    ejecutarGuardado();
  }

  limpiarArchivoMasiva(input?: HTMLInputElement): void {
    if (input) {
      input.value = '';
    }

    this.archivoMasivoSeleccionado = null;
    this.resetEstadoCargaMasiva();
  }

  generarInforme(): void {
    if (this.mesCerrado) {
      return;
    }

    if (this.guardando) {
      this.mostrarMensaje('info', 'Esperá a que finalice el guardado de los importes.');
      return;
    }

    if (this.archivoMasivoSeleccionado && this.previsualizacionMasiva.length > 0) {
      this.mostrarError('Subí los importes antes de generar el informe para visualizarlo actualizado.');
      return;
    }

    if (this.descargandoInforme) {
      return;
    }

    const municipioId = this.municipioActual?.municipio_id ?? null;
    const periodo = this.periodoSeleccionado;
    const ejercicio = periodo?.ejercicio ?? this.ejercicioSeleccionado ?? null;
    const mes = periodo?.mes ?? this.mesSeleccionado ?? null;

    if (!municipioId || !ejercicio || !mes) {
      this.mostrarError('No pudimos identificar el municipio o período seleccionado.');
      return;
    }

    this.descargandoInforme = true;

    const request$ = this.esRectificacion
      ? this.municipioService.descargarInformeRecaudacionesRectificadas({ municipioId, ejercicio, mes })
      : this.municipioService.descargarInformeRecaudaciones({ municipioId, ejercicio, mes });

    request$
      .pipe(
        take(1),
        finalize(() => {
          this.descargandoInforme = false;
        })
      )
      .subscribe({
        next: (response) => {
          const blob = response.body;
          if (!blob || blob.size === 0) {
            this.mostrarError('No recibimos el archivo del informe. Intentá nuevamente más tarde.');
            return;
          }

          const contentDisposition = response.headers?.get('Content-Disposition') ?? null;
          const filename =
            this.obtenerNombreArchivo(contentDisposition) ?? this.construirNombreArchivoInforme(ejercicio, mes);

          this.descargarArchivo(blob, filename);
          this.mostrarToastExito('Informe descargado correctamente.');
        },
        error: (error) => {
          console.error('Error al generar el informe de recaudaciones:', error);
          this.mostrarError('No pudimos generar el informe. Intentá nuevamente más tarde.');
        },
      });
  }

  private mostrarMensaje(tipo: MensajeTipo, texto: string): void {
    if (tipo === 'error') {
      if (this.mensajeTimeout) {
        clearTimeout(this.mensajeTimeout);
      }
      this.mensaje = null;
      this.mensajeTimeout = null;
      this.mostrarError(texto);
      return;
    }

    this.mensaje = { tipo, texto };
    if (this.mensajeTimeout) {
      clearTimeout(this.mensajeTimeout);
    }
    this.mensajeTimeout = setTimeout(() => {
      this.mensaje = null;
      this.mensajeTimeout = null;
    }, 8000);
  }

  private mostrarAlerta(
    titulo: string,
    texto: string,
    icon: 'success' | 'error' | 'warning' | 'info'
  ): void {
    Swal.fire({
      title: titulo,
      text: texto,
      icon,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#3085d6',
    });
  }

  private mostrarError(mensaje: string, titulo = 'Ocurrió un problema'): void {
    Swal.fire({
      icon: 'error',
      title: titulo,
      text: mensaje,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#e53935',
      allowOutsideClick: false,
      allowEscapeKey: false,
    });
  }

  private mostrarToastExito(mensaje: string): Promise<void> {
    return Swal.fire({
      toast: true,
      icon: 'success',
      title: mensaje,
      position: 'top-end',
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true,
    }).then(() => undefined);
  }

  private mostrarToastAviso(title: string, mensaje: string): Promise<void> {
    return Swal.fire({
      toast: true,
      icon: 'info',
      title,
      text: mensaje,
      position: 'top-end',
      showConfirmButton: false,
      timer: 10000,
      timerProgressBar: true,
    }).then(() => undefined);
  }

  private descargarArchivo(blob: Blob, filename: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  private obtenerNombreArchivo(contentDisposition: string | null): string | null {
    if (!contentDisposition) {
      return null;
    }

    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utf8Match?.[1]) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch {
        return utf8Match[1];
      }
    }

    const asciiMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
    if (asciiMatch?.[1]) {
      return asciiMatch[1];
    }

    return null;
  }

  private construirNombreArchivoInforme(ejercicio: number, mes: number): string {
    const slugMunicipio = this.normalizarTextoParaArchivo(this.municipioNombre || 'municipio');
    const mesStr = mes.toString().padStart(2, '0');
    const nombre = this.esRectificacion
      ? `informe_rectificacion_recaudaciones_${slugMunicipio}_${ejercicio}_${mesStr}.pdf`
      : `informe_recaudaciones_${slugMunicipio}_${ejercicio}_${mesStr}.pdf`;

    return nombre;
  }

  private normalizarTextoParaArchivo(texto: string): string {
    return (
      texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'municipio'
    );
  }

  private resetEstadoCargaMasiva(): void {
    this.previsualizacionMasiva = [];
    this.erroresCargaMasiva = [];
    this.cargandoArchivoMasivo = false;
    this.totalFilasLeidas = 0;
    this.filasValidas = 0;
    this.filasConErrores = 0;
  }

  private esModuloPermitido(): boolean {
    const tipo = this.periodoSeleccionado?.tipo_pauta_codigo ?? null;
    if (!tipo) {
      return true;
    }

    let modulos = this.periodoSeleccionado?.modulos ?? null;
    if (!modulos || modulos.length === 0) {
      modulos = this.ejerciciosService.mapTipoPautaToModulos(tipo);
    }

    if (!modulos || modulos.length === 0) {
      return true;
    }

    return modulos.includes('recaudaciones');
  }

  private sincronizarPeriodoSeleccionado(
    ejercicio: number,
    mes: number,
    extra?: Partial<PeriodoSeleccionadoMunicipio>
  ): PeriodoSeleccionadoMunicipio {
    const previo = this.periodoSeleccionado ?? {};
    const combinado: PeriodoSeleccionadoMunicipio = {
      ...previo,
      ...extra,
      ejercicio,
      mes,
    };

    const tipo = combinado.tipo_pauta_codigo ?? null;
    if (tipo) {
      let modulos = combinado.modulos ?? null;
      if (!modulos || modulos.length === 0) {
        modulos = this.ejerciciosService.mapTipoPautaToModulos(tipo);
      }
      combinado.modulos = modulos && modulos.length ? modulos : null;
      combinado.tipo_pauta_label =
        combinado.tipo_pauta_label ?? this.ejerciciosService.obtenerEtiquetaTipoPauta(tipo);
    }

    const valorPreferido = extra?.valor ?? combinado.valor;
    combinado.valor =
      valorPreferido ??
      this.municipioService.buildPeriodoValor({
        ejercicio,
        mes,
        pauta_id: combinado.pauta_id ?? undefined,
        tipo_pauta_codigo: tipo ?? undefined,
      }) ??
      `${ejercicio}_${mes}`;

    this.periodoSeleccionado = combinado;
    return combinado;
  }
}
