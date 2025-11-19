import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { Municipio, MunicipioPayload, MunicipiosAdminService } from '../../../services/municipios-admin.service';

@Component({
  selector: 'app-municipio-dialog',
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
  templateUrl: './municipio-dialog.component.html',
  styleUrls: ['./municipio-dialog.component.scss']
})
export class MunicipioDialogComponent implements OnInit {
  form!: FormGroup;
  enviando = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly municipiosService: MunicipiosAdminService,
    private readonly dialogRef: MatDialogRef<MunicipioDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: Municipio | null
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      municipio_nombre: [this.data?.municipio_nombre || '', [Validators.required, Validators.minLength(3)]],
      municipio_usuario: [this.data?.municipio_usuario || '', [Validators.required, Validators.minLength(3)]],
      municipio_password: [''],
      municipio_spar: [this.data?.municipio_spar ?? false],
      municipio_ubge: [this.data?.municipio_ubge ?? false],
      municipio_subir_archivos: [this.data?.municipio_subir_archivos ?? false],
      municipio_poblacion: [
        this.data?.municipio_poblacion ?? null,
        [Validators.required, Validators.min(0)]
      ]
    });

    if (!this.data?.municipio_id) {
      this.form
        .get('municipio_password')
        ?.setValidators([Validators.required, Validators.minLength(6)]);
    }

    this.form.get('municipio_password')?.updateValueAndValidity();
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
    const request$ = this.data?.municipio_id
      ? this.municipiosService.actualizarMunicipio(this.data.municipio_id, payload)
      : this.municipiosService.crearMunicipio(payload);

    request$
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: () => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: this.data?.municipio_id ? 'Municipio actualizado' : 'Municipio creado',
            showConfirmButton: false,
            timer: 1800
          });
          this.dialogRef.close(true);
        },
        error: (error) => {
          const message = this.resolveErrorMessage(error, 'No se pudo guardar el municipio.');
          Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: message,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
          });
        }
      });
  }

  private construirPayload(formValue: any): MunicipioPayload {
    const normalizarString = (valor: unknown): string | null => {
      if (valor === null || valor === undefined) {
        return null;
      }
      const limpio = String(valor).trim();
      return limpio.length > 0 ? limpio : null;
    };

    const payload: MunicipioPayload = {
      municipio_nombre: normalizarString(formValue.municipio_nombre) ?? '',
      municipio_usuario: normalizarString(formValue.municipio_usuario) ?? '',
      municipio_spar: !!formValue.municipio_spar,
      municipio_ubge: !!formValue.municipio_ubge,
      municipio_subir_archivos: !!formValue.municipio_subir_archivos,
      municipio_poblacion: this.toNumber(formValue.municipio_poblacion)
    };

    const password = normalizarString(formValue.municipio_password);
    if (password) {
      payload.municipio_password = password;
    } else if (!this.data?.municipio_id) {
      payload.municipio_password = '';
    }

    return payload;
  }

  private toNumber(valor: unknown): number {
    const parsed = Number(valor);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private resolveErrorMessage(error: any, fallback: string): string {
    if (error?.error) {
      const err = error.error;
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
}
