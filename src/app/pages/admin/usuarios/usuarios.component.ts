import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { UsuariosDialogComponent } from './usuarios-dialog.component';
import { RouterModule } from '@angular/router';

export interface Usuario {
  usuario_id?: number;
  usuario: string;
  email: string;
  nombre: string;
  apellido: string;
  activo: boolean;
  municipios?: number[];
}

@Component({
  selector: 'app-usuarios',
  standalone: true, // ✅ ahora es standalone
  imports: [
    CommonModule,
    MatDialogModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatCardModule,
    MatChipsModule,
    RouterModule,
  ],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.scss'],
})
export class UsuariosComponent implements OnInit {
  displayedColumns: string[] = ['usuario', 'email', 'nombre', 'activo', 'acciones'];
  dataSource = new MatTableDataSource<Usuario>([]);

  constructor(private dialog: MatDialog) {}

  ngOnInit(): void {
    this.cargarUsuarios();
  }

  cargarUsuarios() {
    this.dataSource.data = [
      {
        usuario_id: 1,
        usuario: 'jdoe',
        email: 'jdoe@example.com',
        nombre: 'John',
        apellido: 'Doe',
        activo: true,
        municipios: [1, 2],
      },
      {
        usuario_id: 2,
        usuario: 'msmith',
        email: 'msmith@example.com',
        nombre: 'Mary',
        apellido: 'Smith',
        activo: false,
        municipios: [3],
      },
    ];
  }

  abrirDialogCrear() {
    const dialogRef = this.dialog.open(UsuariosDialogComponent, {
      width: '500px',
      data: null,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        console.log('Usuario creado:', result);
        this.cargarUsuarios();
      }
    });
  }

  editarUsuario(usuario: Usuario) {
    const dialogRef = this.dialog.open(UsuariosDialogComponent, {
      width: '500px',
      data: usuario,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        console.log('Usuario editado:', result);
        this.cargarUsuarios();
      }
    });
  }

  deshabilitarUsuario(usuario: Usuario) {
    console.log('Deshabilitando usuario:', usuario);
    usuario.activo = false;
    this.cargarUsuarios();
  }

  resetPassword(usuario: Usuario) {
    console.log('Reseteando contraseña de:', usuario);
  }
}
