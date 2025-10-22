import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { take } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { MunicipioService } from '../../services/municipio.service';
import { GastosService, PartidaGastoResponse } from '../../services/gastos.service';

interface PartidaNode {
  codigo: number;
  descripcion: string;
  carga: boolean;
  importe: number | null;
  importeTexto: string;
  tieneError: boolean;
  hijos?: PartidaNode[];
}

interface PartidaDisplay {
  node: PartidaNode;
  nivel: number;
}

type MensajeTipo = 'info' | 'error';

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './gastos.component.html',
  styleUrls: ['./gastos.component.scss'],
})
export class GastosComponent implements OnInit, OnDestroy {
  private readonly municipioService = inject(MunicipioService);
  private readonly gastosService = inject(GastosService);
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

  mesCerrado = false;
  mensaje: { tipo: MensajeTipo; texto: string } | null = null;
  mensajeTimeout: ReturnType<typeof setTimeout> | null = null;
  modalVisible = false;

  cargandoPartidas = false;
  errorAlCargarPartidas = false;

  partidas: PartidaNode[] = [];
  partidasPlanas: PartidaDisplay[] = [];

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
        this.router.navigate(['/home']);
        return;
      }

      this.ejercicioSeleccionado = ejercicio;
      this.mesSeleccionado = mes;

      this.cargarPartidas();
    });
  }

  ngOnDestroy(): void {
    if (this.mensajeTimeout) {
      clearTimeout(this.mensajeTimeout);
    }
  }

  get mesActualLabel(): string {
    if (!this.mesSeleccionado || !this.ejercicioSeleccionado) {
      return '';
    }

    const index = this.mesSeleccionado - 1;
    const nombreMes = this.meses[index] ?? '';
    return nombreMes ? `${nombreMes} ${this.ejercicioSeleccionado}` : '';
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
    if (this.errorAlCargarPartidas) {
      this.mostrarMensaje('error', 'No pudimos cargar las partidas. Reintentá más tarde.');
      return;
    }
    if (!this.partidasPlanas.length) {
      this.mostrarMensaje('info', 'No hay partidas disponibles para guardar.');
      return;
    }
    if (!this.validarImportes()) {
      this.mostrarMensaje('error', 'Ingrese solo valores válidos');
      return;
    }
    this.mostrarMensaje(
      'info',
      'Los importes han sido guardados correctamente (simulación)'
    );
  }

  generarInforme(): void {
    if (this.mesCerrado) {
      return;
    }
    if (this.cargandoPartidas) {
      this.mostrarMensaje('info', 'Esperá a que finalice la carga de partidas.');
      return;
    }
    if (this.errorAlCargarPartidas) {
      this.mostrarMensaje('error', 'No pudimos cargar las partidas. Reintentá más tarde.');
      return;
    }
    if (!this.partidasPlanas.length) {
      this.mostrarMensaje('info', 'No hay partidas disponibles para generar el informe.');
      return;
    }
    if (!this.validarImportes()) {
      this.mostrarMensaje('error', 'Ingrese solo valores válidos');
      return;
    }
    this.mostrarMensaje(
      'info',
      'Informe generado correctamente (simulación)'
    );
    this.modalVisible = true;
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
  }

  private cargarPartidas(): void {
    this.cargandoPartidas = true;
    this.errorAlCargarPartidas = false;

    this.gastosService
      .obtenerPartidas()
      .pipe(take(1))
      .subscribe({
        next: (response) => {
            console.log('Respuesta de partidas de gastos:', response);
          this.partidas = (response ?? []).map((partida) => this.transformarPartida(partida));
          this.partidasPlanas = this.flattenPartidas(this.partidas);
          this.cargandoPartidas = false;
        },
        error: () => {
          this.partidas = [];
          this.partidasPlanas = [];
          this.cargandoPartidas = false;
          this.errorAlCargarPartidas = true;
          this.mostrarMensaje(
            'error',
            'No pudimos obtener las partidas de gastos. Intentá nuevamente más tarde.'
          );
        },
      });
  }

  private transformarPartida(partida: PartidaGastoResponse): PartidaNode {
    const importe = this.parseImporte(partida.gastos_importe_devengado);
    const hijos = Array.isArray(partida.children)
      ? partida.children.map((child) => this.transformarPartida(child))
      : [];

    const node: PartidaNode = {
      codigo: Number(partida.partidas_gastos_codigo),
      descripcion: partida.partidas_gastos_descripcion ?? 'Partida sin nombre',
      carga: Boolean(partida.partidas_gastos_carga),
      importe,
      importeTexto: importe !== null ? String(importe) : '',
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
