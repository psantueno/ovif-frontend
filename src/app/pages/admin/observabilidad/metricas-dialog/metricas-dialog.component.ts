import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-metricas-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './metricas-dialog.component.html',
  styleUrl: './metricas-dialog.component.scss',
})
export class MetricasDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}
