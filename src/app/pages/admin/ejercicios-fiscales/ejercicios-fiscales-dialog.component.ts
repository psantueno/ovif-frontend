import { Component, Inject, OnInit, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import Swal from 'sweetalert2';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import {
  EjerciciosService,
  EjercicioMes,
  CreateEjercicioPayload,
  UpdateEjercicioPayload,
  ConvenioOption,
  PautaConvenioOption,
  PautaConvenioParametros
} from '../../../services/ejercicios.service';

interface DialogData {
  ejercicio?: EjercicioMes;
}

interface MesOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-ejercicios-fiscales-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './ejercicios-fiscales-dialog.component.html',
  styleUrls: ['./ejercicios-fiscales-dialog.component.scss']
})
export class EjerciciosFiscalesDialogComponent implements OnInit {
  form!: FormGroup;
  enviando = false;
  convenios: ConvenioOption[] = [];
  pautas: PautaConvenioOption[] = [];
  cargandoConvenios = false;
  cargandoPautas = false;
  cargandoParametrosPauta = false;
  readonly meses: MesOption[] = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
  ];

  private readonly esEdicion: boolean;
  private autoFechasInicializadas = false;
  selectedPautaParametros: PautaConvenioParametros | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly ejerciciosService: EjerciciosService,
    private readonly dialogRef: MatDialogRef<EjerciciosFiscalesDialogComponent>,
    private readonly destroyRef: DestroyRef,
    @Inject(MAT_DIALOG_DATA) public readonly data: DialogData | null
  ) {
    this.esEdicion = !!data?.ejercicio;
  }

  ngOnInit(): void {
    const now = new Date();
    const defaultEjercicio = now.getFullYear();
    const defaultMes = 1;

    this.form = this.fb.group({
      ejercicio: [
        this.data?.ejercicio?.ejercicio ?? defaultEjercicio,
        [Validators.required, Validators.min(2000)]
      ],
      mes: [
        this.data?.ejercicio?.mes ?? defaultMes,
        [Validators.required, Validators.min(1), Validators.max(12)]
      ],
      convenio_id: [
        this.data?.ejercicio?.convenio_id ?? null,
        [Validators.required]
      ],
      pauta_id: [
        this.data?.ejercicio?.pauta_id ?? null,
        [Validators.required]
      ],
      fecha_inicio: [
        this.data?.ejercicio?.fecha_inicio ? this.toDateInput(this.data.ejercicio.fecha_inicio) : '',
        Validators.required
      ],
      fecha_fin: [
        this.data?.ejercicio?.fecha_fin ? this.toDateInput(this.data.ejercicio.fecha_fin) : '',
        Validators.required
      ]
    });

    if (this.data?.ejercicio) {
      this.form.get('ejercicio')?.disable();
      this.form.get('mes')?.disable();
      this.form.get('convenio_id')?.disable();
      this.form.get('pauta_id')?.disable();
    }

    this.setupConvenioListeners();
    this.setupFechaFinAutoUpdate();

    if (!this.esEdicion) {
      this.setupAutoFechas();
    }

    this.cargarConvenios();
  }

  private cargarConvenios(): void {
    this.cargandoConvenios = true;
    this.ejerciciosService
      .listarConvenios()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.cargandoConvenios = false;
        })
      )
      .subscribe({
        next: (convenios) => {
          this.convenios = convenios;
          const convenioCtrl = this.form.get('convenio_id');
          const preseleccion = this.data?.ejercicio?.convenio_id ?? convenioCtrl?.value;
          if (preseleccion) {
            if (!convenioCtrl?.value) {
              convenioCtrl?.setValue(preseleccion, { emitEvent: false });
            }
            this.cargarPautas(Number(preseleccion), this.data?.ejercicio?.pauta_id ?? null);
          } else if (convenios.length === 1 && !this.esEdicion) {
            convenioCtrl?.setValue(convenios[0].id);
          }
        },
        error: () => {
          this.showLoadError('No se pudieron obtener los convenios disponibles.');
        }
      });
  }

  private cargarPautas(convenioId: number, preseleccion?: number | null): void {
    if (!convenioId) {
      this.pautas = [];
      this.form.get('pauta_id')?.reset();
      this.selectedPautaParametros = null;
      return;
    }
    this.cargandoPautas = true;
    this.ejerciciosService
      .listarPautasPorConvenio(convenioId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.cargandoPautas = false;
        })
      )
      .subscribe({
        next: (pautas) => {
          this.pautas = pautas;
          const pautaCtrl = this.form.get('pauta_id');
          let skipFechaUpdate = false;
          if (preseleccion) {
            pautaCtrl?.setValue(preseleccion, { emitEvent: false });
            skipFechaUpdate = this.esEdicion;
          } else if (pautas.length === 1 && !this.esEdicion) {
            pautaCtrl?.setValue(pautas[0].id);
          }
          this.syncSelectedPauta(skipFechaUpdate);
        },
        error: () => {
          this.pautas = [];
          this.form.get('pauta_id')?.reset();
          this.selectedPautaParametros = null;
          this.showLoadError('No se pudieron obtener las pautas para el convenio seleccionado.');
        }
      });
  }

  guardar(): void {
    if (this.enviando) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast('Completa los campos obligatorios', 'warning');
      return;
    }

    const rawValue = {
      ...this.form.getRawValue(),
      fecha_inicio: this.form.get('fecha_inicio')?.value,
      fecha_fin: this.form.get('fecha_fin')?.value
    };

    if (rawValue.fecha_inicio && rawValue.fecha_fin && rawValue.fecha_inicio > rawValue.fecha_fin) {
      this.toast('La fecha de inicio debe ser anterior o igual a la fecha de fin.', 'warning');
      return;
    }

    if (this.data?.ejercicio) {
      const payload: UpdateEjercicioPayload = {
        fecha_inicio: rawValue.fecha_inicio,
        fecha_fin: rawValue.fecha_fin
      };
      this.actualizarEjercicio(this.data.ejercicio.ejercicio, this.data.ejercicio.mes, payload);
    } else {
      const payload: CreateEjercicioPayload = {
        ejercicio: Number(rawValue.ejercicio),
        mes: Number(rawValue.mes),
        fecha_inicio: rawValue.fecha_inicio,
        fecha_fin: rawValue.fecha_fin,
        convenio_id: Number(rawValue.convenio_id),
        pauta_id: Number(rawValue.pauta_id)
      };
      this.crearEjercicio(payload);
    }
  }

  private crearEjercicio(payload: CreateEjercicioPayload): void {
    this.enviando = true;
    this.ejerciciosService
      .crearEjercicio(payload)
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
      next: () => {
        this.toast('Ejercicio creado correctamente', 'success');
        this.dialogRef.close(true);
      },
      error: (error) => {
        const mensajes = this.resolveErrorMessages(error, 'No se pudo crear el ejercicio fiscal.');
        this.showError(mensajes, 'No se pudo crear el ejercicio');
      }
    });
  }

  private actualizarEjercicio(ejercicio: number, mes: number, payload: UpdateEjercicioPayload): void {
    this.enviando = true;
    this.ejerciciosService
      .actualizarEjercicio(ejercicio, mes, payload)
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
      next: () => {
        this.toast('Ejercicio actualizado correctamente', 'success');
        this.dialogRef.close(true);
      },
      error: (error) => {
        const mensajes = this.resolveErrorMessages(error, 'No se pudo actualizar el ejercicio fiscal.');
        this.showError(mensajes, 'No se pudo actualizar el ejercicio');
      }
    });
  }

  private toast(message: string, icon: 'success' | 'warning' | 'error'): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title: message,
      showConfirmButton: false,
      timer: 2200,
      timerProgressBar: true
    });
  }

  private showError(messages: string[], title: string): void {
    const [principal, ...detalles] = messages;
    const htmlPartes: string[] = [];

    if (principal) {
      htmlPartes.push(`<p class="swal-message">${this.escapeHtml(principal)}</p>`);
    }

    if (detalles.length > 0) {
      const items = detalles.map((detalle) => `<li>${this.escapeHtml(detalle)}</li>`).join('');
      htmlPartes.push(`<ul class="swal-error-list">${items}</ul>`);
    }

    Swal.fire({
      icon: 'error',
      title,
      html: htmlPartes.join(''),
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#d33'
    });
  }

  private showLoadError(message: string): void {
    Swal.fire({
      icon: 'error',
      title: 'Error al cargar datos',
      text: message,
      confirmButtonText: 'Aceptar',
      confirmButtonColor: '#d33'
    });
  }

  private setupConvenioListeners(): void {
    const convenioCtrl = this.form?.get('convenio_id');
    if (!convenioCtrl) {
      return;
    }
    convenioCtrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((valor) => {
      const pautaCtrl = this.form.get('pauta_id');
      if (!valor) {
        this.pautas = [];
        pautaCtrl?.reset();
        this.selectedPautaParametros = null;
        return;
      }
      pautaCtrl?.reset();
      this.selectedPautaParametros = null;
      this.cargarPautas(Number(valor));
    });
  }

  private setupFechaFinAutoUpdate(): void {
    const inicioCtrl = this.form?.get('fecha_inicio');
    const pautaCtrl = this.form?.get('pauta_id');
    if (pautaCtrl) {
      pautaCtrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        this.syncSelectedPauta();
      });
    }
    if (!inicioCtrl) {
      return;
    }
    inicioCtrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((valor) => {
      if (typeof valor === 'string' && valor) {
        this.actualizarFechaFin(valor);
      }
    });
  }

  private syncSelectedPauta(skipFechaUpdate = false): void {
    const pautaCtrl = this.form?.get('pauta_id');
    const pautaId = Number(pautaCtrl?.value);
    if (!pautaId) {
      this.selectedPautaParametros = null;
      return;
    }
    this.selectedPautaParametros = null;
    const pautaSeleccionada = pautaId;
    this.cargandoParametrosPauta = true;
    this.ejerciciosService
      .obtenerParametrosPauta(pautaId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => (this.cargandoParametrosPauta = false))
      )
      .subscribe({
        next: (parametros) => {
          if (Number(this.form.get('pauta_id')?.value) !== pautaSeleccionada) {
            return;
          }
          this.selectedPautaParametros = parametros;
          if (!skipFechaUpdate) {
            const inicio = this.form.get('fecha_inicio')?.value;
            if (typeof inicio === 'string' && inicio) {
              this.actualizarFechaFin(inicio);
            }
          }
        },
        error: () => {
          if (Number(this.form.get('pauta_id')?.value) !== pautaSeleccionada) {
            return;
          }
          this.selectedPautaParametros = null;
          this.showLoadError('No se pudieron obtener los parámetros de la pauta seleccionada.');
        }
      });
  }

  private resolveErrorMessages(error: any, fallback: string): string[] {
    const mensajes: string[] = [];
    const payload = error?.error ?? error;

    const agregar = (valor: unknown) => {
      if (typeof valor === 'string') {
        const limpio = valor.trim();
        if (limpio.length > 0) {
          mensajes.push(limpio);
        }
      }
    };

    if (typeof payload === 'string') {
      agregar(payload);
    } else if (payload && typeof payload === 'object') {
      agregar((payload as any).error);
      agregar((payload as any).message);

      const detalles = (payload as any).detalles ?? (payload as any).errors ?? (payload as any).detail;
      if (Array.isArray(detalles)) {
        detalles.forEach((detalle) => agregar(detalle));
      } else {
        agregar(detalles);
      }
    }

    agregar(error?.message);

    if (mensajes.length === 0) {
      mensajes.push(fallback);
    }

    return Array.from(new Set(mensajes));
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private toDateInput(value: string): string {
    if (!value) {
      return '';
    }
    const [date] = value.split('T');
    return date ?? value;
  }

  private setupAutoFechas(): void {
    if (this.autoFechasInicializadas) {
      return;
    }
    this.autoFechasInicializadas = true;

    const ejercicioCtrl = this.form.get('ejercicio');
    const mesCtrl = this.form.get('mes');
    const inicioCtrl = this.form.get('fecha_inicio');

    if (!ejercicioCtrl || !mesCtrl || !inicioCtrl) {
      return;
    }

    const aplicarPorMesEjercicio = () => {
      const ejercicio = Number(ejercicioCtrl.value);
      const mes = Number(mesCtrl.value);
      if (!ejercicio || !mes) {
        return;
      }
      const fechaDefault = this.formatearFecha(new Date(ejercicio, mes - 1, 1));
      const valorActual = inicioCtrl.value;
      if (valorActual !== fechaDefault) {
        inicioCtrl.setValue(fechaDefault, { emitEvent: true });
      } else {
        this.actualizarFechaFin(fechaDefault);
      }
      inicioCtrl.markAsPristine();
      inicioCtrl.markAsUntouched();
    };

    mesCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => aplicarPorMesEjercicio());

    ejercicioCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => aplicarPorMesEjercicio());

    aplicarPorMesEjercicio();
  }

  private actualizarFechaFin(fechaInicio: string): void {
    const finCtrl = this.form.get('fecha_fin');
    if (!finCtrl || !this.selectedPautaParametros) {
      return;
    }
    const calculada = this.calcularFechaFin(fechaInicio);
    if (!calculada) {
      return;
    }
    finCtrl.setValue(calculada, { emitEvent: false });
    finCtrl.markAsPristine();
    finCtrl.markAsUntouched();
  }

  private calcularFechaFin(fechaInicio: string): string {
    if (!this.selectedPautaParametros) {
      return '';
    }

    const ejercicio = Number(this.form.get('ejercicio')?.value);
    const mes = Number(this.form.get('mes')?.value);

    let base: Date | null = null;
    if (ejercicio && mes) {
      base = new Date(ejercicio, mes - 1, 1);
    } else if (fechaInicio) {
      const fallback = new Date(fechaInicio);
      base = Number.isNaN(fallback.getTime()) ? null : fallback;
    }

    if (!base) {
      return '';
    }

    const diaVto = Number(this.selectedPautaParametros.dia_vto ?? 0);
    const plazoMeses = Number(this.selectedPautaParametros.plazo_vto ?? 0);

    if (plazoMeses) {
      base.setMonth(base.getMonth() + plazoMeses);
    }

    if (diaVto > 0) {
      const diasEnMes = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
      base.setDate(Math.min(diaVto, diasEnMes));
    }

    return this.formatearFecha(base);
  }

  get pautaDiaVtoTexto(): string {
    const valor = this.selectedPautaParametros?.dia_vto;
    if (valor === null || valor === undefined) {
      return 'Sin definir';
    }
    return `${valor}`;
  }

  get pautaPlazoVtoTexto(): string {
    const valor = this.selectedPautaParametros?.plazo_vto;
    if (valor === null || valor === undefined) {
      return 'Sin definir';
    } else if (valor === 0) {
      return 'mes en curso';
    }
    const sufijo = valor === 1 ? 'mes' : 'meses';
    return `${valor} ${sufijo}`;
  }

  private formatearFecha(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
