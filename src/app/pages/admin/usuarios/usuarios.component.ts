import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { RouterModule } from '@angular/router';
import { UsuariosDialogComponent } from './usuarios-dialog.component';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';

// services
import { UsuariosService } from '../../../services/usuarios.service';

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
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatDialogModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatCardModule,
    MatChipsModule,
    ReactiveFormsModule,
    MatPaginatorModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.scss'],
})
export class UsuariosComponent implements OnInit {
  displayedColumns: string[] = ['usuario', 'email', 'nombre', 'activo', 'acciones'];
  dataSource = new MatTableDataSource<Usuario>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  totalRegistros: number = 0;

  pagina: number = 0;
  limite: number = 10;
  busquedaEjecutada: boolean = false;

  filtroForm: FormGroup;

  municipios: any[] = [];
  roles: any[] = [];

  constructor(
    private dialog: MatDialog,
    private fb: FormBuilder,
    private usuariosService: UsuariosService
  ) {
    this.filtroForm = this.fb.group({
      search: [''],
      municipio: [''],
      rol: ['']
    });
  }

  ngOnInit(): void {
    this.cargarMunicipios();
    this.cargarRoles();
  }

  cargarUsuarios() {
    const filtros = this.filtroForm.value;

    this.usuariosService.getUsuarios({
      pagina: (this.pagina + 1).toString(),
      limite: this.limite.toString(),
      search: filtros.search || '',
      municipio: filtros.municipio || '',
      rol: filtros.rol || ''
    }).subscribe((res: any) => {
      this.busquedaEjecutada = true;
      this.dataSource.data = res.data;
      this.totalRegistros = res.total;
      if (this.paginator) {
        this.paginator.pageIndex = this.pagina;
      }
    });
  }

  aplicarFiltros() {
    this.pagina = 0;
    if (this.paginator) {
      this.paginator.firstPage();
    }
    this.cargarUsuarios();
  }

  cambiarPagina(event: PageEvent) {
    this.pagina = event.pageIndex;
    this.limite = event.pageSize;
    this.cargarUsuarios();
  }

  cargarMunicipios() {
    this.usuariosService.getMunicipios().subscribe((res) => {
      this.municipios = res;
    });
  }

  cargarRoles() {
    this.usuariosService.getRoles().subscribe((res) => {
      this.roles = res;
    });
  }

  abrirDialogCrear() {
    const dialogRef = this.dialog.open(UsuariosDialogComponent, {
      width: '500px',
      data: null,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.cargarUsuarios();
    });
  }

  editarUsuario(usuario: Usuario) {
    const dialogRef = this.dialog.open(UsuariosDialogComponent, {
      width: '500px',
      data: usuario,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) this.cargarUsuarios();
    });
  }

  deshabilitarUsuario(usuario: Usuario) {
    usuario.activo = false;
    this.cargarUsuarios();
  }

  resetPassword(usuario: Usuario) {
    console.log('Reseteando contraseña de:', usuario);
  }
}
