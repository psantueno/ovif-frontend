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
import { parseCSV } from '../../core/utils/csvReader.util';
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
  cantidadContribuyentes: number | null;
  cantidadContribuyentesOriginal: number | null;
  cantidadContribuyentesTexto: string;
  cantidadContribuyentesOriginalTexto: string;
  cantidadPagaron: number | null;
  cantidadPagaronOriginal: number | null;
  cantidadPagaronTexto: string;
  cantidadPagaronOriginalTexto: string;
  errorImporte: boolean;
  errorContribuyentes: boolean;
  errorPagaron: boolean;
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
  readonly plantillaRecursosExcelUrl = 'assets/plantillas/plantilla_recursos.xlsx';
  readonly plantillaRecursosManualUrl = 'assets/plantillas/manual.pdf';
  archivoMasivoSeleccionado: File | null = null;
  previsualizacionMasiva: PartidaDisplay[] = [];
  erroresCargaMasiva: string[] = [];
  erroresPrevisualizacionMasiva: Array<{ row: number; error: string }> = [];
  cargandoArchivoMasivo = false;

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
      if (node.errorImporte || node.errorContribuyentes || node.errorPagaron) {
        return true;
      }
      if (node.importePercibidoOriginal !== node.importePercibido) {
        return true;
      }
      if (node.soloImporte) {
        return false;
      }
      return (
        node.cantidadContribuyentesOriginal !== node.cantidadContribuyentes ||
        node.cantidadPagaronOriginal !== node.cantidadPagaron
      );
    });
  }

  private actualizarBaseCambios(): void {
    this.partidasPlanas.forEach(({ node }) => {
      node.importePercibidoOriginal = node.importePercibido;
      node.importePercibidoOriginalTexto = node.importePercibidoTexto;
      node.cantidadContribuyentesOriginal = node.cantidadContribuyentes;
      node.cantidadContribuyentesOriginalTexto = node.cantidadContribuyentesTexto;
      node.cantidadPagaronOriginal = node.cantidadPagaron;
      node.cantidadPagaronOriginalTexto = node.cantidadPagaronTexto;
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
      return total + partida.node.importePercibido;
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
      const contenido = typeof lector.result === 'string' ? lector.result : '';

      if (!contenido) {
        this.erroresCargaMasiva.push('No pudimos leer el archivo seleccionado.');
        return;
      }

      this.obtenerFilasCSV(archivo);
      /*this.procesarContenidoCsv(contenido);*/
    };

    lector.onerror = () => {
      this.cargandoArchivoMasivo = false;
      this.erroresCargaMasiva.push('Ocurrió un error al leer el archivo. Intentá nuevamente.');
    };

    lector.readAsText(archivo, 'utf-8');
  }

    async obtenerFilasCSV(archivo: File): Promise<any> {
      try {
        const { rows, errores } = await parseCSV(archivo, 'recursos');

        const encabezados = Object.keys(rows[0] || {});
        const indiceCodigo = encabezados.indexOf('codigo_partida');
        const indiceDescripcion = encabezados.indexOf('descripcion');
        const indiceImporte = encabezados.indexOf('importe_percibido');
        const indiceContribuyentes = encabezados.indexOf('total_contribuyentes');
        const indicePagaron = encabezados.indexOf('contribuyentes_pagaron');

        if(rows.length === 0){
          this.erroresCargaMasiva.push('El archivo CSV está vacío.');
          return;
        }

        if (
          indiceCodigo === -1 ||
          indiceDescripcion === -1 ||
          indiceImporte === -1 ||
          indiceContribuyentes === -1 ||
          indicePagaron === -1
        ) {
          this.erroresCargaMasiva.push('La cabecera del archivo no coincide con la plantilla esperada.');
          return;
        }

        const partidasPrevisualizacion: PartidaDisplay[] = (() => {
          // 1. Mapa para acceso rápido por código
          const rowsMap = new Map<number, {codigo_partida: number; descripcion: string; importe_percibido: number, total_contribuyentes: number, contribuyentes_pagaron: number}>(
            rows.map(row => [row.codigo_partida, row])
          );

          // 2. Copia de partidasPlanas con modificación condicional
          return this.partidasPlanas.map(({ node, nivel }) => {
            const row = rowsMap.get(node.codigo);

            const nuevoNode: PartidaNode = {
              ...node,
              importePercibido: row ? row.importe_percibido : null,
              importePercibidoOriginal: row ? row.importe_percibido : null,
              importePercibidoTexto: row ? String(row.importe_percibido) : '',
              importePercibidoOriginalTexto: row
                ? String(row.importe_percibido)
                : '',
              cantidadContribuyentes: row ? row.total_contribuyentes : null,
              cantidadContribuyentesOriginal: row ? row.total_contribuyentes : null,
              cantidadContribuyentesTexto: row ? String(row.total_contribuyentes) : '',
              cantidadContribuyentesOriginalTexto: row
                ? String(row.total_contribuyentes)
                : '',
              cantidadPagaron: row ? row.contribuyentes_pagaron : null,
              cantidadPagaronOriginal: row ? row.contribuyentes_pagaron : null,
              cantidadPagaronTexto: row ? String(row.contribuyentes_pagaron) : '',
              cantidadPagaronOriginalTexto: row
                ? String(row.contribuyentes_pagaron)
                : '',
            };

            return {
              nivel,
              node: nuevoNode
            };
          });
        })()

        const partidasFiltradas: PartidaDisplay[] = this.filtrarPartidasPlanas(partidasPrevisualizacion);
        if(partidasFiltradas.length === 0){
          this.erroresCargaMasiva.push('El archivo está vacío o no cumple con la plantilla requerida.');
          return;
        }

        this.previsualizacionMasiva = partidasFiltradas;

        const erroresFiltrados = this.limpiarErroresPrevisualizacion(errores);

        this.asignarErroresPrevisualizacion(erroresFiltrados);
        this.erroresPrevisualizacionMasiva = erroresFiltrados;
      }
      catch (error) {
        this.erroresCargaMasiva.push('Ocurrió un error al procesar el archivo CSV.');
        return [];
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

      const loadablePartidas = this.previsualizacionMasiva.filter(fila => fila.node.carga);

      const recursosPayload: PartidaRecursoUpsertPayload[] = loadablePartidas.map((fila) => ({
        partidas_recursos_codigo: fila.node.codigo,
        recursos_importe_percibido: fila.node.importePercibido,
        recursos_cantidad_contribuyentes: fila.node.soloImporte ? null : fila.node.cantidadContribuyentes,
        recursos_cantidad_pagaron: fila.node.soloImporte ? null : fila.node.cantidadPagaron,
      }));

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
              this.actualizarBaseCambios();
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
      .filter((node) => node.carga)
      .map((node) => ({
        partidas_recursos_codigo: node.codigo,
        recursos_importe_percibido: node.importePercibido,
        recursos_cantidad_contribuyentes: node.soloImporte ? null : node.cantidadContribuyentes,
        recursos_cantidad_pagaron: node.soloImporte ? null : node.cantidadPagaron,
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
          this.mostrarError('No pudimos guardar los datos. Intentá nuevamente más tarde.');
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
          this.mostrarError('No pudimos generar el informe. Intentá nuevamente más tarde.');
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
    this.updateCampo(partida, campo, nuevoValor);
  }

  updateCampo(partida: PartidaNode, campo: CampoEditable, rawValue: string): void {
    if (campo !== 'importe' && partida.soloImporte) {
      return;
    }

    const sanitized = rawValue.replace(',', '.').trim();
    if (sanitized === '') {
      switch (campo) {
        case 'importe':
          partida.importePercibido = null;
          partida.importePercibidoTexto = '';
          partida.errorImporte = false;
          break;
        case 'contribuyentes':
          partida.cantidadContribuyentes = null;
          partida.cantidadContribuyentesTexto = '';
          partida.errorContribuyentes = false;
          break;
        case 'pagaron':
          partida.cantidadPagaron = null;
          partida.cantidadPagaronTexto = '';
          partida.errorPagaron = false;
          break;
      }
      this.actualizarEstadoCambios();
      return;
    }

    const numericValue = Number(sanitized);

    if (Number.isFinite(numericValue)) {
      switch (campo) {
        case 'importe':
          partida.importePercibido = numericValue;
          partida.importePercibidoTexto = sanitized;
          partida.errorImporte = false;
          break;
        case 'contribuyentes':
          partida.cantidadContribuyentes = numericValue;
          partida.cantidadContribuyentesTexto = sanitized;
          partida.errorContribuyentes = false;
          break;
        case 'pagaron':
          partida.cantidadPagaron = numericValue;
          partida.cantidadPagaronTexto = sanitized;
          partida.errorPagaron = false;
          break;
      }
    } else {
      switch (campo) {
        case 'importe':
          partida.importePercibidoTexto = rawValue;
          partida.errorImporte = true;
          break;
        case 'contribuyentes':
          partida.cantidadContribuyentesTexto = rawValue;
          partida.errorContribuyentes = true;
          break;
        case 'pagaron':
          partida.cantidadPagaronTexto = rawValue;
          partida.errorPagaron = true;
          break;
      }
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
      this.persistirPeriodoSeleccionado(periodo);
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
          this.persistirPeriodoSeleccionado(this.periodoSeleccionado);
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
    const cantidadContribuyentes = this.parseNumero(partida.recursos_cantidad_contribuyentes);
    const cantidadPagaron = this.parseNumero(partida.recursos_cantidad_pagaron);
    const soloImporte = Boolean(partida.partidas_recursos_sl);

    const hijos = Array.isArray(partida.children)
      ? partida.children.map((child) => this.transformarPartida(child))
      : [];

    const node: PartidaNode = {
      codigo: Number(partida.partidas_recursos_codigo),
      descripcion: partida.partidas_recursos_descripcion ?? 'Partida sin nombre',
      carga: Boolean(partida.partidas_recursos_carga ?? partida.puede_cargar),
      soloImporte,
      importePercibido,
      importePercibidoOriginal: importePercibido,
      importePercibidoTexto: importePercibido !== null ? String(importePercibido) : '',
      importePercibidoOriginalTexto: importePercibido !== null ? String(importePercibido) : '',
      cantidadContribuyentes: soloImporte ? null : cantidadContribuyentes,
      cantidadContribuyentesOriginal: soloImporte ? null : cantidadContribuyentes,
      cantidadContribuyentesTexto: soloImporte
        ? ''
        : cantidadContribuyentes !== null
        ? String(cantidadContribuyentes)
        : '',
      cantidadContribuyentesOriginalTexto: soloImporte
        ? ''
        : cantidadContribuyentes !== null
        ? String(cantidadContribuyentes)
        : '',
      cantidadPagaron: soloImporte ? null : cantidadPagaron,
      cantidadPagaronOriginal: soloImporte ? null : cantidadPagaron,
      cantidadPagaronTexto: soloImporte
        ? ''
        : cantidadPagaron !== null
        ? String(cantidadPagaron)
        : '',
      cantidadPagaronOriginalTexto: soloImporte
        ? ''
        : cantidadPagaron !== null
        ? String(cantidadPagaron)
        : '',
      errorImporte: false,
      errorContribuyentes: false,
      errorPagaron: false,
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
    this.erroresPrevisualizacionMasiva = [];
    this.cargandoArchivoMasivo = false;
  }

  private validarPartidas(): boolean {
    let valido = true;

    this.partidasPlanas.forEach(({ node }) => {
      if (!node.carga) {
        return;
      }

      if (node.errorImporte || node.errorContribuyentes || node.errorPagaron) {
        valido = false;
        return;
      }

      if(node.importePercibido !== null && node.importePercibidoOriginal !== null && node.importePercibido !== node.importePercibidoOriginal && node.importePercibido <=0) {
        node.errorImporte = true;
        valido = false;
        return;
      }

      if(!node.soloImporte && node.importePercibido !== 0 && node.importePercibido !== null){
        if (node.cantidadContribuyentes === null || node.cantidadContribuyentes <= 0) {
          node.errorContribuyentes = true;
          valido = false;
          return;
        }
        if (node.cantidadPagaron === null || node.cantidadPagaron <= 0) {
          node.errorPagaron = true;
          valido = false;
          return;
        }
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

  private filtrarPartidasPlanas(
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

  private asignarErroresPrevisualizacion(errores: { row: number; error: string }[]): void {
    errores.forEach(({ row, error }) => {
      const fila = this.previsualizacionMasiva.find(f => f.node.codigo === row);

      if (fila) fila.node.errorImporte = true;
    });
  }

  private limpiarErroresPrevisualizacion(errores: { row: number; error: string }[]): { row: number; error: string }[] {
    const nuevosErrores: { row: number; error: string }[] = [];

    for(let i = 0; i < errores.length; i++){
      const { row, error } = errores[i];
      const fila = this.previsualizacionMasiva.find(f => f.node.codigo === row);
      if(!fila?.node.carga){
        continue;
      }

      if(!fila?.node.soloImporte){
        nuevosErrores.push({ row, error });
        continue;
      }

      if(fila?.node.soloImporte && !(error.includes('contribuyentes') || error.includes('Contribuyentes'))){
        nuevosErrores.push({ row, error });
        continue;
      }
    }

    return nuevosErrores;
  }

  private actualizarImportePartidas(): void {
    this.previsualizacionMasiva.forEach(({ node }) => {
      if (!node.carga) {
        return;
      }
      const partidaOriginal = this.partidasPlanas.find(p => p.node.codigo === node.codigo);
      if (partidaOriginal) {
        partidaOriginal.node.importePercibido = node.importePercibido;
        partidaOriginal.node.importePercibidoTexto = node.importePercibidoTexto;
        partidaOriginal.node.errorImporte = node.errorImporte;
        partidaOriginal.node.cantidadContribuyentes = node.cantidadContribuyentes;
        partidaOriginal.node.cantidadContribuyentesTexto = node.cantidadContribuyentesTexto;
        partidaOriginal.node.errorContribuyentes = node.errorContribuyentes;
        partidaOriginal.node.cantidadPagaron = node.cantidadPagaron;
        partidaOriginal.node.cantidadPagaronTexto = node.cantidadPagaronTexto;
        partidaOriginal.node.errorPagaron = node.errorPagaron;
      }
    })
  }

  public obtenerTotalFilasMasivas(): number {
    return this.previsualizacionMasiva.filter(partida => partida.node.carga).length;
  }

  public obtenerTotalImportesMasivos(): number {
    return this.previsualizacionMasiva.reduce((total, partida) => {
      if (!partida.node.carga) {
        return total;
      }
      if (partida.node.errorImporte || partida.node.importePercibido === null) {
        return total;
      }
      return total + partida.node.importePercibido;
    }, 0);
  }

  public obtenerTotalContribuyentesMasivos(): number {
    return this.previsualizacionMasiva.reduce((total, partida) => {
      if (!partida.node.carga || partida.node.soloImporte) {
        return total;
      }
      if (partida.node.errorContribuyentes || partida.node.cantidadContribuyentes === null) {
        return total;
      }
      return total + partida.node.cantidadContribuyentes;
    }, 0);
  }

  public obtenerTotalPagaronMasivos(): number {
    return this.previsualizacionMasiva.reduce((total, partida) => {
      if (!partida.node.carga || partida.node.soloImporte) {
        return total;
      }
      if (partida.node.errorPagaron || partida.node.cantidadPagaron === null) {
        return total;
      }
      return total + partida.node.cantidadPagaron;
    }, 0);
  }

  public obtenerErrorPartida(codigo: number): string | undefined | null {
    const fila = this.previsualizacionMasiva.find(f => f.node.codigo === codigo);

    if (fila && fila.node.errorImporte) return this.erroresPrevisualizacionMasiva.find(e => e.row === codigo)?.error;

    return null;
  }
}
