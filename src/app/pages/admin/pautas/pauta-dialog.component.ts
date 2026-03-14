import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatOption, MatSelect } from '@angular/material/select';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { Pauta, PautasAdminService, PautaPayload } from '../../../services/pautas-admin.service';
import { ConvenioSelectOption, ConvenioService } from '../../../services/convenio.service';
import { TipoPauta, TiposPautaAdminService } from '../../../services/tipos-pauta-admin.service';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-pauta-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    LoadingOverlayComponent,
    MatOption,
    MatSelect
  ],
  templateUrl: './pauta-dialog.component.html',
  styleUrls: ['./pauta-dialog.component.scss']
})
export class PautaDialogComponent implements OnInit {
  form!: FormGroup;
  enviando = false;

  convenios: ConvenioSelectOption[] = [];
  cargandoConvenios = false;
  tiposPauta: TipoPauta[] = [];
  cargandoTiposPauta = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly convenioService: ConvenioService,
    private readonly tiposPautaAdminService: TiposPautaAdminService,
    private readonly pautaAdminService: PautasAdminService,
    private readonly dialogRef: MatDialogRef<PautaDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: Pauta | null
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      convenio_id: new FormControl({ value: this.data?.convenio_id || '', disabled: !this.pautaModificable }, [Validators.required]),
      descripcion: new FormControl({ value: this.data?.descripcion || '', disabled: !this.pautaModificable }, [Validators.required, Validators.minLength(3), Validators.maxLength(255)]),
      dia_vto: new FormControl({ value: this.data?.dia_vto || '', disabled: !this.pautaModificable }, [Validators.required, Validators.min(1), Validators.max(31)]),
      plazo_vto: new FormControl({ value: this.data?.plazo_vto || '', disabled: !this.pautaModificable }, [Validators.required, Validators.min(0)]),
      cant_dias_rectifica: new FormControl({ value: this.data?.cant_dias_rectifica ?? null, disabled: !this.pautaModificable }),
      plazo_mes_rectifica: new FormControl({ value: this.data?.plazo_mes_rectifica ?? null, disabled: !this.pautaModificable }),
      tipo_pauta_id: new FormControl({ value: this.data?.tipo_pauta_id || '', disabled: !this.pautaModificable }, [Validators.required]),
    });

    this.form.get('tipo_pauta_id')?.valueChanges.subscribe((tipoPautaId) => {
      this.configurarRectificacionSegunTipo(tipoPautaId, true);
    });

    this.cargarConvenios();
    this.cargarTiposPauta();
  }

  guardar(): void {
    if (this.sinTiposPauta) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'No hay tipos de pauta cargados. Creá uno antes de guardar.',
        showConfirmButton: false,
        timer: 3000
      });
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'warning',
        title: 'Revisá los campos obligatorios',
        showConfirmButton: false,
        timer: 2200
      });
      return;
    }

    const payload = this.construirPayload(this.form.getRawValue());
    this.enviando = true;
    const request$ = this.data?.pauta_id
      ? this.pautaAdminService.actualizarPauta(this.data.pauta_id, payload)
      : this.pautaAdminService.crearPauta(payload);

    request$
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: () => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: this.data?.pauta_id ? 'Pauta actualizada' : 'Pauta creada',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
            background: '#f0fdf4',
            color: '#14532d'
          });
          this.dialogRef.close(true);
        },
        error: (error) => {
          const message = this.resolveErrorMessage(error, 'No se pudo guardar la pauta.');
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: message,
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
            background: '#fee2e2',
            color: '#7f1d1d'
          });
        }
      });
  }

  get pautaModificable(): boolean {
    if (this.data?.modificable !== undefined && this.data?.modificable !== null) {
      return this.data.modificable;
    }

    return true;
  }

  get sinTiposPauta(): boolean {
    return !this.cargandoTiposPauta && this.tiposPauta.length === 0;
  }

  get mostrarCamposRectificacion(): boolean {
    const tipo = this.obtenerTipoPautaSeleccionado();
    return Boolean(tipo?.requiere_periodo_rectificar);
  }

  getNombreTipoPauta(tipoPauta: TipoPauta): string {
    const nombre = String(tipoPauta?.nombre ?? '').trim();
    const codigo = String(tipoPauta?.codigo ?? '').trim();
    if (nombre && codigo) {
      return `${nombre} (${codigo})`;
    }
    return nombre || codigo || 'Tipo sin nombre';
  }

  private construirPayload(formValue: any): PautaPayload {
    const normalizarString = (valor: unknown): string | null => {
      if (valor === null || valor === undefined) {
        return null;
      }
      const limpio = String(valor).trim();
      return limpio.length > 0 ? limpio : null;
    };

    const payload: PautaPayload = {
      descripcion: normalizarString(formValue.descripcion) ?? '',
      dia_vto: Number(formValue.dia_vto ?? 0),
      plazo_vto: Number(formValue.plazo_vto ?? 0),
      tipo_pauta_id: Number(formValue.tipo_pauta_id),
      convenio_id: Number(formValue.convenio_id)
    };

    const tipoSeleccionado = this.obtenerTipoPautaSeleccionado();
    if (tipoSeleccionado?.requiere_periodo_rectificar) {
      payload.cant_dias_rectifica = Number(formValue.cant_dias_rectifica ?? 0);
      payload.plazo_mes_rectifica = Number(formValue.plazo_mes_rectifica ?? 0);
    } else {
      payload.cant_dias_rectifica = null;
      payload.plazo_mes_rectifica = null;
    }

    return payload;
  }

  private resolveErrorMessage(error: any, fallback: string): string {
    if (error?.error) {
      const err = error.error.error;
      if (typeof err === 'string' && err.trim().length > 0) {
        return err;
      }
      if (typeof err?.message === 'string' && err.message.trim().length > 0) {
        return err.message;
      }
    }

    if (typeof error?.message === 'string' && error.message.trim().length > 0) {
      return error.message;
    }

    return fallback;
  }

  private cargarConvenios(): void {
    this.cargandoConvenios = true;
    this.convenioService
      .getCatalogoConvenios()
      .subscribe({
        next: (convenios) => {
          this.convenios = convenios ?? [];
        },
        error: (error) => {
          console.error('Error obteniendo catálogo de convenios', error);
        },
        complete: () => {
          this.cargandoConvenios = false;
        }
      });
  }

  private cargarTiposPauta(): void {
    this.cargandoTiposPauta = true;
    this.tiposPautaAdminService
      .getCatalogoTiposPauta()
      .subscribe({
        next: (tiposPauta) => {
          this.tiposPauta = tiposPauta ?? [];
          this.configurarRectificacionSegunTipo(this.form.get('tipo_pauta_id')?.value, false);
        },
        error: (error) => {
          this.tiposPauta = [];
          console.error('Error obteniendo catálogo de tipos de pauta', error);
        },
        complete: () => {
          this.cargandoTiposPauta = false;
        }
      });
  }

  private obtenerTipoPautaSeleccionado(): TipoPauta | undefined {
    const tipoPautaId = Number(this.form.get('tipo_pauta_id')?.value ?? this.data?.tipo_pauta_id ?? 0);
    if (!Number.isInteger(tipoPautaId) || tipoPautaId <= 0) {
      return undefined;
    }

    return this.tiposPauta.find((tipoPauta) => tipoPauta.tipo_pauta_id === tipoPautaId);
  }

  private configurarRectificacionSegunTipo(tipoPautaId: unknown, limpiarNoRequeridos: boolean): void {
    const cantDiasCtrl = this.form.get('cant_dias_rectifica');
    const plazoMesCtrl = this.form.get('plazo_mes_rectifica');
    if (!cantDiasCtrl || !plazoMesCtrl) {
      return;
    }

    const tipoId = Number(tipoPautaId ?? 0);
    const tipo = this.tiposPauta.find((item) => item.tipo_pauta_id === tipoId);
    const requiereRectificacion = Boolean(tipo?.requiere_periodo_rectificar);

    if (requiereRectificacion) {
      if (this.pautaModificable) {
        cantDiasCtrl.enable({ emitEvent: false });
        plazoMesCtrl.enable({ emitEvent: false });
      }
      //cantDiasCtrl.setValidators([Validators.required, Validators.min(1), Validators.max(31)]);
      //plazoMesCtrl.setValidators([Validators.required, Validators.min(0)]);
    } else {
      cantDiasCtrl.clearValidators();
      plazoMesCtrl.clearValidators();

      if (limpiarNoRequeridos) {
        cantDiasCtrl.setValue(null, { emitEvent: false });
        plazoMesCtrl.setValue(null, { emitEvent: false });
      }

      cantDiasCtrl.disable({ emitEvent: false });
      plazoMesCtrl.disable({ emitEvent: false });
    }

    cantDiasCtrl.updateValueAndValidity({ emitEvent: false });
    plazoMesCtrl.updateValueAndValidity({ emitEvent: false });
  }
}
