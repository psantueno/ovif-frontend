
import { Component, Inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { MatDialogModule } from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatCardModule } from "@angular/material/card";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { MatChip } from "@angular/material/chips";
import { Log } from "../../../services/logs.service";

@Component({
  selector: 'app-log-detail-modal',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatCardModule, MatIconModule, MatChip],
  templateUrl: './log-dialog.component.html',
  styleUrl: './log-dialog.component.scss'
})

export class LogDetailModalComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: Log,
  ) {}

  getMesNombre(mes: number | undefined): string {
    if(!mes) return "";

    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[mes - 1];
  }

  getEstadoColor(estado: string): string {
    switch (estado) {
      case 'OK': return 'green';
      case 'ERROR': return 'red';
      default: return 'gray';
    }
  }
}
