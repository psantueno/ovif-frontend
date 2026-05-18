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
  selector: 'app-rechazar-solicitud-dialog',
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
  templateUrl: './rechazar-solicitud-dialog.component.html',
  styleUrl: './rechazar-solicitud-dialog.component.scss',
})
export class RechazarSolicitudDialogComponent {
  private readonly solicitudesService = inject(SolicitudesProrrogaService);
  private readonly dialogRef = inject(MatDialogRef<RechazarSolicitudDialogComponent>);
  private readonly fb = inject(FormBuilder);

  rechazando = false;

  readonly form = this.fb.group({
    comentario_resolucion: ['', [Validators.required, Validators.maxLength(1000)]],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: SolicitudProrroga) {}

  rechazar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const motivo: string = this.form.get('comentario_resolucion')?.value ?? '';
    this.rechazando = true;

    this.solicitudesService.rechazar(this.data.solicitud_id, motivo)
      .pipe(finalize(() => this.rechazando = false))
      .subscribe({
        next: () => {
          mostrarToastExito('Solicitud rechazada.');
          this.dialogRef.close(true);
        },
        error: (err) => mostrarToastError(err?.error?.error ?? 'No se pudo rechazar la solicitud.'),
      });
  }
}
