import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs/operators';

import { SolicitudesProrrogaService, SolicitudProrroga } from '../../../../services/solicitudes-prorroga.service';
import { mostrarToastExito, mostrarToastError } from '../../../../core/utils/swal.util';
import { LoadingOverlayComponent } from '../../../../shared/components/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-cancelar-solicitud-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    LoadingOverlayComponent,
  ],
  templateUrl: './cancelar-solicitud-dialog.component.html',
  styleUrl: './cancelar-solicitud-dialog.component.scss'
})
export class CancelarSolicitudDialogComponent {
  private readonly solicitudesService = inject(SolicitudesProrrogaService);
  private readonly dialogRef = inject(MatDialogRef<CancelarSolicitudDialogComponent>);
  private readonly fb = inject(FormBuilder);

  cancelando = false;

  readonly form = this.fb.group({
    motivo_cancelacion: ['', [Validators.required, Validators.maxLength(500)]],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: SolicitudProrroga) {}

  cancelar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const motivo: string = this.form.get('motivo_cancelacion')?.value ?? '';
    this.cancelando = true;

    this.solicitudesService.cancelar(this.data.solicitud_id, motivo)
      .pipe(finalize(() => this.cancelando = false))
      .subscribe({
        next: () => {
          mostrarToastExito('Solicitud cancelada.');
          this.dialogRef.close(true);
        },
        error: (err) => mostrarToastError(err?.error?.error ?? 'No se pudo cancelar la solicitud.'),
      });
  }
}
