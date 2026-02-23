import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, take } from 'rxjs/operators';
import { parseCSV } from '../../core/utils/csvReader.util';
import Swal from 'sweetalert2';

import {
  MunicipioService,
  PeriodoSeleccionadoMunicipio,
  ConceptoRecaudacion,
  ConceptoRecaudacionUpsertPayload,
} from '../../services/municipio.service';
import { EjerciciosService } from '../../services/ejercicios.service';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { LoadingOverlayComponent } from '../../shared/components/loading-overlay/loading-overlay.component';

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

  vistaActual: 'manual' | 'masiva' = 'manual';
  readonly plantillaRecaudacionesExcelUrl = 'assets/plantillas/plantilla_recaudaciones.xlsx';
  readonly plantillaRecaudacionesManualUrl = 'assets/plantillas/manual.pdf';
  archivoMasivoSeleccionado: File | null = null;
  previsualizacionMasiva: ConceptoRecaudacion[] = [];
  erroresCargaMasiva: string[] = [];
  cargandoArchivoMasivo = false;

  cargandoConceptos = false;
  errorAlCargarConceptos = false;
  guardando = false;
  descargandoInforme = false;

  conceptosRecaudacion: ConceptoRecaudacion[] = [];

  private cambiosPendientes = false;

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

      if (
        !Number.isInteger(ejercicio) ||
        !Number.isInteger(mes) ||
        mes < 1 ||
        mes > 12
      ) {
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

      if (!this.esModuloPermitido()) {
        this.mostrarAlerta(
          'Pauta no habilitada',
          'El período seleccionado no permite cargar Recaudaciones. Elegí otra opción desde el inicio.',
          'info'
        );
        this.router.navigate(['/panel-carga-mensual']);
        return;
      }

      this.cargarConceptos();
    });
  }

  ngOnDestroy(): void {
    if (this.mensajeTimeout) {
      clearTimeout(this.mensajeTimeout);
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.tieneCambiosPendientes()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  tieneCambiosPendientes(): boolean {
    return this.cambiosPendientes;
  }

  private actualizarEstadoCambios(): void {
    this.cambiosPendientes = this.conceptosRecaudacion.some((concepto) => {
      const importeOriginal = Number(concepto.importeOriginal) != 0 ? Number(concepto.importeOriginal) : null;
      const importeActual = Number(concepto.importe_recaudacion) != 0 ? Number(concepto.importe_recaudacion) : null;
      if (importeOriginal === null && importeActual === null) {
        return false;
      }

      if(concepto.tieneError) {
        return true;
      }

      return importeOriginal !== importeActual;
    });
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

  get totalImportes(): number {
    return this.conceptosRecaudacion.reduce((total, concepto) => {
      if (concepto.tieneError || concepto.importe_recaudacion === null) {
        return total;
      }
      return total + (Number(concepto.importe_recaudacion) ?? 0);
    }, 0);
  }

  cambiarVista(vista: 'manual' | 'masiva'): void {
    if (this.vistaActual === vista) {
      return;
    }

    this.vistaActual = vista;
  }

  onArchivoSeleccionado(event: Event, input?: HTMLInputElement): void {
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

    this.archivoMasivoSeleccionado = archivo;

    if (!archivo.name.toLowerCase().endsWith('.csv')) {
      this.erroresCargaMasiva.push('Seleccioná un archivo en formato .csv.');
      return;
    }

    this.cargandoArchivoMasivo = true;

    const lector = new FileReader();
    lector.onload = () => {
      this.cargandoArchivoMasivo = false;
      this.obtenerFilasCSV(archivo);
    };

    lector.onerror = () => {
      this.cargandoArchivoMasivo = false;
      this.erroresCargaMasiva.push('Ocurrió un error al leer el archivo. Intentá nuevamente.');
    };

    lector.readAsText(archivo, 'utf-8');
  }

  erroresPrevisualizacion: any[] = [];

  async obtenerFilasCSV(archivo: File): Promise<any> {
    try {
      const { rows, errores } = await parseCSV(archivo, 'recaudaciones');
      const partidasPrevisualizacion: ConceptoRecaudacion[] = (() => {
        // 1. Mapa para acceso rápido por código
        const rowsMap = new Map<number, {cod_concepto: number; concepto: string; importe_recaudacion: number}>(
          rows.map(row => [row.cod_concepto, row])
        );

        // 2. Copia de partidasPlanas con modificación condicional
        return this.conceptosRecaudacion.map((concepto) => {
          const row = rowsMap.get(concepto.cod_concepto);

          const nuevoConcepto: ConceptoRecaudacion = {
            ...concepto,
            importe_recaudacion: row ? row.importe_recaudacion : null,
            importeOriginal: row ? row.importe_recaudacion : null,
            importeTexto: row ? String(row.importe_recaudacion) : '',
            tieneError: false
          };

          return nuevoConcepto;
        });
      })()
      const conceptosFiltrados: ConceptoRecaudacion[] = partidasPrevisualizacion.filter(concepto => {return concepto.importe_recaudacion !== null && concepto.importe_recaudacion !== undefined});
      if(conceptosFiltrados.length === 0){
        this.erroresCargaMasiva.push('El archivo está vacío o no cumple con la plantilla requerida.');
        return;
      }
      this.previsualizacionMasiva = conceptosFiltrados;
      this.asignarErroresPrevisualizacion(errores);
      this.erroresPrevisualizacion = errores;
    }
    catch (error) {
      this.erroresCargaMasiva.push('Ocurrió un error al procesar el archivo CSV.');
      console.error('Error al procesar CSV:', error);
      return;
    }
  }

  async insertarRecaudacionesMasivas(): Promise<void> {
    const municipioId = this.municipioActual?.municipio_id ?? null;
    if(!municipioId){
      this.mostrarError('No pudimos identificar el municipio seleccionado.');
      return;
    }
    if(this.erroresPrevisualizacion.length > 0){
      this.mostrarError('El archivo contiene errores. No se pueden insertar los datos.');
      return;
    }

    const periodo = this.periodoSeleccionado;

    const ejercicio = periodo?.ejercicio ?? this.ejercicioSeleccionado ?? null;
    if(!ejercicio){
      this.mostrarError('No pudimos identificar el ejercicio seleccionado.');
      return;
    }

    const mes = periodo?.mes ?? this.mesSeleccionado ?? null;
    if(!mes){
      this.mostrarError('No pudimos identificar el mes seleccionado.');
      return;
    }

    const conceptosPayload: ConceptoRecaudacionUpsertPayload[] = this.previsualizacionMasiva.map((fila) => ({
      cod_concepto: fila.cod_concepto,
      importe_recaudacion: Number(fila.importe_recaudacion) ?? null,
    }));

    if(this.esRectificacion){
      Swal.fire({
        title: '¿Confirma que desea guardar los importes de rectificación?',
        text: 'No se volverá a habilitar un período de rectificación para este ejercicio y mes. Asegurate de que los datos ingresados sean correctos antes de confirmar.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'No, revisar',
      }).then((result) => {
        if(result.isConfirmed) {
          this.guardando = true;
          this.municipioService
            .guardarConceptosRecaudacionRectificada({ municipioId, ejercicio, mes, conceptos: conceptosPayload })
            .pipe(
              take(1),
              finalize(() => {
                this.guardando = false;
              })
            )
            .subscribe({
              next: (response) => {
                if(response.resumen.errores?.length){
                  const erroresConcatenados = response.resumen.errores.join('\n');
                  this.mostrarToastAviso('Los importes se cargaron parcialmente. Revise estos errores:', erroresConcatenados);
                }else{
                  this.mostrarToastExito('Los importes fueron guardados correctamente.');
                }
                this.actualizarConceptos();
                this.cambiosPendientes = false;
              },
              error: (error) => {
                console.error('Error al guardar los conceptos de recaudación:', error);
                this.mostrarError('No pudimos guardar los importes. Intentá nuevamente más tarde.');
              },
            });
        }
      });
    } else{
      this.guardando = true;
      this.municipioService
        .guardarConceptosRecaudacion({ municipioId, ejercicio, mes, conceptos: conceptosPayload })
        .pipe(
          take(1),
          finalize(() => {
            this.guardando = false;
          })
        )
        .subscribe({
          next: (response) => {
            if(response.resumen.errores?.length){
              const erroresConcatenados = response.resumen.errores.join('\n');
              this.mostrarToastAviso('Los importes se cargaron parcialmente. Revise estos errores:', erroresConcatenados);
            }else{
              this.mostrarToastExito('Los importes fueron guardados correctamente.');
            }
            this.actualizarConceptos();
            this.cambiosPendientes = false;
          },
          error: (error) => {
            console.error('Error al guardar los conceptos de recaudación:', error);
            this.mostrarError('No pudimos guardar los importes. Intentá nuevamente más tarde.');
          },
        });
    }
  }

  limpiarArchivoMasiva(input?: HTMLInputElement): void {
    if (input) {
      input.value = '';
    }

    this.archivoMasivoSeleccionado = null;
    this.resetEstadoCargaMasiva();
  }

  get obtenerTotalFilasMasivas(): number {
    return this.previsualizacionMasiva.length;
  }

  public obtenerErrorConcepto(codigo: number): string | null {
    const fila = this.previsualizacionMasiva.find(f => f.cod_concepto === codigo);

    if (fila && fila.tieneError) return this.erroresPrevisualizacion.find(e => e.row === codigo)?.error;

    return null;
  }

  get obtenerTotalImportesMasivos(): number {
    return this.previsualizacionMasiva.reduce((total, concepto) => {
      if (concepto.tieneError || concepto.importe_recaudacion === null) {
        return total;
      }
      return total + (Number(concepto.importe_recaudacion) ?? 0);
    }, 0);
  }

  onSubmitGuardar(): void {
    if (this.mesCerrado) {
      return;
    }
    if (this.cargandoConceptos) {
      this.mostrarMensaje('info', 'Esperá a que finalice la carga de partidas.');
      return;
    }
    if (this.guardando) {
      this.mostrarMensaje('info', 'Esperá a que finalice el guardado de los importes.');
      return;
    }
    if (this.errorAlCargarConceptos) {
      this.mostrarError('No pudimos cargar las partidas. Reintentá más tarde.');
      return;
    }
    if (!this.conceptosRecaudacion.length) {
      this.mostrarMensaje('info', 'No hay partidas disponibles para guardar.');
      return;
    }
    if(!this.tieneCambiosPendientes()) {
      this.mostrarMensaje('info', 'No hay cambios para guardar.');
      return;
    }
    if (!this.validarImportes()) {
      this.mostrarError('Ingrese solo valores válidos');
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

    const payload: ConceptoRecaudacionUpsertPayload[] = this.conceptosRecaudacion.filter(concepto => concepto.importe_recaudacion !== null && concepto.importe_recaudacion !== 0).map((concepto) => ({
      cod_concepto: concepto.cod_concepto,
      importe_recaudacion: Number(concepto.importe_recaudacion) ?? null,
    }));

    if(payload.length === 0) {
      this.mostrarMensaje('info', 'No hay recaudaciones para guardar.');
      return;
    }

    if(this.esRectificacion){
      Swal.fire({
        title: '¿Confirma que desea guardar los importes de rectificación?',
        text: 'No se volverá a habilitar un período de rectificación para este ejercicio y mes. Asegurate de que los datos ingresados sean correctos antes de confirmar.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'No, revisar',
      }).then((result) => {
        if(result.isConfirmed) {
          this.guardando = true;
          this.municipioService
            .guardarConceptosRecaudacionRectificada({ municipioId, ejercicio, mes, conceptos: payload })
            .pipe(
              take(1),
              finalize(() => {
                this.guardando = false;
              })
            )
            .subscribe({
              next: (response) => {
                if(response.resumen.errores?.length){
                  const erroresConcatenados = response.resumen.errores.join('\n');
                  this.mostrarToastAviso('Los importes se cargaron parcialmente. Revise estos errores:', erroresConcatenados);
                }else{
                  this.mostrarToastExito('Los importes fueron guardados correctamente.');
                }
                this.actualizarConceptos();
                this.cambiosPendientes = false;
              },
              error: (error) => {
                console.error('Error al guardar los conceptos de recaudación:', error);
                this.mostrarError('No pudimos guardar los importes. Intentá nuevamente más tarde.');
              },
            });
        }
      });
    } else{
      this.guardando = true;
      this.municipioService
        .guardarConceptosRecaudacion({ municipioId, ejercicio, mes, conceptos: payload })
        .pipe(
          take(1),
          finalize(() => {
            this.guardando = false;
          })
        )
        .subscribe({
          next: (response) => {
            if(response.resumen.errores?.length){
              const erroresConcatenados = response.resumen.errores.join('\n');
              this.mostrarToastAviso('Los importes se cargaron parcialmente. Revise estos errores:', erroresConcatenados);
            }else{
              this.mostrarToastExito('Los importes fueron guardados correctamente.');
            }
            this.actualizarConceptos();
            this.cambiosPendientes = false;
          },
          error: (error) => {
            console.error('Error al guardar los conceptos de recaudación:', error);
            this.mostrarError('No pudimos guardar los importes. Intentá nuevamente más tarde.');
          },
        });
    }
  }

  generarInforme(): void {
    if (this.mesCerrado) {
      return;
    }
    if (this.cargandoConceptos) {
      this.mostrarMensaje('info', 'Esperá a que finalice la carga de partidas.');
      return;
    }
    if (this.guardando) {
      this.mostrarMensaje('info', 'Esperá a que finalice el guardado de los importes.');
      return;
    }
    if (this.errorAlCargarConceptos) {
      this.mostrarError('No pudimos cargar las partidas. Reintentá más tarde.');
      return;
    }
    if (!this.conceptosRecaudacion.length) {
      this.mostrarMensaje('info', 'No hay partidas disponibles para generar el informe.');
      return;
    }
    if (!this.validarImportes()) {
      this.mostrarError('Ingrese solo valores válidos');
      return;
    }
    if (this.tieneCambiosPendientes()) {
      this.mostrarError('Guardá los cambios antes de generar el informe para visualizarlo actualizado.');
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

    if(!this.esRectificacion){
      this.municipioService
        .descargarInformeRecaudaciones({ municipioId, ejercicio, mes })
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
            const filename = this.obtenerNombreArchivo(contentDisposition) ?? this.construirNombreArchivoInforme(ejercicio, mes);

            this.descargarArchivo(blob, filename);
            this.mostrarToastExito('Informe descargado correctamente.');
          },
          error: (error) => {
            console.error('Error al generar el informe de recaudaciones:', error);
            this.mostrarError('No pudimos generar el informe. Intentá nuevamente más tarde.');
          },
        });
    } else {
      this.municipioService
      .descargarInformeRecaudacionesRectificadas({ municipioId, ejercicio, mes })
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
          const filename = this.obtenerNombreArchivo(contentDisposition) ?? this.construirNombreArchivoInforme(ejercicio, mes);

          this.descargarArchivo(blob, filename);
          this.mostrarToastExito('Informe descargado correctamente.');
        },
        error: (error) => {
          console.error('Error al generar el informe de recaudaciones:', error);
          this.mostrarError('No pudimos generar el informe. Intentá nuevamente más tarde.');
        },
      });
    }
  }

  permitirSoloNumeros(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) {
      return;
    }

    const allowedKeys = ['Backspace', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
    if (allowedKeys.includes(event.key)) {
      return;
    }

    if (!/[0-9.,]/.test(event.key)) {
      event.preventDefault();
    }
  }

  sanearPegado(event: ClipboardEvent, codigoConcepto: number): void {
    const data = event.clipboardData?.getData('text') ?? '';
    if (!data) {
      return;
    }

    const sanitized = data.replace(/[^0-9.,]/g, '');
    if (sanitized === data) {
      return;
    }

    event.preventDefault();
    const input = event.target as HTMLInputElement;
    const value = input.value ?? '';
    const selectionStart = input.selectionStart ?? value.length;
    const selectionEnd = input.selectionEnd ?? value.length;
    const nuevoValor = value.slice(0, selectionStart) + sanitized + value.slice(selectionEnd);

    this.updateImporte(codigoConcepto, nuevoValor);
  }

  updateImporte(codigoConcepto: number, rawValue: string): void {
    const sanitized = rawValue.replace(',', '.').trim();

    const partida = this.conceptosRecaudacion.find(c => c.cod_concepto === codigoConcepto);

    if(!partida) {
      return;
    }

    if (sanitized === '') {
      partida.importeTexto = '';
      partida.importe_recaudacion = null;
      partida.tieneError = false;
      this.actualizarEstadoCambios();
      return;
    }

    const numericValue = Number(sanitized);

    if (Number.isFinite(numericValue)) {
      partida.importe_recaudacion = numericValue;
      partida.importeTexto = sanitized;
      partida.tieneError = false;
    } else {
      partida.importeTexto = rawValue;
      partida.tieneError = true;
    }

    this.actualizarEstadoCambios();
  }

  private cargarConceptos(): void {
    this.cargandoConceptos = true;
    this.errorAlCargarConceptos = false;

    const municipioId = this.municipioActual?.municipio_id ?? null;
    let periodo = this.periodoSeleccionado;

    if (!periodo && this.ejercicioSeleccionado && this.mesSeleccionado) {
      periodo = this.sincronizarPeriodoSeleccionado(this.ejercicioSeleccionado, this.mesSeleccionado);
    }

    const ejercicio = periodo?.ejercicio ?? null;
    const mes = periodo?.mes ?? null;

    if (!municipioId || !ejercicio || !mes) {
      this.cargandoConceptos = false;
      this.errorAlCargarConceptos = true;
      this.cambiosPendientes = false;
      this.conceptosRecaudacion = [];
      this.mostrarError('No pudimos obtener las partidas de recaudaciones. Verificá el municipio o período seleccionado.');
      return;
    }

      if(!this.esRectificacion){
        this.municipioService
        .obtenerConceptosRecaudacion({ municipioId, ejercicio, mes })
        .pipe(take(1))
        .subscribe({
          next: (response) => {
            if(response && Array.isArray(response)) {
              this.conceptosRecaudacion = response.map((concepto) => ({
                ...concepto,
                importe_recaudacion: Number(concepto.importe_recaudacion) != 0 ? Number(concepto.importe_recaudacion) : null,
                importeOriginal: Number(concepto.importe_recaudacion) != 0 ? Number(concepto.importe_recaudacion) : null,
                importeTexto: concepto.importe_recaudacion !== null && concepto.importe_recaudacion !== undefined
                  ? String(concepto.importe_recaudacion)
                  : '',
                tieneError: false,
              }));
            }else{
              this.conceptosRecaudacion = [];
            }
            this.cargandoConceptos = false;

            this.periodoSeleccionado = this.sincronizarPeriodoSeleccionado(ejercicio, mes);
          },
          error: () => {
            this.conceptosRecaudacion = [];
            this.cargandoConceptos = false;
            this.errorAlCargarConceptos = true;
            this.cambiosPendientes = false;
            this.mostrarError('No pudimos obtener las partidas de recaudaciones. Intentá nuevamente más tarde.');
          },
        });
      } else {
        this.municipioService
        .obtenerConceptosRecaudacionRectificada({ municipioId, ejercicio, mes })
        .pipe(take(1))
        .subscribe({
          next: (response) => {
            if(response && Array.isArray(response)) {
              this.conceptosRecaudacion = response.map((concepto) => ({
                ...concepto,
                importe_recaudacion: Number(concepto.importe_recaudacion) != 0 ? Number(concepto.importe_recaudacion) : null,
                importeOriginal: Number(concepto.importe_recaudacion) != 0 ? Number(concepto.importe_recaudacion) : null,
                importeTexto: concepto.importe_recaudacion !== null && concepto.importe_recaudacion !== undefined
                  ? String(concepto.importe_recaudacion)
                  : '',
                tieneError: false,
              }));
            }else{
              this.conceptosRecaudacion = [];
            }
            this.cargandoConceptos = false;

            this.periodoSeleccionado = this.sincronizarPeriodoSeleccionado(ejercicio, mes);
          },
          error: () => {
            this.conceptosRecaudacion = [];
            this.cargandoConceptos = false;
            this.errorAlCargarConceptos = true;
            this.cambiosPendientes = false;
            this.mostrarError('No pudimos obtener las partidas de recaudaciones. Intentá nuevamente más tarde.');
          },
        });
      }
  }

  simularEnvioMasivo(): void {
    console.log('Simulando envío masivo:', this.previsualizacionMasiva);
  }

  private validarImportes(): boolean {
    let valido = true;
    this.conceptosRecaudacion.forEach((concepto) => {
      if (concepto.tieneError) {
        valido = false;
      }
      if(concepto?.importe_recaudacion !== null && concepto?.importe_recaudacion !== undefined && concepto?.importe_recaudacion <= 0) {
        valido = false;
        concepto.tieneError = true;
      }
    });;
    return valido;
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

  private mostrarToastAviso(title:string, mensaje: string): Promise<void>{
    return Swal.fire({
      toast: true,
      icon: 'info',
      title: title,
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
      : `informe_recaudaciones_${slugMunicipio}_${ejercicio}_${mesStr}.pdf`

    return nombre;
  }

  private normalizarTextoParaArchivo(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'municipio';
  }

  private resetEstadoCargaMasiva(): void {
    this.previsualizacionMasiva = [];
    this.erroresCargaMasiva = [];
    this.cargandoArchivoMasivo = false;
  }

  private asignarErroresPrevisualizacion(errores: { row: number; error: string }[]): void {
    errores.forEach(({ row, error }) => {
      const fila = this.previsualizacionMasiva.find(f => f.cod_concepto === row);

      if (fila) fila.tieneError = true;
    });
  }

  private esModuloPermitido(): boolean {
    const tipo = this.periodoSeleccionado?.tipo_pauta ?? null;
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
      mes
    };

    const tipo = combinado.tipo_pauta ?? null;
    if (tipo) {
      let modulos = combinado.modulos ?? null;
      if (!modulos || modulos.length === 0) {
        modulos = this.ejerciciosService.mapTipoPautaToModulos(tipo);
      }
      combinado.modulos = modulos && modulos.length ? modulos : null;
      combinado.tipo_pauta_label =
        combinado.tipo_pauta_label ??
        this.ejerciciosService.obtenerEtiquetaTipoPauta(tipo);
    }

    const valorPreferido = extra?.valor ?? combinado.valor;
    combinado.valor =
      valorPreferido ??
      this.municipioService.buildPeriodoValor({
        ejercicio,
        mes,
        pauta_id: combinado.pauta_id ?? undefined,
        tipo_pauta: tipo ?? undefined
      }) ??
      `${ejercicio}_${mes}`;

    this.periodoSeleccionado = combinado;
    return combinado;
  }

  private actualizarConceptos() {
    this.conceptosRecaudacion.forEach((concepto) => {
      const filaActual = this.previsualizacionMasiva.find(fila => fila.cod_concepto === concepto.cod_concepto);
      if(filaActual){
        concepto.importe_recaudacion = Number(filaActual.importe_recaudacion) ?? null;
        concepto.importeOriginal = Number(filaActual.importe_recaudacion) ?? null;
        concepto.importeTexto = filaActual.importe_recaudacion !== null && filaActual.importe_recaudacion !== undefined
          ? String(filaActual.importe_recaudacion)
          : '';
        concepto.tieneError = false;
      }
    });
  }
}
