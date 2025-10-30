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
  UpdateEjercicioPayload
} from '../../../services/ejercicios.service';
import {
  ParametrosService,
  ParametrosEjercicioFiscal
} from '../../../services/parametros.service';

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
  private parametrosConfig: ParametrosEjercicioFiscal = { cierreDia: 1, mesesOffset: 0 };
  private autoFechasInicializadas = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly ejerciciosService: EjerciciosService,
    private readonly parametrosService: ParametrosService,
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
    }

    if (!this.esEdicion) {
      this.setupAutoFechas();
      this.parametrosService
        .getParametrosEjercicioFiscal()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (config) => {
            this.parametrosConfig = config;
            const inicio = this.form.get('fecha_inicio')?.value;
            if (typeof inicio === 'string' && inicio) {
              this.actualizarFechaFin(inicio);
            }
          },
          error: () => {
            const inicio = this.form.get('fecha_inicio')?.value;
            if (typeof inicio === 'string' && inicio) {
              this.actualizarFechaFin(inicio);
            }
          }
        });
    }
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
        fecha_fin: rawValue.fecha_fin
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

    inicioCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((valor) => {
        if (typeof valor === 'string' && valor) {
          this.actualizarFechaFin(valor);
        }
      });

    aplicarPorMesEjercicio();
  }

  private actualizarFechaFin(fechaInicio: string): void {
    const finCtrl = this.form.get('fecha_fin');
    if (!finCtrl) {
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
    if (!fechaInicio) {
      return '';
    }

    const fecha = new Date(fechaInicio);
    if (Number.isNaN(fecha.getTime())) {
      return '';
    }

    const cierreDia = Number(this.parametrosConfig.cierreDia) || 15;
    const mesesOffset = Number(this.parametrosConfig.mesesOffset) || 3;
    const mesSelectCtrl = this.form.get('mes');
    const ejercicioCtrl = this.form.get('ejercicio');

    const mesSeleccionado = Number(mesSelectCtrl?.value) || fecha.getMonth() + 1;
    const ejercicioSeleccionado = Number(ejercicioCtrl?.value) || fecha.getFullYear();

    const totalMeses = mesSeleccionado + mesesOffset;
    const nuevaFecha = new Date(ejercicioSeleccionado, mesSeleccionado - 1, fecha.getDate());
    nuevaFecha.setMonth(mesSeleccionado - 1 + mesesOffset);

    const anioCalculado =
      totalMeses > 12
        ? ejercicioSeleccionado + Math.floor((mesSeleccionado - 1 + mesesOffset) / 12)
        : ejercicioSeleccionado;

    const mesCalculado = ((mesSeleccionado - 1 + mesesOffset) % 12 + 12) % 12;
    const resultado = new Date(anioCalculado, mesCalculado, cierreDia);

    return this.formatearFecha(resultado);
  }

  private formatearFecha(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
