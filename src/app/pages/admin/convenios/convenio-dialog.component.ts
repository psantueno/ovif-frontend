import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { provideNativeDateAdapter } from '@angular/material/core';

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { Convenio, ConvenioPayload, ConveniosAdminService } from '../../../services/convenios-admin.service';

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
    MatDatepickerModule,
    MatNativeDateModule,
    LoadingOverlayComponent
  ],
  templateUrl: './convenio-dialog.component.html',
  styleUrls: ['./convenio-dialog.component.scss'],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
  ]
})

export class ConvenioDialogComponent implements OnInit {
  form!: FormGroup;
  enviando = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly convenioService: ConveniosAdminService,
    private readonly dialogRef: MatDialogRef<ConvenioDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: Convenio | null
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: new FormControl({ value: this.data?.nombre || '', disabled: !this.convenioModificable}, [Validators.required, Validators.minLength(3), Validators.maxLength(150)]),
      descripcion: new FormControl({ value: this.data?.descripcion || '', disabled: !this.convenioModificable }, [Validators.required, Validators.minLength(3)]),
      fecha_inicio: new FormControl({ value: this.obtenerFecha(this.data?.fecha_inicio || ''), disabled: !this.convenioModificable }, [Validators.required]),
      fecha_fin: new FormControl({ value: this.obtenerFecha(this.data?.fecha_fin || ''), disabled: !this.convenioModificable }, [Validators.required]),
    },
    {
      validators: this.rangoFechasValidator
    });
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
      ? this.convenioService.actualizarConvenio(this.data.convenio_id, payload)
      : this.convenioService.crearConvenio(payload);

    request$
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: () => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: this.data?.convenio_id ? 'Convenio actualizado' : 'Convenio creado',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
            background: '#f0fdf4',
            color: '#14532d'
          });
          this.dialogRef.close(true);
        },
        error: (error) => {
          const message = this.resolveErrorMessage(error, 'No se pudo guardar el convenio.');
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

  obtenerFechaMinima(fecha: Date | null): Date | null{
    if(!fecha) return null;

    const dia = fecha.getDate();
    const mes = fecha.getMonth();
    const anio = fecha.getFullYear();

    return new Date(anio, mes, dia + 1)
  }

  obtenerFechaMaxima(fecha: Date | null): Date | null{
    if(!fecha) return null;

    const dia = fecha.getDate();
    const mes = fecha.getMonth();
    const anio = fecha.getFullYear();

    return new Date(anio, mes, dia - 1)
  }

  get convenioModificable(){
    if(this.data?.modificable !== undefined && this.data?.modificable !== null){
      return this.data?.modificable
    }

    return true;
  }

  private construirPayload(formValue: any): ConvenioPayload {
    const normalizarString = (valor: unknown): string | null => {
      if (valor === null || valor === undefined) {
        return null;
      }
      const limpio = String(valor).trim();
      return limpio.length > 0 ? limpio : null;
    };

    const payload: ConvenioPayload = {
      nombre: normalizarString(formValue.nombre) ?? '',
      descripcion: normalizarString(formValue.descripcion) ?? '',
      fecha_inicio: formValue.fecha_inicio,
      fecha_fin: formValue.fecha_fin
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

  private obtenerFecha(fechaStr: string){
    let fechaValida = null;

    const [dia, mes, anio] = fechaStr.split('/');

    const diaNumerico = Number(dia) ?? null;
    const mesNumerico = Number(mes) ?? null;
    const anioNumerico = Number(anio) ?? null;

    if(diaNumerico && mesNumerico && anioNumerico) fechaValida = new Date(anioNumerico, mesNumerico - 1, diaNumerico);

    return fechaValida;
  }

  private rangoFechasValidator: ValidatorFn = (
    group: AbstractControl
  ): ValidationErrors | null => {
    const inicio = group.get('fecha_inicio')?.value;
    const fin = group.get('fecha_fin')?.value;

    if (!inicio || !fin) {
      return null;
    }

    if (inicio >= fin) {
      return { rangoFechasInvalido: true };
    }

    return null;
  };
}
