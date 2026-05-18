import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { finalize } from 'rxjs/operators';

import {
  SolicitudesProrrogaService, SolicitudProrroga, formatearFechaParaBackend, mostrarFecha
} from '../../../../services/solicitudes-prorroga.service';
import { mostrarToastExito, mostrarToastError } from '../../../../core/utils/swal.util';
import { LoadingOverlayComponent } from '../../../../shared/components/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-editar-solicitud-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    LoadingOverlayComponent,
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
  ],
  templateUrl: './editar-solicitud-dialog.component.html',
  styleUrl: './editar-solicitud-dialog.component.scss'
})
export class EditarSolicitudDialogComponent {
  private readonly solicitudesService = inject(SolicitudesProrrogaService);
  private readonly dialogRef = inject(MatDialogRef<EditarSolicitudDialogComponent>);
  private readonly fb = inject(FormBuilder);

  readonly hoy = new Date();
  readonly maxMotivo = 500;
  readonly mostrar = mostrarFecha;
  guardando = false;

  readonly form = this.fb.group({
    fecha_cierre_solicitada: [null as Date | null],
    motivo: ['', Validators.maxLength(this.maxMotivo)],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: SolicitudProrroga) {
    this.form.patchValue({ motivo: data.motivo });
  }

  get motivoLength(): number {
    const v = this.form.get('motivo')?.value;
    return typeof v === 'string' ? v.length : 0;
  }

  guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: { fecha_cierre_solicitada?: string; motivo?: string } = {};
    const fecha: Date | null = this.form.get('fecha_cierre_solicitada')?.value ?? null;
    const motivo: string = this.form.get('motivo')?.value ?? '';

    if (fecha) {
      payload.fecha_cierre_solicitada = formatearFechaParaBackend(fecha);
    }
    if (motivo !== this.data.motivo) {
      payload.motivo = motivo;
    }

    if (Object.keys(payload).length === 0) {
      mostrarToastError('No realizaste ningún cambio.');
      return;
    }

    this.guardando = true;
    this.solicitudesService.editar(this.data.solicitud_id, payload)
      .pipe(finalize(() => this.guardando = false))
      .subscribe({
        next: () => {
          mostrarToastExito('Solicitud actualizada.');
          this.dialogRef.close(true);
        },
        error: (err) => mostrarToastError(err?.error?.error ?? 'No se pudo actualizar.'),
      });
  }
}
