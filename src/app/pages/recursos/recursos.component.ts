import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, take } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { MunicipioService, PartidaRecursoResponse, PartidaRecursoUpsertPayload } from '../../services/municipio.service';

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
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './recursos.component.html',
  styleUrls: ['./recursos.component.scss'],
})
export class RecursosComponent implements OnInit, OnDestroy {
  private readonly municipioService = inject(MunicipioService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
  periodoSeleccionado: { ejercicio: number; mes: number } | null = null;

  mesCerrado = false;
  mensaje: { tipo: MensajeTipo; texto: string } | null = null;
  mensajeTimeout: ReturnType<typeof setTimeout> | null = null;
  modalVisible = false;

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
      this.router.navigate(['/home']);
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
        this.router.navigate(['/home']);
        return;
      }

      const [ejercicioStr, mesStr] = ejercicioMes.split('_');
      const ejercicio = Number(ejercicioStr);
      const mes = Number(mesStr);

      if (!Number.isInteger(ejercicio) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
        this.mostrarAlerta(
          'Datos inválidos',
          'Los datos recibidos no son válidos. Probá nuevamente.',
          'error'
        );
        this.router.navigate(['/home']);
        return;
      }

      this.ejercicioSeleccionado = ejercicio;
      this.mesSeleccionado = mes;
      this.periodoSeleccionado = { ejercicio, mes };
      this.persistirPeriodoSeleccionado(this.periodoSeleccionado);

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

  volverAlInicio(): void {
    this.router.navigate(['/home']);
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
        next: () => {
          this.actualizarBaseCambios();
          this.mostrarToastExito('Los registros fueron guardados correctamente.');
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
      periodo = { ejercicio: this.ejercicioSeleccionado, mes: this.mesSeleccionado };
      this.periodoSeleccionado = periodo;
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

          if (!this.periodoSeleccionado) {
            this.periodoSeleccionado = { ejercicio, mes };
          }

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

      if (!node.soloImporte && node.importePercibido !== null && node.importePercibido !== 0) {
        if (node.cantidadContribuyentes === null || node.cantidadContribuyentes <= 0) {
          node.errorContribuyentes = true;
          valido = false;
        }
        if (node.cantidadPagaron === null || node.cantidadPagaron <= 0) {
          node.errorPagaron = true;
          valido = false;
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

  private persistirPeriodoSeleccionado(periodo: { ejercicio: number; mes: number } | null): void {
    const municipioId = this.municipioActual?.municipio_id;
    if (!municipioId) {
      return;
    }

    if (!periodo) {
      this.municipioService.clearPeriodoSeleccionado(municipioId);
      return;
    }

    this.municipioService.setPeriodoSeleccionado(municipioId, periodo);
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
