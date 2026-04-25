import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { resolveErrorMessage } from '../../../core/utils/error.util';
import { mostrarToastExito, mostrarToastError } from '../../../core/utils/swal.util';

import { Municipio, MunicipioPayload, MunicipiosAdminService } from '../../../services/municipios-admin.service';

import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

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
    MatIconModule,
    LoadingOverlayComponent
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
      municipio_nombre: new FormControl({ value: this.data?.municipio_nombre || '', disabled: !this.municipioModificable}, [Validators.required, Validators.minLength(3)]),
      municipio_spar: new FormControl(
        { value: this.toIntegerOrNull(this.data?.municipio_spar), disabled: !this.municipioModificable },
        [Validators.required, Validators.pattern(/^-?(0|[1-9]\d*)$/)]
      ),
      municipio_ubge: new FormControl(
        { value: this.toIntegerOrNull(this.data?.municipio_ubge), disabled: !this.municipioModificable },
        [Validators.required, Validators.pattern(/^-?(0|[1-9]\d*)$/)]
      ),
      municipio_subir_archivos: new FormControl({ value: this.data?.municipio_subir_archivos ?? false, disabled: !this.municipioModificable }),
      municipio_poblacion: new FormControl(
        { value: this.data?.municipio_poblacion ?? null, disabled: !this.municipioModificable },
        [Validators.required, Validators.min(0)]
      )
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
    const request$ = this.data?.municipio_id
      ? this.municipiosService.actualizarMunicipio(this.data.municipio_id, payload)
      : this.municipiosService.crearMunicipio(payload);

    request$
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: () => {
          mostrarToastExito(this.data?.municipio_id ? 'Municipio actualizado' : 'Municipio creado');
          this.dialogRef.close(true);
        },
        error: (error) => {
          mostrarToastError(resolveErrorMessage(error, 'No se pudo guardar el municipio.'));
        }
      });
  }

  get municipioModificable(){
    if(this.data?.modificable !== undefined && this.data?.modificable !== null){
      return this.data?.modificable
    }

    return true;
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
      municipio_spar: this.toInteger(formValue.municipio_spar),
      municipio_ubge: this.toInteger(formValue.municipio_ubge),
      municipio_subir_archivos: !!formValue.municipio_subir_archivos,
      municipio_poblacion: this.toNumber(formValue.municipio_poblacion)
    };

    return payload;
  }

  private toNumber(valor: unknown): number {
    const parsed = Number(valor);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toIntegerOrNull(valor: unknown): number | null {
    if (valor === null || valor === undefined) {
      return null;
    }
    const parsed = Number(valor);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return Math.trunc(parsed);
  }

  private toInteger(valor: unknown): number {
    const parsed = Number(valor);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.trunc(parsed);
  }
}
