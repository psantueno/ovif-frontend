import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SolicitudProrroga, mostrarFecha, MESES_LABELS } from '../../../../services/solicitudes-prorroga.service';

@Component({
  selector: 'app-detalle-solicitud-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './detalle-solicitud-dialog.component.html',
  styleUrl: './detalle-solicitud-dialog.component.scss'
})
export class DetalleSolicitudDialogComponent {
  readonly meses = MESES_LABELS;
  readonly mostrar = mostrarFecha;

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: SolicitudProrroga) {}
}
