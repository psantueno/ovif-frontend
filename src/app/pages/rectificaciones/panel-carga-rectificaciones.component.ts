import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MunicipioService, PeriodoSeleccionadoMunicipio } from '../../services/municipio.service';
import { take } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { EjerciciosService } from '../../services/ejercicios.service';
import { ModuloPauta } from '../../models/pauta.model';
import { BackButtonComponent } from '../../shared/components/back-button/back-button.component';

interface EjercicioPautaOption {
  valor: string;
  texto: string;
  metadata: PeriodoSeleccionadoMunicipio & {
    convenio?: string | number | boolean | null;
    pauta?: string | number | boolean | null;
  };
}

@Component({
  selector: 'app-panel-carga-rectificaciones',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatCardModule, BackButtonComponent],
  templateUrl: './panel-carga-rectificaciones.component.html',
  styleUrls: ['./panel-carga-rectificaciones.component.scss']
})
export class PanelCargaRectificacionesComponent implements OnInit, OnDestroy {
  municipioSeleccionado: any = null;
  ejercicioMes: string = '';
  ejerciciosMeses: EjercicioPautaOption[] = [];
  cargando = false;
  modulosHabilitados: ModuloPauta[] = [];
  periodoActivo: PeriodoSeleccionadoMunicipio | null = null;
  private periodoPersistido: PeriodoSeleccionadoMunicipio | null = null;
  private municipioSub?: Subscription;
  private sinMunicipioAlertado = false;
  private readonly ejerciciosService = inject(EjerciciosService);

  constructor(private router: Router, private readonly municipioService: MunicipioService) {}

  ngOnInit(): void {
    this.municipioSub = this.municipioService.municipio$.subscribe((municipio) => {
      this.municipioSeleccionado = municipio;
      this.periodoPersistido = null;
      this.periodoActivo = null;
      this.modulosHabilitados = [];
      this.ejerciciosMeses = [];
      this.ejercicioMes = '';

      if (!municipio?.municipio_id) {
        this.cargando = false;
        if (!this.sinMunicipioAlertado) {
          this.sinMunicipioAlertado = true;
          Swal.fire({
            icon: 'warning',
            title: 'Municipio no seleccionado',
            text: 'Debes elegir un municipio para consultar los ejercicios disponibles.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#3085d6'
          });
        }
        return;
      }

      this.sinMunicipioAlertado = false;
      this.periodoPersistido = this.municipioService.getPeriodoSeleccionado(municipio.municipio_id);
      if (this.periodoPersistido) {
        this.aplicarPeriodoSeleccionado(this.periodoPersistido);
        this.ejercicioMes =
          this.periodoPersistido.valor ??
          this.municipioService.buildPeriodoValor(this.periodoPersistido) ??
          '';
      } else {
        this.periodoActivo = null;
        this.modulosHabilitados = [];
        this.ejercicioMes = '';
      }
      this.cargarEjerciciosDisponibles(municipio.municipio_id);
    });
  }

  private cargarEjerciciosDisponibles(municipioId: number): void {
    this.cargando = true;
    this.ejerciciosMeses = [];
    const periodoGuardado = this.periodoPersistido;
    this.ejercicioMes =
      periodoGuardado?.valor ?? this.municipioService.buildPeriodoValor(periodoGuardado) ?? '';

    this.municipioService
      .getEjerciciosRectificablesDisponibles(municipioId)
      .pipe(take(1))
      .subscribe({
        next: (ejercicios) => {
          this.ejerciciosMeses = ejercicios.map((item: any) => this.mapPeriodoOption(item));

          if (this.ejerciciosMeses.length === 0) {
            this.limpiarPeriodoSeleccionadoActual();
            if (this.municipioSeleccionado?.municipio_id) {
              this.municipioService.clearPeriodoSeleccionado(this.municipioSeleccionado.municipio_id);
            }
            void Swal.fire({
              icon: 'info',
              title: 'Sin períodos rectificables',
              text: 'No hay períodos de rectificación habilitados para este municipio en este momento.',
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#3085d6',
            }).then(() => {
              this.router.navigate(['/home']);
            });
            return;
          }

          const valorPersistido =
            periodoGuardado?.valor ??
            this.municipioService.buildPeriodoValor(periodoGuardado) ??
            '';
          const seleccionadoPersistido = valorPersistido
            ? this.ejerciciosMeses.find((item) => item.valor === valorPersistido)
            : undefined;

          if (seleccionadoPersistido) {
            this.ejercicioMes = seleccionadoPersistido.valor;
            this.aplicarPeriodoSeleccionado(seleccionadoPersistido.metadata);
          } else if (periodoGuardado && this.municipioSeleccionado?.municipio_id) {
            this.municipioService.clearPeriodoSeleccionado(this.municipioSeleccionado.municipio_id);
            this.limpiarPeriodoSeleccionadoActual();
          }

          if (!this.periodoActivo && this.ejerciciosMeses.length === 1) {
            const unico = this.ejerciciosMeses[0];
            this.ejercicioMes = unico.valor;
            this.aplicarPeriodoSeleccionado(unico.metadata);
            this.persistirPeriodoActual();
          } else if (!this.periodoActivo) {
            this.ejercicioMes = '';
            this.aplicarPeriodoSeleccionado(null);
          }
        },
        error: () => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No fue posible obtener los ejercicios disponibles.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33',
          });
          this.cargando = false;
        },
        complete: () => {
          this.cargando = false;
        },
      });
  }

  private obtenerNombreMes(mes: number): string {
    const meses = [
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
    return meses[Math.max(0, Math.min(mes - 1, meses.length - 1))];
  }

  ngOnDestroy(): void {
    this.municipioSub?.unsubscribe();
  }

  onPeriodoChange(valor: string): void {
    this.ejercicioMes = valor;

    const municipioId = this.municipioSeleccionado?.municipio_id;
    if (!municipioId) {
      return;
    }

    if (!valor) {
      this.aplicarPeriodoSeleccionado(null);
      this.municipioService.clearPeriodoSeleccionado(municipioId);
      return;
    }

    const seleccionado = this.ejerciciosMeses.find((item) => item.valor === valor);
    if (!seleccionado) {
      this.aplicarPeriodoSeleccionado(null);
      this.municipioService.clearPeriodoSeleccionado(municipioId);
      return;
    }

    this.aplicarPeriodoSeleccionado(seleccionado.metadata);
    this.persistirPeriodoActual();
  }

  private persistirPeriodoActual(): void {
    const municipioId = this.municipioSeleccionado?.municipio_id;
    if (!municipioId) {
      return;
    }

    if (!this.periodoActivo) {
      this.periodoPersistido = null;
      this.municipioService.clearPeriodoSeleccionado(municipioId);
      return;
    }

    const valor = this.periodoActivo.valor ?? this.municipioService.buildPeriodoValor(this.periodoActivo);
    const modulosDerivados = this.periodoActivo.tipo_pauta_codigo
      ? this.obtenerModulosPermitidos(this.periodoActivo.tipo_pauta_codigo)
      : null;
    const periodo: PeriodoSeleccionadoMunicipio = {
      ...this.periodoActivo,
      valor: valor ?? undefined,
      modulos: this.periodoActivo.modulos ?? modulosDerivados
    };

    this.periodoPersistido = periodo;
    this.municipioService.setPeriodoSeleccionado(municipioId, periodo);
  }

  irA(modulo: string, rectificable: boolean = false): void {
    this.persistirPeriodoActual();

    if (!this.ejercicioMes || !this.periodoActivo) {
      Swal.fire({
        icon: 'info',
        title: 'Selecciona un periodo',
        text: 'Debes elegir un ejercicio y mes antes de continuar.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    if (this.esModuloControlado(modulo) && !this.isModuloHabilitado(modulo)) {
      const tipoCodigo = this.periodoActivo?.tipo_pauta_codigo ?? null;
      Swal.fire({
        icon: 'info',
        title: 'Pauta no habilitada',
        text: !tipoCodigo
          ? 'El período seleccionado no tiene tipo de pauta asociado. No se puede operar.'
          : 'No hay módulos operativos implementados para el tipo de pauta seleccionado.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    const valor = this.periodoActivo.valor ?? this.ejercicioMes;
    // 🚀 Lógica de navegación según módulo
    this.router.navigate([`/${modulo}`], {
      queryParams: { ejercicioMes: valor, rectificacion: rectificable }
    });
  }

  get pautaActivaLabel(): string | null {
    return this.periodoActivo?.tipo_pauta_label ?? this.periodoActivo?.pauta_descripcion ?? null;
  }

  get periodoRectificacionLabel(): string {
    const mes = this.periodoActivo?.mes;
    if (!mes) {
      return '';
    }

    return this.obtenerNombreMes(mes).toUpperCase();
  }

  get sinPeriodosRectificables(): boolean {
    return !this.cargando && this.ejerciciosMeses.length === 0;
  }

  get helperRectificacionPrincipal(): string {
    if (this.sinPeriodosRectificables) {
      return 'No existen periodos para rectificar.';
    }

    const periodo = this.periodoActivo;
    if (
      periodo?.pauta_descripcion &&
      periodo?.convenio_nombre &&
      periodo?.fecha_inicio_rectificacion &&
      periodo?.fecha_cierre
    ) {
      return `El período de rectificación de ${periodo.pauta_descripcion} correspondiente al convenio ${periodo.convenio_nombre} está habilitado del ${this.formatearFecha(periodo.fecha_inicio_rectificacion)} al ${this.formatearFecha(periodo.fecha_cierre)}.`;
    }

    return 'Seleccioná un período para ver su ventana de rectificación.';
  }

  get mostrarHelperRectificacionSecundario(): boolean {
    if (this.sinPeriodosRectificables) {
      return false;
    }

    return Boolean(
      this.periodoActivo?.fecha_inicio_rectificacion &&
      this.periodoActivo?.fecha_cierre
    );
  }

  get modulosHabilitadosLabel(): string {
    if (!this.ejercicioMes) {
      return 'Seleccioná un periodo para ver los módulos habilitados.';
    }
    if (!this.periodoActivo?.tipo_pauta_codigo) {
      return 'El período seleccionado no tiene tipo de pauta asociado.';
    }
    const modulos = this.modulosHabilitados;
    if (!modulos || modulos.length === 0) {
      return 'No hay módulos operativos implementados para el tipo de pauta seleccionado.';
    }
    return `Módulos habilitados: ${modulos.map((mod) => this.formatearNombreModulo(mod)).join(', ')}`;
  }

  isModuloHabilitado(modulo: ModuloPauta): boolean {
    if (!this.ejercicioMes) {
      return false;
    }
    if (!this.periodoActivo?.tipo_pauta_codigo) {
      return false;
    }
    const modulos = this.modulosHabilitados;
    if (!Array.isArray(modulos) || modulos.length === 0) {
      return false;
    }
    return modulos.includes(modulo);
  }

  private obtenerModulosPermitidos(tipo: string | null | undefined): ModuloPauta[] {
    return this.ejerciciosService.mapTipoPautaToModulos(tipo ?? null);
  }

  private esModuloControlado(modulo: string): modulo is ModuloPauta {
    return modulo === 'gastos' || modulo === 'recursos' || modulo === 'remuneraciones' || modulo === 'recaudaciones';
  }

  private mapPeriodoOption(item: any): EjercicioPautaOption {
    const ejercicio = Number(item?.ejercicio) || 0;
    const mes = Number(item?.mes) || 0;
    const convenioNombre =
      item?.convenio_nombre ??
      item?.Convenio?.nombre ??
      item?.convenio ??
      'Convenio sin nombre';
    const pautaDescripcion =
      item?.pauta_descripcion ??
      item?.PautaConvenio?.descripcion ??
      item?.pauta ??
      'Pauta sin descripción';
    const tipoPautaId = this.toOptionalNumber(
      item?.tipo_pauta_id ??
      item?.PautaConvenio?.tipo_pauta_id ??
      item?.PautaConvenio?.TipoPauta?.tipo_pauta_id
    );
    const tipoPautaCodigo = (
      item?.tipo_pauta_codigo ??
      item?.PautaConvenio?.tipo_pauta_codigo ??
      item?.PautaConvenio?.TipoPauta?.codigo ??
      null
    ) as string | null;
    const tipoPautaNombre =
      item?.tipo_pauta_nombre ??
      item?.PautaConvenio?.tipo_pauta_nombre ??
      item?.PautaConvenio?.TipoPauta?.nombre ??
      null;
    const tipoPautaDescripcion =
      item?.tipo_pauta_descripcion ??
      item?.PautaConvenio?.tipo_pauta_descripcion ??
      item?.PautaConvenio?.TipoPauta?.descripcion ??
      null;
    const requierePeriodoRectificar = item?.requiere_periodo_rectificar ??
      item?.PautaConvenio?.requiere_periodo_rectificar ??
      item?.PautaConvenio?.TipoPauta?.requiere_periodo_rectificar ??
      null;
    const tipoLabel =
      item?.tipo_pauta_label ??
      tipoPautaNombre ??
      tipoPautaDescripcion ??
      this.ejerciciosService.obtenerEtiquetaTipoPauta(tipoPautaCodigo) ??
      pautaDescripcion;

    const metadata: PeriodoSeleccionadoMunicipio = {
      ejercicio,
      mes,
      convenio_id: this.toOptionalNumber(item?.convenio_id ?? item?.Convenio?.convenio_id),
      convenio_nombre: convenioNombre,
      pauta_id: this.toOptionalNumber(item?.pauta_id ?? item?.PautaConvenio?.pauta_id),
      pauta_descripcion: pautaDescripcion,
      tipo_pauta_id: tipoPautaId,
      tipo_pauta_codigo: tipoPautaCodigo,
      tipo_pauta_nombre: tipoPautaNombre,
      tipo_pauta_descripcion: tipoPautaDescripcion,
      tipo_pauta_label: tipoLabel,
      requiere_periodo_rectificar:
        requierePeriodoRectificar === null || requierePeriodoRectificar === undefined
          ? null
          : Boolean(requierePeriodoRectificar),
      fecha_inicio: item?.fecha_inicio ?? item?.fecha_inicio_oficial ?? null,
      fecha_fin: item?.fecha_fin ?? item?.fecha_fin_oficial ?? null,
      fecha_inicio_rectificacion: item?.fecha_inicio_rectificacion ?? null,
      fecha_cierre: item?.fecha_cierre ?? null,
      cant_dias_rectifica: this.toOptionalNumber(item?.cant_dias_rectifica),
      plazo_mes_rectifica: this.toOptionalNumber(item?.plazo_mes_rectifica),
      modulos: tipoPautaCodigo ? this.obtenerModulosPermitidos(tipoPautaCodigo) : null
    };

    const valor = this.municipioService.buildPeriodoValor(metadata) ?? `${ejercicio}_${mes}`;
    metadata.valor = valor;

    const texto = `${ejercicio} / ${this.obtenerNombreMes(mes)} - Convenio: ${convenioNombre} - Pauta: ${tipoLabel}`;

    return {
      valor,
      texto,
      metadata
    };
  }

  private toOptionalNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }

  private aplicarPeriodoSeleccionado(periodo: PeriodoSeleccionadoMunicipio | null): void {
    this.periodoPersistido = periodo ? { ...periodo } : null;
    this.periodoActivo = periodo ? { ...periodo } : null;
    this.modulosHabilitados = periodo
      ? periodo.modulos ?? this.obtenerModulosPermitidos(periodo.tipo_pauta_codigo)
      : [];
  }

  private limpiarPeriodoSeleccionadoActual(): void {
    this.ejercicioMes = '';
    this.aplicarPeriodoSeleccionado(null);
  }

  private formatearFecha(value: string | null | undefined): string {
    if (!value) {
      return '';
    }

    const [year, month, day] = value.split('-');
    if (!year || !month || !day) {
      return value;
    }

    return `${day}/${month}/${year}`;
  }

  private formatearNombreModulo(modulo: ModuloPauta): string {
    switch (modulo) {
      case 'gastos':
        return 'Gastos';
      case 'recursos':
        return 'Recursos';
      case 'recaudaciones':
        return 'Recaudaciones';
      case 'remuneraciones':
        return 'Remuneraciones';
      default:
        return modulo;
    }
  }
}
