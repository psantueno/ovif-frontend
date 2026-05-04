import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, take } from 'rxjs/operators';
import Swal from 'sweetalert2';

import {
  DeterminacionTributariaUpsertPayload,
  MunicipioService,
  PeriodoSeleccionadoMunicipio,
} from '../../services/municipio.service';
import { EjerciciosService } from '../../services/ejercicios.service';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { LoadingOverlayComponent } from '../../shared/components/loading-overlay/loading-overlay.component';
import {
  DeterminacionTributariaPreviewRow,
  parseDeterminacionTributariaExcelFile,
} from '../../core/utils/determinacionTributariaExcelParser.util';

type MensajeTipo = 'info' | 'error';

@Component({
  selector: 'app-determinacion-tributaria',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, BackButtonComponent, LoadingOverlayComponent],
  templateUrl: './determinacion-tributaria.component.html',
  styleUrls: ['../recaudaciones/recaudaciones.component.scss', './determinacion-tributaria.component.scss'],
})
export class DeterminacionTributariaComponent implements OnInit, OnDestroy {
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

  mesCerrado = false;
  mensaje: { tipo: MensajeTipo; texto: string } | null = null;
  mensajeTimeout: ReturnType<typeof setTimeout> | null = null;

  readonly manualDeterminacionUrl = '../assets/pdfs/carga-informacion/MANUAL-DETERMINACION.pdf';

  archivoMasivoSeleccionado: File | null = null;
  previsualizacionMasiva: DeterminacionTributariaPreviewRow[] = [];

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
        'Elegi un municipio desde la pantalla principal para continuar.',
        'warning'
      );
      this.router.navigate(['/panel-carga-mensual']);
      return;
    }

    this.municipioNombre = this.municipioActual.municipio_nombre ?? 'Municipio';

    this.route.queryParamMap.pipe(take(1)).subscribe((params) => {
      const ejercicioMes = params.get('ejercicioMes');

      if (!ejercicioMes) {
        this.mostrarAlerta(
          'Periodo no definido',
          'Selecciona un ejercicio y mes desde el menu principal.',
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
          'Datos invalidos',
          'Los datos recibidos no son validos. Proba nuevamente.',
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
          'El periodo seleccionado no permite cargar Determinacion Tributaria. Elegi otra opcion desde el inicio.',
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

  get puedeSubirMasiva(): boolean {
    if (this.cargandoArchivoMasivo || this.guardando) {
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

  get resumenTotales(): Array<{ label: string; value: number }> {
    const base = this.previsualizacionMasiva.filter((fila) => !fila.tieneError);
    const total = (selector: (fila: DeterminacionTributariaPreviewRow) => number | null) =>
      base.reduce((acumulado, fila) => acumulado + Number(selector(fila) ?? 0), 0);

    return [
      { label: 'Liquidadas', value: total((fila) => fila.liquidadas) },
      { label: 'Importe liquidadas', value: total((fila) => fila.importe_liquidadas) },
      { label: 'Impagas', value: total((fila) => fila.impagas) },
      { label: 'Importe impagas', value: total((fila) => fila.importe_impagas) },
      { label: 'Pagadas', value: total((fila) => fila.pagadas) },
      { label: 'Importe pagadas', value: total((fila) => fila.importe_pagadas) },
      { label: 'Altas del periodo', value: total((fila) => fila.altas_periodo) },
      { label: 'Bajas del periodo', value: total((fila) => fila.bajas_periodo) },
    ];
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
      this.erroresCargaMasiva.push('Selecciona un archivo en formato .xlsx o .xls.');
      return;
    }

    this.archivoMasivoSeleccionado = archivo;
    this.cargandoArchivoMasivo = true;

    try {
      const resultado = await parseDeterminacionTributariaExcelFile(archivo);

      this.previsualizacionMasiva = resultado.rows;
      this.totalFilasLeidas = resultado.totalRowsRead;
      this.filasValidas = resultado.validRows;
      this.filasConErrores = resultado.invalidRows;
      this.erroresCargaMasiva = [...resultado.globalErrors];

      if (resultado.totalRowsRead === 0 && this.erroresCargaMasiva.length === 0) {
        this.erroresCargaMasiva.push('El archivo no contiene datos para importar.');
      }
    } catch (error) {
      console.error('Error al procesar archivo de determinacion tributaria:', error);
      this.erroresCargaMasiva.push(
        'No se pudo procesar el archivo. Verifica que sea una planilla Excel valida.'
      );
    } finally {
      this.cargandoArchivoMasivo = false;
    }
  }

  insertarDeterminacionesMasivas(): void {
    const municipioId = this.municipioActual?.municipio_id ?? null;
    if (!municipioId) {
      this.mostrarError('No pudimos identificar el municipio seleccionado.');
      return;
    }

    if (this.erroresCargaMasiva.length > 0) {
      this.mostrarError('La planilla contiene errores de estructura. Corregila y volve a intentar.');
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
      this.mostrarError('No pudimos identificar el periodo seleccionado.');
      return;
    }

    const determinacionesPayload: DeterminacionTributariaUpsertPayload[] = this.previsualizacionMasiva
      .filter((fila) => !fila.tieneError)
      .map((fila) => ({
        cod_impuesto: fila.cod_impuesto as number,
        descripcion: fila.descripcion,
        anio: fila.anio as number,
        cuota: fila.cuota as number,
        liquidadas: fila.liquidadas as number,
        importe_liquidadas: fila.importe_liquidadas as number,
        impagas: fila.impagas as number,
        importe_impagas: fila.importe_impagas as number,
        pagadas: fila.pagadas as number,
        importe_pagadas: fila.importe_pagadas as number,
        altas_periodo: fila.altas_periodo as number,
        bajas_periodo: fila.bajas_periodo as number,
      }));

    if (!determinacionesPayload.length) {
      this.mostrarError('No hay filas validas para guardar.');
      return;
    }

    this.confirmarGuardado().then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.guardando = true;
      this.municipioService
        .guardarDeterminacionesTributarias({
          municipioId,
          ejercicio,
          mes,
          determinaciones: determinacionesPayload,
        })
        .pipe(
          take(1),
          finalize(() => {
            this.guardando = false;
          })
        )
        .subscribe({
          next: (response) => {
            if (response.resumen.errores?.length) {
              this.mostrarToastAviso(
                'La carga se completo con observaciones.',
                response.resumen.errores.join('\n')
              );
            } else {
              this.mostrarToastExito('Los datos fueron guardados correctamente.');
            }

            this.archivoMasivoSeleccionado = null;
            this.resetEstadoCargaMasiva();
          },
          error: (error) => {
            console.error('Error al guardar determinacion tributaria:', error);
            const { titulo, mensaje } = this.resolverMensajeErrorBackend(
              error,
              'No pudimos guardar los datos. Intenta nuevamente mas tarde.'
            );
            this.mostrarError(mensaje, titulo);
          },
        });
    });
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
      this.mostrarMensaje('info', 'Espera a que finalice el guardado de los datos.');
      return;
    }

    if (this.archivoMasivoSeleccionado && this.previsualizacionMasiva.length > 0) {
      this.mostrarError(
        'Subi los datos antes de generar el informe para visualizarlo actualizado.'
      );
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
      this.mostrarError('No pudimos identificar el municipio o periodo seleccionado.');
      return;
    }

    this.descargandoInforme = true;
    this.municipioService
      .descargarInformeDeterminacionTributaria({ municipioId, ejercicio, mes })
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
            this.mostrarError('No recibimos el archivo del informe. Intenta nuevamente mas tarde.');
            return;
          }

          const contentDisposition = response.headers?.get('Content-Disposition') ?? null;
          const filename =
            this.obtenerNombreArchivo(contentDisposition) ??
            this.construirNombreArchivoInforme(ejercicio, mes);

          this.descargarArchivo(blob, filename);
          this.mostrarToastExito('Informe descargado correctamente.');
        },
        error: (error) => {
          console.error('Error al generar el informe de determinacion tributaria:', error);
          const { titulo, mensaje } = this.resolverMensajeErrorBackend(
            error,
            'No pudimos generar el informe. Intenta nuevamente mas tarde.'
          );
          this.mostrarError(mensaje, titulo);
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

  private mostrarError(mensaje: string, titulo = 'Ocurrio un problema'): void {
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

  private resolverMensajeErrorBackend(
    error: any,
    fallback: string,
    tituloPorDefecto = 'Ocurrio un problema'
  ): { titulo: string; mensaje: string } {
    const payload = error?.error;

    if (payload && typeof payload === 'object') {
      if (typeof payload.error === 'string' && typeof payload.detalle === 'string') {
        return {
          titulo: tituloPorDefecto,
          mensaje: `${payload.error} ${payload.detalle}`,
        };
      }

      if (typeof payload.error === 'string') {
        return {
          titulo: tituloPorDefecto,
          mensaje: payload.error,
        };
      }
    }

    if (typeof payload === 'string') {
      return {
        titulo: tituloPorDefecto,
        mensaje: payload,
      };
    }

    return {
      titulo: tituloPorDefecto,
      mensaje: fallback,
    };
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
    return `informe_determinacion_tributaria_${slugMunicipio}_${ejercicio}_${mesStr}.pdf`;
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

    return modulos.includes('determinacion-tributaria');
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

  private confirmarGuardado() {
    return Swal.fire({
      title: '¿Confirma que desea guardar los datos?',
      text: 'Asegurate de que los datos ingresados sean correctos antes de confirmar.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'No, revisar',
    });
  }
}
