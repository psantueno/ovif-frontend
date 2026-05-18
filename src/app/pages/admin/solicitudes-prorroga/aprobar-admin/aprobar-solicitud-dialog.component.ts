import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
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
  SolicitudesProrrogaService, SolicitudProrroga,
  formatearFechaParaBackend, mostrarFecha
} from '../../../../services/solicitudes-prorroga.service';
import { mostrarToastExito, mostrarToastError } from '../../../../core/utils/swal.util';
import { LoadingOverlayComponent } from '../../../../shared/components/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-aprobar-solicitud-dialog',
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
  templateUrl: './aprobar-solicitud-dialog.component.html',
  styleUrl: './aprobar-solicitud-dialog.component.scss'
})
export class AprobarSolicitudDialogComponent {
  private readonly solicitudesService = inject(SolicitudesProrrogaService);
  private readonly dialogRef = inject(MatDialogRef<AprobarSolicitudDialogComponent>);
  private readonly fb = inject(FormBuilder);

  readonly hoy = new Date();
  readonly mostrar = mostrarFecha;
  aprobando = false;

  get fechaSolicitadaVencida(): boolean {
    const fecha = this.data.fecha_cierre_solicitada;
    if (!fecha) return false;
    return new Date(fecha) < this.hoy;
  }

  readonly form = this.fb.group({
    fecha_cierre_aprobada: [null as Date | null],
    comentario_resolucion: [''],
  });

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: SolicitudProrroga) {
    if (this.fechaSolicitadaVencida) {
      this.form.get('fecha_cierre_aprobada')?.setValidators(require => require.value ? null : { required: true });
      this.form.get('fecha_cierre_aprobada')?.updateValueAndValidity();
    }
  }

  aprobar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: { fecha_cierre_aprobada?: string; comentario_resolucion?: string } = {};
    const fecha: Date | null = this.form.get('fecha_cierre_aprobada')?.value ?? null;
    const comentario: string = this.form.get('comentario_resolucion')?.value ?? '';

    if (fecha) payload.fecha_cierre_aprobada = formatearFechaParaBackend(fecha);
    if (comentario.trim()) payload.comentario_resolucion = comentario.trim();

    this.aprobando = true;
    this.solicitudesService.aprobar(this.data.solicitud_id, payload)
      .pipe(finalize(() => this.aprobando = false))
      .subscribe({
        next: () => {
          mostrarToastExito('Solicitud aprobada correctamente.');
          this.dialogRef.close(true);
        },
        error: (err) => mostrarToastError(err?.error?.error ?? 'No se pudo aprobar la solicitud.'),
      });
  }
}
