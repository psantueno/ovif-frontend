import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, take } from 'rxjs/operators';
import Swal from 'sweetalert2';

import {
  MunicipioService,
  PartidaRecursoResponse,
  PartidaRecursoUpsertPayload,
  PeriodoSeleccionadoMunicipio
} from '../../services/municipio.service';
import { EjerciciosService } from '../../services/ejercicios.service';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';
import { onFileChange, Recursos, RecursosParseados } from '../../core/utils/excelReader.util';
import { parseRecursos, ParseError } from '../../core/utils/cargaTypesParser';
import { LoadingOverlayComponent } from '../../shared/components/loading-overlay/loading-overlay.component';

type MensajeTipo = 'info' | 'error';
type CampoEditable = 'importe' | 'contribuyentes' | 'pagaron';

interface PartidaNode {
  codigo: number;
  descripcion: string;
  carga: boolean;
  soloImporte: boolean;
  importePercibido: number | null;
  importePercibidoOriginal: number | null;
  importePercibidoTexto: string;
  importePercibidoOriginalTexto: string;
  errorImporte: boolean;
  hijos?: PartidaNode[];
}

interface PartidaDisplay {
  node: PartidaNode;
  nivel: number;
}

@Component({
  selector: 'app-recursos',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, BackButtonComponent, LoadingOverlayComponent],
  templateUrl: './recursos.component.html',
  styleUrls: ['./recursos.component.scss'],
})
export class RecursosComponent implements OnInit, OnDestroy {
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

  vistaActual: 'manual' | 'masiva' = 'manual';
  readonly plantillaRecursosManualUrl = 'assets/plantillas/manual.pdf';
  archivoMasivoSeleccionado: File | null = null;
  previsualizacionMasiva: PartidaDisplay[] = [];
  erroresCargaMasiva: string[] = [];
  erroresPrevisualizacion: ParseError<Recursos>[] = [];
  erroresCodigosPartidas: ParseError<RecursosParseados>[] = [];
  cargandoArchivoMasivo = false;

  filasLeidas: number = 0;
  filasCorrectas: number = 0;
  filasConErrores: number = 0;

  cargandoPartidas = false;
  errorAlCargarPartidas = false;
  guardando = false;
  descargandoInforme = false;

  partidas: PartidaNode[] = [];
  partidasPlanas: PartidaDisplay[] = [];
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

      if (!this.esModuloPermitido()) {
        this.mostrarAlerta(
          'Pauta no habilitada',
          'El período seleccionado no permite cargar Recursos. Elegí otra opción desde el inicio.',
          'info'
        );
        this.router.navigate(['/panel-carga-mensual']);
        return;
      }

      this.cargarPartidas();
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
    this.cambiosPendientes = this.partidasPlanas.some(({ node }) => {
      if (!node.carga) {
        return false;
      }
      if (node.errorImporte) {
        return true;
      }
      if (node.importePercibidoOriginal !== node.importePercibido) {
        return true;
      }
      if (node.soloImporte) {
        return false;
      }
      return false
    });
  }

  private actualizarBaseCambios(): void {
    this.partidasPlanas.forEach(({ node }) => {
      node.importePercibidoOriginal = node.importePercibido;
      node.importePercibidoOriginalTexto = node.importePercibidoTexto;
    });
    this.cambiosPendientes = false;
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
    return this.partidasPlanas.reduce((total, partida) => {
      if (!partida.node.carga) {
        return total;
      }
      if (partida.node.errorImporte || partida.node.importePercibido === null) {
        return total;
      }
      return total + Number(partida.node.importePercibido);
    }, 0);
  }

  cambiarVista(vista: 'manual' | 'masiva'): void {
    if (this.vistaActual === vista) {
      return;
    }

    this.vistaActual = vista;
  }

  async onArchivoSeleccionado(event: Event, input?: HTMLInputElement): Promise<void> {
      try{
        const { rows, file } = await onFileChange<Recursos>(event)
        this.filasLeidas = rows.length;

        this.resetEstadoCargaMasiva();
        this.archivoMasivoSeleccionado = null;

        if (!file) {
          if (input) {
            input.value = '';
          }
          return;
        }

        this.archivoMasivoSeleccionado = file
        const { rows: importesParseados, errors: errores } = parseRecursos(rows)
        const importesValidos: RecursosParseados[] = this.filtrarCodigosInvalidos(importesParseados)
        const importesPrevisualizacion: PartidaDisplay[] = this.armarPrevisualizacionMasiva(importesValidos, errores)
        const importesFiltrado: PartidaDisplay[] = this.filtrarImportesPlanos(importesPrevisualizacion)

        if(importesFiltrado.length === 0){
          this.erroresCargaMasiva.push('El archivo está vacío o no cumple con la plantilla requerida.');
          return;
        }

        this.previsualizacionMasiva = importesFiltrado;
        this.erroresPrevisualizacion = errores;

        this.armarResumen();
      }catch (error) {
        this.erroresCargaMasiva.push('Ocurrió un error al procesar el archivo CSV.');
        console.error('Error al procesar CSV:', error);
      }
    }

    async insertarRecursosMasivos(): Promise<void> {
      const municipioId = this.municipioActual?.municipio_id ?? null;
      if(!municipioId){
        this.mostrarError('No pudimos identificar el municipio seleccionado.');
        return;
      }
      if(this.erroresCargaMasiva.length > 0){
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

      const loadablePartidas = this.previsualizacionMasiva.filter(fila => fila.node.carga && fila.node.importePercibido !== null && !isNaN(fila.node.importePercibido));

      const recursosPayload: PartidaRecursoUpsertPayload[] = loadablePartidas.map((fila) => ({
        partidas_recursos_codigo: fila.node.codigo,
        recursos_importe_percibido: Number(fila.node.importePercibido),
      }));

      console.log("Recursos payload ", recursosPayload)

      this.guardando = true;

      this.municipioService
        .guardarPartidasRecursos({ municipioId, ejercicio, mes, partidas: recursosPayload })
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
              this.actualizarImportePartidas();
            }
          },
          error: (error) => {
            console.error('Error al guardar las partidas de gastos:', error);
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

  onSubmitGuardar(): void {
    if (this.mesCerrado) {
      return;
    }
    if (this.cargandoPartidas) {
      this.mostrarMensaje('info', 'Esperá a que finalice la carga de partidas.');
      return;
    }
    if (this.guardando) {
      this.mostrarMensaje('info', 'Esperá a que finalice el guardado de los importes.');
      return;
    }
    if (this.errorAlCargarPartidas) {
      this.mostrarError('No pudimos cargar las partidas. Reintentá más tarde.');
      return;
    }
    if (!this.partidasPlanas.length) {
      this.mostrarMensaje('info', 'No hay partidas disponibles para guardar.');
      return;
    }
    if (!this.validarPartidas()) {
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

    const partidasPayload: PartidaRecursoUpsertPayload[] = this.partidasPlanas
      .map((partida) => partida.node)
      .filter((node) => node.carga && Number(node.importePercibido) !== null && Number(node.importePercibido) !== 0)
      .map((node) => ({
        partidas_recursos_codigo: node.codigo,
        recursos_importe_percibido: Number(node.importePercibido),
      }));

    if (!partidasPayload.length) {
      this.mostrarMensaje('info', 'No hay partidas editables para guardar en este período.');
      return;
    }

    this.guardando = true;

    this.municipioService
      .guardarPartidasRecursos({ municipioId, ejercicio, mes, partidas: partidasPayload })
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
              this.actualizarBaseCambios();
            }
          },
        error: (error) => {
          console.error('Error al guardar las partidas de recursos:', error);
          const { titulo, mensaje } = this.resolverMensajeErrorBackend(
            error,
            'No pudimos guardar los datos. Intentá nuevamente más tarde.',
            'Carga no disponible'
          );
          this.mostrarError(mensaje, titulo);
        },
      });
  }

  generarInforme(): void {
    if (this.mesCerrado) {
      return;
    }
    if (this.cargandoPartidas) {
      this.mostrarMensaje('info', 'Esperá a que finalice la carga de partidas.');
      return;
    }
    if (this.guardando) {
      this.mostrarMensaje('info', 'Esperá a que finalice el guardado de los importes.');
      return;
    }
    if (this.errorAlCargarPartidas) {
      this.mostrarError('No pudimos cargar las partidas. Reintentá más tarde.');
      return;
    }
    if (!this.partidasPlanas.length) {
      this.mostrarMensaje('info', 'No hay partidas disponibles para generar el informe.');
      return;
    }
    if (!this.validarPartidas()) {
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

    this.municipioService
      .descargarInformeRecursos({ municipioId, ejercicio, mes })
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
          console.error('Error al generar el informe de recursos:', error);
          const { titulo, mensaje } = this.resolverMensajeErrorBackend(
            error,
            'No pudimos generar el informe. Intentá nuevamente más tarde.',
            'Informe no disponible'
          );
          this.mostrarError(mensaje, titulo);
        },
      });
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

  sanearPegado(event: ClipboardEvent, partida: PartidaNode, campo: CampoEditable): void {
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
    this.updateCampo(partida, nuevoValor);
  }

  updateCampo(partida: PartidaNode, rawValue: string): void {
    const sanitized = rawValue.replace(',', '.').trim();
    if (sanitized === '') {
      partida.importePercibido = null;
      partida.importePercibidoTexto = '';
      partida.errorImporte = false;
      this.actualizarEstadoCambios();
      return;
    }

    const numericValue = Number(sanitized);

    if (Number.isFinite(numericValue)) {
      partida.importePercibido = numericValue;
      partida.importePercibidoTexto = sanitized;
      partida.errorImporte = false;
    } else {
      partida.importePercibidoTexto = rawValue;
      partida.errorImporte = true;
    }

    this.actualizarEstadoCambios();
  }

  private cargarPartidas(): void {
    this.cargandoPartidas = true;
    this.errorAlCargarPartidas = false;

    const municipioId = this.municipioActual?.municipio_id ?? null;
    let periodo = this.periodoSeleccionado;

    if (!periodo && this.ejercicioSeleccionado && this.mesSeleccionado) {
      periodo = this.sincronizarPeriodoSeleccionado(this.ejercicioSeleccionado, this.mesSeleccionado);
    }

    const ejercicio = periodo?.ejercicio ?? null;
    const mes = periodo?.mes ?? null;

    if (!municipioId || !ejercicio || !mes) {
      this.partidas = [];
      this.partidasPlanas = [];
      this.cargandoPartidas = false;
      this.errorAlCargarPartidas = true;
      this.cambiosPendientes = false;
      this.mostrarError('No pudimos obtener las partidas de recursos. Verificá el municipio o período seleccionado.');
      return;
    }

    this.municipioService
      .obtenerPartidasRecursos({ municipioId, ejercicio, mes })
      .pipe(take(1))
      .subscribe({
        next: (response) => {
          this.partidas = (response ?? []).map((partida) => this.transformarPartida(partida));
          this.partidasPlanas = this.flattenPartidas(this.partidas);
          this.actualizarBaseCambios();
          this.cargandoPartidas = false;

          this.periodoSeleccionado = this.sincronizarPeriodoSeleccionado(ejercicio, mes);
        },
        error: () => {
          this.partidas = [];
          this.partidasPlanas = [];
          this.cargandoPartidas = false;
          this.errorAlCargarPartidas = true;
          this.cambiosPendientes = false;
          this.mostrarError('No pudimos obtener las partidas de recursos. Intentá nuevamente más tarde.');
        },
      });
  }

  private transformarPartida(partida: PartidaRecursoResponse): PartidaNode {
    const importePercibido = this.parseNumero(partida.recursos_importe_percibido);

    const hijos = Array.isArray(partida.children)
      ? partida.children.map((child) => this.transformarPartida(child))
      : [];

    const node: PartidaNode = {
      codigo: Number(partida.partidas_recursos_codigo),
      descripcion: partida.partidas_recursos_descripcion ?? 'Partida sin nombre',
      carga: Boolean(partida.partidas_recursos_carga ?? partida.puede_cargar),
      soloImporte: Boolean(partida.partidas_recursos_sl),
      importePercibido,
      importePercibidoOriginal: importePercibido,
      importePercibidoTexto: importePercibido !== null ? String(importePercibido.toFixed(2)) : '',
      importePercibidoOriginalTexto: importePercibido !== null ? String(importePercibido.toFixed(2)) : '',
      errorImporte: false,
    };

    if (hijos.length) {
      node.hijos = hijos;
    }

    return node;
  }

  private parseNumero(valor: unknown): number | null {
    if (valor === null || valor === undefined || valor === '') {
      return null;
    }
    if (typeof valor === 'number') {
      return Number.isFinite(valor) ? valor : null;
    }

    const normalizado = String(valor).replace(',', '.');
    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : null;
  }

  private resetEstadoCargaMasiva(): void {
    this.previsualizacionMasiva = [];
    this.erroresCargaMasiva = [];
    this.erroresPrevisualizacion = [];
    this.erroresCodigosPartidas = [];
    this.cargandoArchivoMasivo = false;
  }

  private validarPartidas(): boolean {
    let valido = true;

    this.partidasPlanas.forEach(({ node }) => {
      if (!node.carga) {
        return;
      }

      if (node.errorImporte) {
        valido = false;
        return;
      }

      if(node.importePercibido !== null && node.importePercibidoOriginal !== null && node.importePercibido !== node.importePercibidoOriginal && node.importePercibido <=0) {
        node.errorImporte = true;
        valido = false;
        return;
      }
    });

    if (!valido) {
      this.actualizarEstadoCambios();
    }

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

  private resolverMensajeErrorBackend(
    error: any,
    fallback: string,
    tituloPorDefecto = 'Ocurrió un problema'
  ): { titulo: string; mensaje: string } {
    const payload = error?.error;

    if (payload && typeof payload === 'object') {
      if (payload.error === 'El período indicado ya no está habilitado para carga.') {
        const partes = [payload.detalle ?? payload.error];

        if (payload.fecha_limite_original) {
          partes.push(`Plazo original de carga: ${this.formatearFechaCorta(payload.fecha_limite_original)}.`);
        }

        if (payload.fecha_limite_prorroga) {
          partes.push(`Prórroga vigente hasta: ${this.formatearFechaCorta(payload.fecha_limite_prorroga)}.`);
        }

        if (payload.puede_solicitar_prorroga) {
          partes.push(
            payload.sugerencia ??
            'Si necesitás cargar fuera de término, podés solicitar una prórroga.'
          );
        }

        return {
          titulo: 'Carga no disponible',
          mensaje: partes.join(' '),
        };
      }

      if (payload.error === 'El período indicado aún no está habilitado para carga.') {
        const partes = [payload.detalle ?? payload.error];

        if (payload.fecha_inicio) {
          partes.push(`Fecha de inicio de carga: ${this.formatearFechaCorta(payload.fecha_inicio)}.`);
        }

        return {
          titulo: 'Carga todavía no habilitada',
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
    return `informe_recursos_${slugMunicipio}_${ejercicio}_${mesStr}.pdf`;
  }

  private normalizarTextoParaArchivo(texto: string): string {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'municipio';
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

    return modulos.includes('recursos');
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

    const tipo = combinado.tipo_pauta_codigo ?? null;
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
        tipo_pauta_codigo: tipo ?? undefined
      }) ??
      `${ejercicio}_${mes}`;

    this.periodoSeleccionado = combinado;
    return combinado;
  }

  private flattenPartidas(
    partidas: PartidaNode[],
    nivel = 0,
    acumulado: PartidaDisplay[] = []
  ): PartidaDisplay[] {
    partidas.forEach((partida) => {
      acumulado.push({ node: partida, nivel });
      if (partida.hijos?.length) {
        this.flattenPartidas(partida.hijos, nivel + 1, acumulado);
      }
    });
    return acumulado;
  }

  private filtrarImportesPlanos(
    partidas: PartidaDisplay[]
  ): PartidaDisplay[] {
    const codigosAConservar = new Set<number>();

    for (let i = 0; i < partidas.length; i++) {
      const actual = partidas[i];

      if (actual.node.importePercibido !== null && actual.node.carga) {
        // Conservar el nodo actual
        codigosAConservar.add(actual.node.codigo);

        // Subir hacia los padres
        let nivelActual = actual.nivel;

        for (let j = i - 1; j >= 0; j--) {
          const posiblePadre = partidas[j];

          if (posiblePadre.nivel < nivelActual) {
            codigosAConservar.add(posiblePadre.node.codigo);
            nivelActual = posiblePadre.nivel;
          }

          if (nivelActual === 0) break;
        }
      }
    }
    // Filtrado final
    return partidas.filter(p =>
      codigosAConservar.has(p.node.codigo)
    );
  }

  private actualizarImportePartidas(): void {
    this.previsualizacionMasiva.forEach(({ node }) => {
      if (!node.carga) {
        return;
      }
      const partidaOriginal = this.partidasPlanas.find(p => p.node.codigo === node.codigo);
      if (partidaOriginal) {
        partidaOriginal.node.importePercibido = Number(node.importePercibido) || null;
        partidaOriginal.node.importePercibidoTexto = node.importePercibido !== null ? String(node.importePercibido) : '';
        partidaOriginal.node.errorImporte = node.errorImporte;
      }
    })
  }

  get obtenerTotalImportesMasivos(): number {
    const total = this.previsualizacionMasiva.reduce((total, partida) => {
      if (!partida.node.carga) return total;
      if (partida.node.errorImporte || partida.node.importePercibido === null) return total;

      return total + Number(partida.node.importePercibido);
    }, 0);

    return Number(total.toFixed(2));
  }

  public formatearImporte(valor: number | null | undefined): string {
    if (valor === null || valor === undefined) {
      return '-';
    }

    const numero = Number(valor);
    if (!Number.isFinite(numero)) {
      return '-';
    }

    return numero.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  public obtenerErrorPartida(codigo: number): string | undefined | null {
    const fila = this.previsualizacionMasiva.find(f => f.node.codigo === codigo);

    if (fila && fila.node.errorImporte) return this.erroresPrevisualizacion.find(e => e.row.codigo_partida === String(codigo))?.error;

    return null;
  }

    private filtrarCodigosInvalidos (rows: RecursosParseados[]): RecursosParseados[] {
      const filasInvalidas = rows.filter(r => !this.partidasPlanas.some(pp => pp.node.codigo === r.codigo_partida))

      filasInvalidas.forEach((fi) => {
        this.erroresCodigosPartidas.push({
          row: fi,
          error: 'No existe el código de partida indicado, por lo que no puede ser procesado.'
        })
      })

      const filasFiltradas = rows.filter(r => this.partidasPlanas.some(pp => pp.node.codigo === r.codigo_partida))

      const noAdmiteCarga = filasFiltradas.filter(r => this.partidasPlanas.some(pp => pp.node.codigo === r.codigo_partida && !pp.node.carga))
      noAdmiteCarga.forEach((fi) => {
        this.erroresCodigosPartidas.push({
          row: fi,
          error: 'La partida indicada no admite carga de importes.'
        })
      })

      const filasValidas = filasFiltradas.filter(r => this.partidasPlanas.some(pp => pp.node.codigo === r.codigo_partida && pp.node.carga))

      return filasValidas
    }

  private armarPrevisualizacionMasiva(rows: RecursosParseados[], errors: ParseError<Recursos>[]): PartidaDisplay[] {
        // 1. Mapa para acceso rápido por código
        const rowsMap = new Map<number, RecursosParseados>(
          rows.map(row => [row.codigo_partida, row])
        );

        const errorsMap = new Map<string, ParseError<Recursos>>(
          errors.map(error => [
            error.row.codigo_partida,
            error
          ])
        );

        // 2. Copia de partidasPlanas con modificación condicional
        return this.partidasPlanas.map(({ node, nivel }) => {
          const row = rowsMap.get(node.codigo);
          const rowError = errorsMap.get(String(node.codigo))

          if(row){
            const importeCadena = String(row.importe)

            const nuevoNode: PartidaNode = {
              ...node,
              importePercibido: row.importe,
              importePercibidoOriginal:  row.importe,
              importePercibidoTexto: importeCadena ?? '',
              importePercibidoOriginalTexto: importeCadena ?? '',
              errorImporte: false
            };

            return {
              nivel,
              node: nuevoNode
            };
          }else if(rowError){
            const nuevoNode: PartidaNode = {
              ...node,
              importePercibido: 0,
              importePercibidoOriginal:  0,
              importePercibidoTexto: rowError.row.importe,
              importePercibidoOriginalTexto: rowError.row.importe,
              errorImporte: true
            };

            return {
              nivel,
              node: nuevoNode
            }
          } else{
            const nuevoNode: PartidaNode = {
              ...node,
              importePercibido: null,
              importePercibidoOriginal:  null,
              importePercibidoTexto: '',
              importePercibidoOriginalTexto: '',
              errorImporte: false
            };

            return {
              nivel,
              node: nuevoNode
            }
          }
        });
    }

  private armarResumen(){
    this.filasCorrectas = this.previsualizacionMasiva.filter(partida => partida.node.carga && !partida.node.errorImporte && partida.node.importePercibido).length;
    this.filasConErrores = this.erroresPrevisualizacion.length + this.erroresCodigosPartidas.length;
  }

  get totalFilasLeidas() {
    return this.filasLeidas
  }

  get totalFilasCorrectas() {
    return this.filasCorrectas
  }

  get totalFilasConErrores() {
    return this.filasConErrores
  }
}
