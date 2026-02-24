import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { Parametro, ParametroPayload, ParametrosAdminService } from '../../../services/parametros-admin.service';

export type ParametroDialogMode = 'create' | 'edit' | 'view';

export interface ParametroDialogData {
  mode: ParametroDialogMode;
  parametro: Parametro | null;
}

@Component({
  selector: 'app-parametro-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './parametro-dialog.component.html',
  styleUrls: ['./parametro-dialog.component.scss']
})
export class ParametroDialogComponent implements OnInit {
  form!: FormGroup;
  enviando = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly parametrosAdminService: ParametrosAdminService,
    private readonly dialogRef: MatDialogRef<ParametroDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: ParametroDialogData
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      nombre: new FormControl(this.data.parametro?.nombre ?? '', [Validators.required, Validators.minLength(3)]),
      valor: new FormControl(this.data.parametro?.valor ?? '', [Validators.required]),
      descripcion: new FormControl(this.data.parametro?.descripcion ?? ''),
      estado: new FormControl(this.data.parametro?.estado ?? true),
    });

    if (this.isViewMode) {
      this.form.disable();
    }
  }

  guardar(): void {
    if (this.isViewMode) {
      this.dialogRef.close();
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

    const payload = this.buildPayload(this.form.getRawValue());
    this.enviando = true;

    const request$ =
      this.data.mode === 'edit' && this.data.parametro?.parametro_id
        ? this.parametrosAdminService.actualizarParametro(this.data.parametro.parametro_id, payload)
        : this.parametrosAdminService.crearParametro(payload);

    request$
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: () => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: this.data.mode === 'edit' ? 'Parámetro actualizado' : 'Parámetro creado',
            showConfirmButton: false,
            timer: 2200,
            timerProgressBar: true,
            background: '#f0fdf4',
            color: '#14532d'
          });
          this.dialogRef.close(true);
        },
        error: (error) => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: this.resolveErrorMessage(error, 'No se pudo guardar el parámetro'),
            showConfirmButton: false,
            timer: 3500,
            timerProgressBar: true,
            background: '#fee2e2',
            color: '#7f1d1d'
          });
        }
      });
  }

  get isViewMode(): boolean {
    return this.data.mode === 'view';
  }

  get title(): string {
    if (this.data.mode === 'create') return 'Nuevo parámetro';
    if (this.data.mode === 'edit') return 'Editar parámetro';
    return 'Detalle del parámetro';
  }

  get icon(): string {
    if (this.data.mode === 'create') return 'add';
    if (this.data.mode === 'edit') return 'edit';
    return 'visibility';
  }

  get creadorDisplay(): string {
    if (!this.data.parametro) return 'Sin datos';
    return (
      this.data.parametro.creado_por_nombre ||
      this.data.parametro.creado_por_usuario ||
      (this.data.parametro.creado_por ? `Usuario #${this.data.parametro.creado_por}` : 'Sin datos')
    );
  }

  get actualizadoPorDisplay(): string {
    if (!this.data.parametro) return 'Sin datos';
    return (
      this.data.parametro.actualizado_por_nombre ||
      this.data.parametro.actualizado_por_usuario ||
      (this.data.parametro.actualizado_por ? `Usuario #${this.data.parametro.actualizado_por}` : 'Sin datos')
    );
  }

  private buildPayload(formValue: any): ParametroPayload {
    const normalize = (value: unknown): string => String(value ?? '').trim();
    const descripcion = normalize(formValue.descripcion);

    return {
      nombre: normalize(formValue.nombre),
      valor: normalize(formValue.valor),
      descripcion: descripcion.length > 0 ? descripcion : null,
      estado: Boolean(formValue.estado),
    };
  }

  private resolveErrorMessage(error: any, fallback: string): string {
    if (error?.error?.error && typeof error.error.error === 'string') {
      return error.error.error;
    }
    return fallback;
  }
}
