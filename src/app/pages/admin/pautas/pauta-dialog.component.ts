import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelect, MatOption } from '@angular/material/select';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { provideNativeDateAdapter } from '@angular/material/core';

import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { Pauta, PautasAdminService, PautaPayload } from '../../../services/pautas-admin.service';
import { ConvenioSelectOption, ConvenioService } from '../../../services/convenio.service';

import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
@Component({
  selector: 'app-convenio-dialog',
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
    MatDatepickerModule,
    MatNativeDateModule,
    LoadingOverlayComponent,
    MatOption,
    MatSelect
],
  templateUrl: './pauta-dialog.component.html',
  styleUrls: ['./pauta-dialog.component.scss'],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
  ]
})

export class PautaDialogComponent implements OnInit {
  form!: FormGroup;
  enviando = false;

  convenios: ConvenioSelectOption[] = [];
  cargandoConvenios: boolean = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly convenioService: ConvenioService,
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
      cant_dias_rectifica: new FormControl({ value: this.data?.cant_dias_rectifica || '', disabled: !this.pautaModificable }, [Validators.min(1), Validators.max(31)]),
      plazo_mes_rectifica: new FormControl({ value: this.data?.plazo_mes_rectifica || '', disabled: !this.pautaModificable }, [Validators.min(0)]),
      tipo_pauta: new FormControl({ value: this.data?.tipo_pauta || '', disabled: !this.pautaModificable }, [Validators.required]),
    });

    this.cargarConvenios();
  }

  guardar(): void {
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

    const payload = this.construirPayload(this.form.value);
    this.enviando = true;
    const request$ = this.data?.convenio_id
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

  get pautaModificable(){
    if(this.data?.modificable !== undefined && this.data?.modificable !== null){
      return this.data?.modificable
    }

    return true;
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
      cant_dias_rectifica: Number(formValue.cant_dias_rectifica ?? 0),
      plazo_mes_rectifica: Number(formValue.plazo_mes_rectifica ?? 0),
      tipo_pauta: normalizarString(formValue.tipo_pauta) ?? '',
      convenio_id: Number(formValue.convenio_id)
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
          this.convenios = convenios ?? []
        },
        error: (error) => {
          console.error('Error obteniendo catálogo de convenio', error);
        },
        complete: () => {
          this.cargandoConvenios = false;
        }
      });
  }
}
