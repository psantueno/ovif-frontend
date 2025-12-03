import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, take } from 'rxjs/operators';
import Swal from 'sweetalert2';

import {
  MunicipioService,
  PartidaGastoResponse,
  PartidaGastoUpsertPayload,
  PeriodoSeleccionadoMunicipio
} from '../../services/municipio.service';
import { EjerciciosService } from '../../services/ejercicios.service';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';

interface PartidaNode {
  codigo: number;
  descripcion: string;
  carga: boolean;
  importe: number | null;
  importeOriginal: number | null;
  importeTexto: string;
  importeOriginalTexto: string;
  tieneError: boolean;
  hijos?: PartidaNode[];
}

interface PartidaDisplay {
  node: PartidaNode;
  nivel: number;
}

interface GastoCargaPreview {
  fila: number;
  codigo: string;
  descripcion: string;
  importeTexto: string;
  importe: number | null;
  errores: string[];
}

type MensajeTipo = 'info' | 'error';

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, BackButtonComponent],
  templateUrl: './gastos.component.html',
  styleUrls: ['./gastos.component.scss'],
})
export class GastosComponent implements OnInit, OnDestroy {
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
  modalVisible = false;

  vistaActual: 'manual' | 'masiva' = 'manual';
  readonly plantillaGastosCsvUrl = 'assets/plantillas/plantilla-carga-gastos.csv';
  archivoMasivoSeleccionado: File | null = null;
  previsualizacionMasiva: GastoCargaPreview[] = [];
  erroresCargaMasiva: string[] = [];
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
          'El período seleccionado no permite cargar Gastos. Elegí otra opción desde el inicio.',
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
    this.cambiosPendientes = this.partidasPlanas.some((partida) => {
      const nodo = partida.node;
      if (!nodo.carga) {
        return false;
      }
      if (nodo.tieneError) {
        return true;
      }
      return nodo.importeOriginal !== nodo.importe;
    });
  }

  private actualizarBaseCambios(): void {
    this.partidasPlanas.forEach((partida) => {
      partida.node.importeOriginal = partida.node.importe;
      partida.node.importeOriginalTexto = partida.node.importeTexto;
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
      if (partida.node.tieneError || partida.node.importe === null) {
        return total;
      }
      return total + partida.node.importe;
    }, 0);
  }

  cambiarVista(vista: 'manual' | 'masiva'): void {
    if (this.vistaActual === vista) {
      return;
    }

    this.vistaActual = vista;
  }

  get previsualizacionMasivaConErrores(): boolean {
    return this.previsualizacionMasiva.some((fila) => fila.errores.length > 0);
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

      this.procesarContenidoCsv(contenido);
    };

    lector.onerror = () => {
      this.cargandoArchivoMasivo = false;
      this.erroresCargaMasiva.push('Ocurrió un error al leer el archivo. Intentá nuevamente.');
    };

    lector.readAsText(archivo, 'utf-8');
  }

  limpiarArchivoMasiva(input?: HTMLInputElement): void {
    if (input) {
      input.value = '';
    }

    this.archivoMasivoSeleccionado = null;
    this.resetEstadoCargaMasiva();
  }

  simularEnvioMasivo(): void {
    if (!this.previsualizacionMasiva.length || this.previsualizacionMasivaConErrores || this.cargandoArchivoMasivo) {
      return;
    }

    this.mostrarAlerta(
      'Carga masiva pendiente de integración',
      'Cuando el servicio de backend esté disponible enviaremos estos datos a OVIF. Mientras tanto, asegurate de que el archivo sea correcto.',
      'info'
    );
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

    const partidasPayload: PartidaGastoUpsertPayload[] = this.partidasPlanas
      .map((partida) => partida.node)
      .filter((node) => node.carga)
      .map((node) => ({
        partidas_gastos_codigo: node.codigo,
        gastos_importe_devengado: node.importe,
      }));

    if (!partidasPayload.length) {
      this.mostrarMensaje('info', 'No hay partidas editables para guardar en este período.');
      return;
    }

    this.guardando = true;

    this.municipioService
      .guardarPartidasGastos({ municipioId, ejercicio, mes, partidas: partidasPayload })
      .pipe(
        take(1),
        finalize(() => {
          this.guardando = false;
        })
      )
      .subscribe({
        next: () => {
          this.actualizarBaseCambios();
          this.mostrarToastExito('Los importes fueron guardados correctamente.');
        },
        error: (error) => {
          console.error('Error al guardar las partidas de gastos:', error);
          this.mostrarError('No pudimos guardar los importes. Intentá nuevamente más tarde.');
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

    this.municipioService
      .descargarInformeGastos({ municipioId, ejercicio, mes })
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
          console.error('Error al generar el informe de gastos:', error);
          this.mostrarError('No pudimos generar el informe. Intentá nuevamente más tarde.');
        },
      });
  }

  cerrarModal(): void {
    this.modalVisible = false;
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

  sanearPegado(event: ClipboardEvent, partida: PartidaNode): void {
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
    partida.importeTexto = nuevoValor;
    this.updateImporte(partida, nuevoValor);
  }

  updateImporte(partida: PartidaNode, rawValue: string): void {
    const sanitized = rawValue.replace(',', '.').trim();
    if (sanitized === '') {
      partida.importeTexto = '';
      partida.importe = null;
      partida.tieneError = false;
      this.actualizarEstadoCambios();
      return;
    }

    const numericValue = Number(sanitized);

    if (Number.isFinite(numericValue)) {
      partida.importe = numericValue;
      partida.importeTexto = sanitized;
      partida.tieneError = false;
    } else {
      partida.importeTexto = rawValue;
      partida.tieneError = true;
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
      this.mostrarError('No pudimos obtener las partidas de gastos. Verificá el municipio o período seleccionado.');
      return;
    }

    this.municipioService
      .obtenerPartidasGastos({ municipioId, ejercicio, mes })
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
          this.mostrarError('No pudimos obtener las partidas de gastos. Intentá nuevamente más tarde.');
        },
      });
  }

  private transformarPartida(partida: PartidaGastoResponse): PartidaNode {
    const importe = this.parseImporte(partida.importe_devengado ?? partida.gastos_importe_devengado);
    const hijos = Array.isArray(partida.children)
      ? partida.children.map((child) => this.transformarPartida(child))
      : [];
    const importeTexto = importe !== null ? String(importe) : '';

    const node: PartidaNode = {
      codigo: Number(partida.partidas_gastos_codigo),
      descripcion: partida.partidas_gastos_descripcion ?? 'Partida sin nombre',
      carga: Boolean(partida.partidas_gastos_carga ?? partida.puede_cargar),
      importe,
      importeOriginal: importe,
      importeTexto,
      importeOriginalTexto: importeTexto,
      tieneError: false,
    };

    if (hijos.length) {
      node.hijos = hijos;
    }

    return node;
  }

  private parseImporte(valor: unknown): number | null {
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

  private validarImportes(): boolean {
    let valido = true;
    this.partidasPlanas.forEach((partida) => {
      if (!partida.node.carga) {
        return;
      }
      if (partida.node.tieneError) {
        valido = false;
      }
    });
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
    return `informe_gastos_${slugMunicipio}_${ejercicio}_${mesStr}.pdf`;
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

  private procesarContenidoCsv(contenido: string): void {
    const texto = contenido.replace(/^[\ufeff]+/, '');
    const lineas = texto
      .split(/\r?\n/)
      .map((linea) => linea.trim())
      .filter((linea) => linea.length > 0);

    if (!lineas.length) {
      this.erroresCargaMasiva.push('El archivo está vacío.');
      return;
    }

    const separador = this.detectarSeparador(lineas[0]);
    const encabezados = this.descomponerFila(lineas[0], separador).map((columna) => columna.trim().toLowerCase());
    const indiceCodigo = encabezados.indexOf('codigo_partida');
    const indiceDescripcion = encabezados.indexOf('descripcion');
    const indiceImporte = encabezados.indexOf('importe_devengado');

    if (indiceCodigo === -1 || indiceDescripcion === -1 || indiceImporte === -1) {
      this.erroresCargaMasiva.push('La cabecera del archivo no coincide con la plantilla esperada.');
      return;
    }

    const preview: GastoCargaPreview[] = [];

    for (let i = 1; i < lineas.length; i++) {
      const columnas = this.descomponerFila(lineas[i], separador);
      if (columnas.every((valor) => valor.trim() === '')) {
        continue;
      }

      const codigo = columnas[indiceCodigo]?.trim() ?? '';
      const descripcion = columnas[indiceDescripcion]?.trim() ?? '';
      const importeTexto = columnas[indiceImporte]?.trim() ?? '';
      const errores: string[] = [];

      if (!codigo) {
        errores.push('Código de partida faltante.');
      }

      if (!descripcion) {
        errores.push('Descripción faltante.');
      }

      let importe: number | null = null;

      if (importeTexto) {
        importe = this.convertirAImporte(importeTexto);
        if (importe === null) {
          errores.push('Importe inválido.');
        }
      } else {
        errores.push('Importe faltante.');
      }

      preview.push({
        fila: i + 1,
        codigo,
        descripcion,
        importeTexto,
        importe,
        errores,
      });
    }

    if (!preview.length) {
      this.erroresCargaMasiva.push('No se detectaron filas con datos en el archivo.');
      return;
    }

    this.previsualizacionMasiva = preview;
  }

  private detectarSeparador(linea: string): string {
    const candidatos: Array<{ separador: string; conteo: number }> = [
      { separador: ';', conteo: (linea.match(/;/g) ?? []).length },
      { separador: ',', conteo: (linea.match(/,/g) ?? []).length },
      { separador: '\t', conteo: (linea.match(/\t/g) ?? []).length },
    ];

    const mejor = candidatos.reduce((previo, actual) => (actual.conteo > previo.conteo ? actual : previo));
    return mejor.conteo > 0 ? mejor.separador : ',';
  }

  private descomponerFila(linea: string, separador: string): string[] {
    const resultado: string[] = [];
    let actual = '';
    let dentroDeComillas = false;
    const caracterSeparador = separador === '\t' ? '\t' : separador;

    for (let i = 0; i < linea.length; i++) {
      const caracter = linea[i];

      if (caracter === '"') {
        const siguiente = linea[i + 1];
        if (dentroDeComillas && siguiente === '"') {
          actual += '"';
          i++;
        } else {
          dentroDeComillas = !dentroDeComillas;
        }
        continue;
      }

      if (caracter === caracterSeparador && !dentroDeComillas) {
        resultado.push(actual);
        actual = '';
        continue;
      }

      if (!dentroDeComillas && (caracter === '\r' || caracter === '\n')) {
        continue;
      }

      actual += caracter;
    }

    resultado.push(actual);
    return resultado;
  }

  private convertirAImporte(valor: string): number | null {
    const texto = valor.trim();
    if (!texto) {
      return null;
    }

    const sinEspacios = texto.replace(/\s+/g, '');
    const ultimaComa = sinEspacios.lastIndexOf(',');
    const ultimoPunto = sinEspacios.lastIndexOf('.');
    let normalizado = sinEspacios;

    if (ultimaComa > -1 && ultimoPunto > -1) {
      if (ultimaComa > ultimoPunto) {
        normalizado = normalizado.replace(/\./g, '').replace(/,/g, '.');
      } else {
        normalizado = normalizado.replace(/,/g, '');
      }
    } else if (ultimaComa > -1) {
      normalizado = normalizado.replace(/,/g, '.');
    }

    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : null;
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

    return modulos.includes('gastos');
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
}
