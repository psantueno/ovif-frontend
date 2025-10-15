import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { Usuario } from '../../../services/usuarios.service';

@Component({
  selector: 'app-usuarios-view-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule, MatChipsModule],
  templateUrl: './usuarios-view-dialog.component.html',
  styleUrls: ['./usuarios-view-dialog.component.scss'],
})
export class UsuariosViewDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: Usuario) {}
}
