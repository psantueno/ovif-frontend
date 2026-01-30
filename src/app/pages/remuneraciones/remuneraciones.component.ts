import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { take, finalize } from 'rxjs/operators';
import { parseCSV } from '../../core/utils/csvReader.util';
import Swal from 'sweetalert2';

import {
  MunicipioService,
  PeriodoSeleccionadoMunicipio,
  Remuneracion,
  RemuneracionUpsertPayload,
} from '../../services/municipio.service';
import { EjerciciosService } from '../../services/ejercicios.service';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { LoadingOverlayComponent } from '../../shared/components/loading-overlay/loading-overlay.component';

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

  mesCerrado = false;
  mensaje: { tipo: MensajeTipo; texto: string } | null = null;
  mensajeTimeout: ReturnType<typeof setTimeout> | null = null;

  vistaActual: string = 'masiva';
  readonly plantillaRecaudacionesExcelUrl = 'assets/plantillas/plantilla_remuneraciones.xlsx';
  readonly plantillaRecaudacionesManualUrl = 'assets/plantillas/manual.pdf';
  archivoMasivoSeleccionado: File | null = null;
  previsualizacionMasiva: Remuneracion[] = [];
  regimenes: string[] = [];
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
      const periodoGuardado = this.municipioService.getPeriodoSeleccionado(this.municipioActual.municipio_id);
      const coincidePeriodoGuardado =
        periodoGuardado?.ejercicio === ejercicio && periodoGuardado?.mes === mes;
      const tipoPauta = parsedValor?.tipo_pauta ?? (coincidePeriodoGuardado ? periodoGuardado?.tipo_pauta ?? null : null);
      const pautaId = parsedValor?.pauta_id ?? (coincidePeriodoGuardado ? periodoGuardado?.pauta_id ?? null : null);
      const base: PeriodoSeleccionadoMunicipio = coincidePeriodoGuardado && periodoGuardado
        ? { ...periodoGuardado }
        : {
            ejercicio,
            mes
          };
      const valor =
        this.municipioService.buildPeriodoValor({
          ...base,
          ejercicio,
          mes,
          pauta_id: pautaId ?? undefined,
          tipo_pauta: tipoPauta ?? undefined
        }) ?? ejercicioMes;
      const modulos =
        (base.modulos && base.modulos.length ? base.modulos : null) ??
        (tipoPauta ? this.ejerciciosService.mapTipoPautaToModulos(tipoPauta) : null);
      const tipoPautaLabel =
        base.tipo_pauta_label ??
        (tipoPauta ? this.ejerciciosService.obtenerEtiquetaTipoPauta(tipoPauta) : null);

      this.periodoSeleccionado = this.sincronizarPeriodoSeleccionado(ejercicio, mes, {
        ...base,
        pauta_id: pautaId ?? null,
        tipo_pauta: tipoPauta ?? null,
        tipo_pauta_label: tipoPautaLabel ?? null,
        valor,
        modulos
      });

      this.persistirPeriodoSeleccionado(this.periodoSeleccionado);

      if (!this.esModuloPermitido()) {
        this.mostrarAlerta(
          'Pauta no habilitada',
          'El período seleccionado no permite cargar Recaudaciones. Elegí otra opción desde el inicio.',
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
      const { rows, errores } = await parseCSV(archivo, 'remuneraciones');

      if(rows.length === 0){
        this.erroresCargaMasiva.push('El archivo está vacío o no cumple con la plantilla requerida.');
        return;
      }

      this.previsualizacionMasiva = rows;

      this.regimenes = [...new Set(rows.map(row => row.regimen))];

      this.asignarErroresPrevisualizacion(errores);

      this.erroresPrevisualizacion = errores;

      console.log("Filas CSV: ", rows);
      console.log("Errores CSV: ", errores);
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

    const remuneracionesPayload: RemuneracionUpsertPayload[] = this.previsualizacionMasiva.map((fila) => {
      return this.armarPayload(fila);
    });

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
          this.mostrarError('No pudimos guardar los importes. Intentá nuevamente más tarde.');
        },
      });
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

  public obtenerErrorRemuneracion(cuil: number): string | null {
    const fila = this.previsualizacionMasiva.find(f => f.cuil === cuil);

    if (fila && fila.tieneError) return this.erroresPrevisualizacion.find(e => e.row === cuil)?.error;

    return null;
  }

  obtenerTotalImporte(clave: keyof Remuneracion): number {
    return this.previsualizacionMasiva.reduce((total, remuneracion) => {
      if(remuneracion.tieneError || remuneracion[clave] === null){
        return total;
      }

      const numberParsedValue: number = Number(remuneracion[clave]) ?? 0;

      return total + numberParsedValue;
    }, 0);
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
          this.mostrarError('No pudimos generar el informe. Intentá nuevamente más tarde.');
        },
      });
  }

  obtenerCantidadFilasPorRegimen(regimen: string): number {
    const remuneracionPorRegimen = this.previsualizacionMasiva.filter(rem => rem.regimen === regimen);

    return remuneracionPorRegimen.length;
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
    return `informe_remuneraciones_${slugMunicipio}_${ejercicio}_${mesStr}.pdf`;
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
    this.regimenes = [];
  }

  private asignarErroresPrevisualizacion(errores: { row: number; error: string }[]): void {
    errores.forEach(({ row, error }) => {
      const fila = this.previsualizacionMasiva.find(f => f.cuil === row);

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

  private persistirPeriodoSeleccionado(periodo: PeriodoSeleccionadoMunicipio | null): void {
    const municipioId = this.municipioActual?.municipio_id;
    if (!municipioId) {
      return;
    }

    if (!periodo) {
      this.municipioService.clearPeriodoSeleccionado(municipioId);
      return;
    }

    const valor =
      periodo.valor ??
      this.municipioService.buildPeriodoValor({
        ejercicio: periodo.ejercicio,
        mes: periodo.mes,
        pauta_id: periodo.pauta_id ?? undefined,
        tipo_pauta: periodo.tipo_pauta ?? undefined
      });
    let modulos = periodo.modulos ?? null;
    if ((!modulos || modulos.length === 0) && periodo.tipo_pauta) {
      modulos = this.ejerciciosService.mapTipoPautaToModulos(periodo.tipo_pauta);
    }
    const payload: PeriodoSeleccionadoMunicipio = {
      ...periodo,
      valor: valor ?? periodo.valor,
      modulos: modulos && modulos.length ? modulos : null
    };

    this.municipioService.setPeriodoSeleccionado(municipioId, payload);
  }

  private armarPayload(remuneracion: Remuneracion): RemuneracionUpsertPayload{
    const payload: RemuneracionUpsertPayload = {
      cuil: remuneracion.cuil,
      regimen: remuneracion.regimen,
      apellido_nombre: remuneracion.apellido_nombre,
      situacion_revista: remuneracion.situacion_revista,
      fecha_alta: remuneracion.fecha_alta,
      tipo_liquidacion: remuneracion.tipo_liquidacion,
      remuneracion_neta: remuneracion.remuneracion_neta,
    }

    if(remuneracion.bonificacion && remuneracion.bonificacion !== 0) payload.bonificacion = remuneracion.bonificacion;
    if(remuneracion.cant_hs_extra_50 && remuneracion.cant_hs_extra_50 !== 0) payload.cant_hs_extra_50 = remuneracion.cant_hs_extra_50;
    if(remuneracion.cant_hs_extra_100 && remuneracion.cant_hs_extra_100 !== 0) payload.cant_hs_extra_100 = remuneracion.cant_hs_extra_100;
    if(remuneracion.importe_hs_extra_50 && remuneracion.importe_hs_extra_50 !== 0) payload.importe_hs_extra_50 = remuneracion.importe_hs_extra_50;
    if(remuneracion.importe_hs_extra_100 && remuneracion.importe_hs_extra_100 !== 0) payload.importe_hs_extra_100 = remuneracion.importe_hs_extra_100;
    if(remuneracion.art && remuneracion.art !== 0) payload.art = remuneracion.art;
    if(remuneracion.seguro_vida && remuneracion.seguro_vida !== 0) payload.seguro_vida = remuneracion.seguro_vida;
    if(remuneracion.otros_conceptos && remuneracion.otros_conceptos !== 0) payload.otros_conceptos = remuneracion.otros_conceptos;

    return payload;
  }
}
