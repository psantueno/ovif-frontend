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

import { TipoPauta, TipoPautaPayload, TiposPautaAdminService } from '../../../services/tipos-pauta-admin.service';

@Component({
  selector: 'app-tipo-pauta-dialog',
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
  templateUrl: './tipo-pauta-dialog.component.html',
  styleUrls: ['./tipo-pauta-dialog.component.scss']
})
export class TipoPautaDialogComponent implements OnInit {
  form!: FormGroup;
  enviando = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly tiposPautaAdminService: TiposPautaAdminService,
    private readonly dialogRef: MatDialogRef<TipoPautaDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: TipoPauta | null
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      codigo: new FormControl(this.data?.codigo ?? '', [
        Validators.required,
        Validators.maxLength(100),
        Validators.pattern(/^[a-z0-9_]+$/)
      ]),
      nombre: new FormControl(this.data?.nombre ?? '', [Validators.required, Validators.maxLength(150)]),
      descripcion: new FormControl(this.data?.descripcion ?? '', [Validators.maxLength(1000)]),
      requiere_periodo_rectificar: new FormControl(this.data?.requiere_periodo_rectificar ?? false),
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

    const payload = this.buildPayload(this.form.getRawValue());
    this.enviando = true;

    const request$ = this.data?.tipo_pauta_id
      ? this.tiposPautaAdminService.actualizarTipoPauta(this.data.tipo_pauta_id, payload)
      : this.tiposPautaAdminService.crearTipoPauta(payload);

    request$
      .pipe(finalize(() => (this.enviando = false)))
      .subscribe({
        next: () => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: this.data?.tipo_pauta_id ? 'Tipo de pauta actualizado' : 'Tipo de pauta creado',
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
            title: this.resolveErrorMessage(error, 'No se pudo guardar el tipo de pauta'),
            showConfirmButton: false,
            timer: 3500,
            timerProgressBar: true,
            background: '#fee2e2',
            color: '#7f1d1d'
          });
        }
      });
  }

  private buildPayload(formValue: any): TipoPautaPayload {
    const codigo = String(formValue.codigo ?? '').trim();
    const descripcion = String(formValue.descripcion ?? '').trim();
    return {
      codigo,
      nombre: String(formValue.nombre ?? '').trim(),
      descripcion: descripcion.length > 0 ? descripcion : null,
      requiere_periodo_rectificar: Boolean(formValue.requiere_periodo_rectificar),
    };
  }

  private resolveErrorMessage(error: any, fallback: string): string {
    if (error?.error?.error && typeof error.error.error === 'string') {
      return error.error.error;
    }
    return fallback;
  }
}
