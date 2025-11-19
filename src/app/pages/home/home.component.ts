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

interface EjercicioPautaOption {
  valor: string;
  texto: string;
  metadata: PeriodoSeleccionadoMunicipio & {
    convenio?: string | number | boolean | null;
    pauta?: string | number | boolean | null;
  };
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatCardModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
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
        this.periodoActivo = { ...this.periodoPersistido };
        this.modulosHabilitados = this.periodoActivo.modulos ?? this.obtenerModulosPermitidos(this.periodoActivo.tipo_pauta);
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
      .getEjerciciosDisponibles(municipioId)
      .pipe(take(1))
      .subscribe({
        next: (ejercicios) => {
          this.ejerciciosMeses = ejercicios.map((item: any) => this.mapPeriodoOption(item));

          if (periodoGuardado) {
            const valorPersistido =
              periodoGuardado.valor ??
              this.municipioService.buildPeriodoValor(periodoGuardado) ??
              '';
            const seleccionado = this.ejerciciosMeses.find((item) => item.valor === valorPersistido);

            if (seleccionado) {
              this.ejercicioMes = valorPersistido;
              this.periodoPersistido = { ...seleccionado.metadata };
              this.periodoActivo = { ...seleccionado.metadata };
              this.modulosHabilitados =
                this.periodoActivo.modulos ??
                this.obtenerModulosPermitidos(this.periodoActivo.tipo_pauta);
            } else {
              this.ejercicioMes = '';
              this.periodoPersistido = null;
              this.periodoActivo = null;
              this.modulosHabilitados = [];
              if (this.municipioSeleccionado?.municipio_id) {
                this.municipioService.clearPeriodoSeleccionado(this.municipioSeleccionado.municipio_id);
              }
            }
          } else {
            this.ejercicioMes = '';
            this.periodoPersistido = null;
            this.periodoActivo = null;
            this.modulosHabilitados = [];
          }

          if (this.ejerciciosMeses.length === 0) {
            Swal.fire({
              icon: 'info',
              title: 'Sin ejercicios disponibles',
              text: 'No hay ejercicios abiertos para este municipio en este momento.',
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#3085d6',
            });
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

  onPeriodoChange(valor: string): void {
    this.ejercicioMes = valor;

    const municipioId = this.municipioSeleccionado?.municipio_id;
    if (!municipioId) {
      return;
    }

    if (!valor) {
      this.periodoPersistido = null;
      this.periodoActivo = null;
      this.modulosHabilitados = [];
      this.municipioService.clearPeriodoSeleccionado(municipioId);
      return;
    }

    const seleccionado = this.ejerciciosMeses.find((item) => item.valor === valor);
    if (!seleccionado) {
      this.periodoPersistido = null;
      this.periodoActivo = null;
      this.modulosHabilitados = [];
      this.municipioService.clearPeriodoSeleccionado(municipioId);
      return;
    }

    const periodo = { ...seleccionado.metadata };
    this.periodoPersistido = periodo;
    this.periodoActivo = periodo;
    this.modulosHabilitados = periodo.modulos ?? this.obtenerModulosPermitidos(periodo.tipo_pauta);
    this.persistirPeriodoActual();
  }

  ngOnDestroy(): void {
    this.municipioSub?.unsubscribe();
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
    const periodo: PeriodoSeleccionadoMunicipio = {
      ...this.periodoActivo,
      valor: valor ?? undefined,
      modulos: this.periodoActivo.modulos ?? this.obtenerModulosPermitidos(this.periodoActivo.tipo_pauta)
    };

    this.periodoPersistido = periodo;
    this.municipioService.setPeriodoSeleccionado(municipioId, periodo);
  }

  irA(modulo: string) {
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
      Swal.fire({
        icon: 'info',
        title: 'Pauta no habilitada',
        text: 'La pauta seleccionada no habilita este módulo. Elegí otra combinación.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    const valor = this.periodoActivo.valor ?? this.ejercicioMes;
    // 🚀 Lógica de navegación según módulo
    this.router.navigate([`/${modulo}`], {
      queryParams: { ejercicioMes: valor }
    });
  }

  async cerrarMes() {
    this.persistirPeriodoActual();

    if (!this.ejercicioMes || !this.periodoActivo) {
      await Swal.fire({
        icon: 'info',
        title: 'Selecciona un periodo',
        text: 'Debes elegir un ejercicio y mes antes de cerrar el periodo.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#3085d6',
      });
      return;
    }

    const { isConfirmed } = await Swal.fire({
      icon: 'warning',
      title: 'Cerrar periodo',
      text: '¿Seguro deseas cerrar el mes seleccionado?',
      showCancelButton: true,
      confirmButtonText: 'Si, cerrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
    });

    if (isConfirmed) {
      console.log('Cerrar mes:', this.ejercicioMes);
      // 🚀 Acá iría la llamada al backend
    }
  }

  get pautaActivaLabel(): string | null {
    return this.periodoActivo?.tipo_pauta_label ?? this.periodoActivo?.pauta_descripcion ?? null;
  }

  get modulosHabilitadosLabel(): string {
    if (!this.ejercicioMes) {
      return 'Seleccioná un periodo para ver los módulos habilitados.';
    }
    const modulos = this.modulosHabilitados;
    if (!modulos || modulos.length === 0) {
      return 'Todos los módulos están habilitados para este periodo.';
    }
    return `Módulos habilitados: ${modulos.map((mod) => this.formatearNombreModulo(mod)).join(', ')}`;
  }

  isModuloHabilitado(modulo: ModuloPauta): boolean {
    if (!this.ejercicioMes) {
      return false;
    }
    const modulos = this.modulosHabilitados;
    if (!modulos || modulos.length === 0) {
      return true;
    }
    return modulos.includes(modulo);
  }

  private obtenerModulosPermitidos(tipo: string | null | undefined): ModuloPauta[] {
    return this.ejerciciosService.mapTipoPautaToModulos(tipo ?? null);
  }

  private esModuloControlado(modulo: string): modulo is ModuloPauta {
    return modulo === 'gastos' || modulo === 'recursos' || modulo === 'personal' || modulo === 'recaudaciones';
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
    const tipoPauta = (item?.tipo_pauta ?? item?.PautaConvenio?.tipo_pauta ?? null) as string | null;
    const tipoLabel =
      item?.tipo_pauta_label ??
      this.ejerciciosService.obtenerEtiquetaTipoPauta(tipoPauta) ??
      pautaDescripcion;

    const metadata: PeriodoSeleccionadoMunicipio = {
      ejercicio,
      mes,
      convenio_id: this.toOptionalNumber(item?.convenio_id ?? item?.Convenio?.id),
      convenio_nombre: convenioNombre,
      pauta_id: this.toOptionalNumber(item?.pauta_id ?? item?.PautaConvenio?.id),
      pauta_descripcion: pautaDescripcion,
      tipo_pauta: tipoPauta,
      tipo_pauta_label: tipoLabel,
      fecha_inicio: item?.fecha_inicio ?? item?.fecha_inicio_oficial ?? null,
      fecha_fin: item?.fecha_fin ?? item?.fecha_fin_oficial ?? null,
      fecha_cierre: item?.fecha_cierre ?? null,
      modulos: this.obtenerModulosPermitidos(tipoPauta)
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

  private formatearNombreModulo(modulo: ModuloPauta): string {
    switch (modulo) {
      case 'gastos':
        return 'Gastos';
      case 'recursos':
        return 'Recursos';
      case 'recaudaciones':
        return 'Recaudaciones';
      case 'personal':
        return 'Personal';
      default:
        return modulo;
    }
  }
}
