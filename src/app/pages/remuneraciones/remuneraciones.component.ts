import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { take, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import {
  MunicipioService,
  PeriodoSeleccionadoMunicipio,
  Remuneracion,
  RemuneracionUpsertPayload,
} from '../../services/municipio.service';
import { EjerciciosService } from '../../services/ejercicios.service';
import { onFileChangeWithMetadata, Remuneraciones } from '../../core/utils/excelReader.util';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { LoadingOverlayComponent } from '../../shared/components/loading-overlay/loading-overlay.component';
import { ParseError, parseRemuneracionesConMetadata } from '../../core/utils/cargaTypesParser';

type MensajeTipo = 'info' | 'error';

@Component({
  selector: 'app-remuneraciones',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, BackButtonComponent, LoadingOverlayComponent],
  templateUrl: './remuneraciones.component.html',
  styleUrls: ['./remuneraciones.component.scss'],
})
export class RemuneracionesComponent implements OnInit, OnDestroy {
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
  esRectificacion: boolean = false;

  mesCerrado = false;
  mensaje: { tipo: MensajeTipo; texto: string } | null = null;
  mensajeTimeout: ReturnType<typeof setTimeout> | null = null;

  vistaActual: string = 'masiva';
  readonly manualRemuneracionesUrl = '../assets/pdfs/carga-informacion/MANUAL-REMUNERACIONES.pdf';
  archivoMasivoSeleccionado: File | null = null;
  previsualizacionMasiva: Remuneraciones[] = [];
  regimenes: Set<string> = new Set;
  erroresCargaMasiva: string[] = [];
  erroresPrevisualizacion:ParseError<Remuneraciones>[] = [];
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
      this.sincronizarPeriodoSeleccionado(ejercicio, mes, parsedValor ?? undefined);

      if (!this.esModuloPermitido()) {
        this.mostrarAlerta(
          'Pauta no habilitada',
          'El período seleccionado no permite cargar Remuneraciones. Elegí otra opción desde el inicio.',
          'info'
        );
        this.router.navigate(['/panel-carga-mensual']);
        return;
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

  get totalFilasDetectadas(): number {
    return this.previsualizacionMasiva.length + this.erroresPrevisualizacion.length;
  }

  get filasCorrectas(): number {
    return this.previsualizacionMasiva.length;
  }

  get filasConErrores(): number {
    return this.erroresPrevisualizacion.length;
  }

  get tieneErroresPrevisualizacion(): boolean {
    return this.filasConErrores > 0;
  }

  get mostrarPrevisualizacionMasiva(): boolean {
    return this.totalFilasDetectadas > 0;
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

    try{
      const { rows, file } = await onFileChangeWithMetadata<Remuneraciones>(event);

      if (!file) {
        this.archivoMasivoSeleccionado = null;
        this.erroresCargaMasiva.push('No se detectó ningún archivo para procesar.');
        return;
      }

      const { rows: importesParseados, errors: errores } = parseRemuneracionesConMetadata(rows);

      if (importesParseados.length === 0 && errores.length === 0) {
        this.erroresCargaMasiva.push('El archivo está vacío o no cumple con la plantilla requerida.');
        return;
      }

      this.obtenerRegimenes(importesParseados);
      this.previsualizacionMasiva = importesParseados;
      this.erroresPrevisualizacion = errores;
    } catch (error) {
      this.erroresCargaMasiva.push('Ocurrió un error al procesar el archivo Excel.');
      console.error('Error al procesar Excel:', error);
    } finally {
      this.cargandoArchivoMasivo = false;
    }
  }

  async insertarRemuneracionesMasivas(): Promise<void> {
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

    const remuneracionesPayload: RemuneracionUpsertPayload[] = this.previsualizacionMasiva.map((fila) => {
      return this.armarPayload(fila);
    });

    if(this.esRectificacion){
      this.confirmarGuardadoRectificacion().then((result) => {
        if(result.isConfirmed) {
          this.guardando = true;
          this.municipioService
          .guardarRemuneracionesRectificadas({ municipioId, ejercicio, mes, remuneraciones: remuneracionesPayload })
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
            },
            error: (error) => {
              console.error('Error al guardar las remuneraciones:', error);
              const { titulo, mensaje } = this.resolverMensajeErrorBackend(
                error,
                'No pudimos guardar los importes. Intentá nuevamente más tarde.'
              );
              this.mostrarError(mensaje, titulo);
            },
          });
        }
      });
    } else{
      this.guardando = true;
      this.municipioService
        .guardarRemuneraciones({ municipioId, ejercicio, mes, remuneraciones: remuneracionesPayload })
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
          },
          error: (error) => {
            console.error('Error al guardar las remuneraciones:', error);
            const { titulo, mensaje } = this.resolverMensajeErrorBackend(
              error,
              'No pudimos guardar los importes. Intentá nuevamente más tarde.'
            );
            this.mostrarError(mensaje, titulo);
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
    return this.totalFilasDetectadas;
  }

  generarInforme(): void {
    if (this.mesCerrado) {
      return;
    }
    if (this.guardando) {
      this.mostrarMensaje('info', 'Esperá a que finalice el guardado de los importes.');
      return;
    }
    if (this.erroresCargaMasiva.length) {
      this.mostrarError('Ingrese solo valores válidos');
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
        .descargarInformeRemuneraciones({ municipioId, ejercicio, mes })
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
            const { titulo, mensaje } = this.resolverMensajeErrorBackend(
              error,
              'No pudimos generar el informe. Intentá nuevamente más tarde.'
            );
            this.mostrarError(mensaje, titulo);
          },
        });
      } else {
        this.municipioService
          .descargarInformeRemuneracionesRectificadas({ municipioId, ejercicio, mes })
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
              const { titulo, mensaje } = this.resolverMensajeErrorBackend(
                error,
                'No pudimos generar el informe. Intentá nuevamente más tarde.'
              );
              this.mostrarError(mensaje, titulo);
            },
          });
      }
  }

  obtenerCantidadFilasPorRegimen(regimen: string): number {
    const remuneracionPorRegimen = this.previsualizacionMasiva.filter(rem => rem.regimen_laboral === regimen);

    return remuneracionPorRegimen.length;
  }

  private obtenerRegimenes(remuneraciones: Remuneraciones[]): void {
    remuneraciones.forEach((rem) => {
      this.regimenes.add(rem.regimen_laboral)
    })
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

  private resolverMensajeErrorBackend(
    error: any,
    fallback: string,
    tituloPorDefecto = 'Ocurrió un problema'
  ): { titulo: string; mensaje: string } {
    const payload = error?.error;

    if (payload && typeof payload === 'object') {
      if (payload.error === 'El período indicado no está habilitado para rectificación.') {
        const partes = [payload.detalle ?? payload.error];

        if (payload.fecha_limite_original) {
          partes.push(`Plazo original de carga: ${this.formatearFechaCorta(payload.fecha_limite_original)}.`);
        }

        if (payload.puede_solicitar_prorroga) {
          partes.push(
            payload.sugerencia ??
            'Si necesitás cargar fuera de término, podés solicitar una prórroga.'
          );
        }

        return {
          titulo: 'Rectificación no disponible',
          mensaje: partes.join(' '),
        };
      }

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

  private formatearFechaCorta(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const [year, month, day] = String(value).split('-');
    if (!year || !month || !day) {
      return String(value);
    }

    return `${day}/${month}/${year}`;
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
      ? `informe_rectificacion_remuneraciones_${slugMunicipio}_${ejercicio}_${mesStr}.pdf`
      : `informe_remuneraciones_${slugMunicipio}_${ejercicio}_${mesStr}.pdf`
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
    this.erroresPrevisualizacion = [];
    this.cargandoArchivoMasivo = false;
    this.regimenes.clear()
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

    return modulos.includes('remuneraciones');
  }

  private confirmarGuardadoRectificacion() {
    return Swal.fire({
      title: '¿Confirma que desea guardar los importes de rectificación?',
      text: 'Asegurate de que los datos ingresados sean correctos antes de confirmar.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      cancelButtonText: 'No, revisar',
    });
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

  private armarPayload(remuneracion: Remuneraciones): RemuneracionUpsertPayload{
    const payload: RemuneracionUpsertPayload = {
      cuil: remuneracion.cuil,
      legajo: remuneracion.legajo,
      apellido_nombre: remuneracion.apellido_nombre,
      regimen_laboral: remuneracion.regimen_laboral,
      categoria: remuneracion.categoria,
      sector: remuneracion.sector,
      fecha_ingreso: remuneracion.fecha_ingreso,
      fecha_inicio_servicio: remuneracion.fecha_inicio_servicio,
      basico_cargo_salarial: remuneracion.basico_cargo_salarial,
      total_remunerativo: remuneracion.total_remunerativo,
      total_descuentos: remuneracion.total_bonos,
      total_issn: remuneracion.total_issn,
      seguro_vida_obligatorio: remuneracion.seguro_vida_obligatorio,
      neto_a_cobrar: remuneracion.neto_a_cobrar
    }

    if(remuneracion.fecha_fin_servicio) payload.fecha_fin_servicio = remuneracion.fecha_fin_servicio;
    if(remuneracion.sac && remuneracion.sac !== 0) payload.sac = remuneracion.sac;
    if(remuneracion.cant_hs_extras_50 && remuneracion.cant_hs_extras_50 !== 0) payload.cant_hs_extras_50 = remuneracion.cant_hs_extras_50;
    if(remuneracion.cant_hs_extras_100 && remuneracion.cant_hs_extras_100 !== 0) payload.cant_hs_extras_100 = remuneracion.cant_hs_extras_100;
    if(remuneracion.importe_horas_extras_50 && remuneracion.importe_horas_extras_50 !== 0) payload.importe_hs_extras_50 = remuneracion.importe_horas_extras_50;
    if(remuneracion.importe_horas_extras_100 && remuneracion.importe_horas_extras_100 !== 0) payload.importe_hs_extras_100 = remuneracion.importe_horas_extras_100;
    if(remuneracion.total_no_remunerativo && remuneracion.total_no_remunerativo !== 0) payload.total_no_remunerativo = Number(remuneracion.total_no_remunerativo);
    if(remuneracion.total_bonos && remuneracion.total_bonos !== 0) payload.total_bonos = Number(remuneracion.total_bonos);
    if(remuneracion.total_ropa && remuneracion.total_ropa !== 0) payload.total_ropa = Number(remuneracion.total_ropa);
    if(remuneracion.asignaciones_familiares && remuneracion.asignaciones_familiares !== 0) payload.asignaciones_familiares = remuneracion.asignaciones_familiares;
    if(remuneracion.art && remuneracion.art !== 0) payload.art = remuneracion.art;

    return payload;
  }
}
