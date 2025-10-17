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
import { UsuariosViewDialogComponent } from './usuarios-view-dialog.component';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import Swal from 'sweetalert2';

// services
import { UsuariosService } from '../../../services/usuarios.service';
import { AdminNavbarComponent, AdminBreadcrumb } from '../../../shared/components/admin-navbar/admin-navbar.component';

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
    MatInputModule,
    AdminNavbarComponent
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

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Usuarios' }
  ];

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

  verUsuario(usuario: Usuario) {
    this.dialog.open(UsuariosViewDialogComponent, {
      width: '480px',
      data: usuario,
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

  cambiarEstadoUsuario(usuario: Usuario) {
    const accion = usuario.activo ? 'deshabilitar' : 'habilitar';
    const color = usuario.activo ? '#d33' : '#89B968'; // rojo si deshabilita, azul si habilita

    Swal.fire({
      title: `¿Confirmas ${accion}?`,
      text: `Vas a ${accion} al usuario "${usuario.usuario}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: color,
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        this.usuariosService.toggleUsuarioActivo(usuario.usuario_id!).subscribe({
          next: (res) => {
            // ✅ TOAST de éxito arriba a la derecha
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: res.message,
              showConfirmButton: false,
              timer: 2500,
              timerProgressBar: true,
              background: '#f0fdf4', // suave verde claro
              color: '#14532d',      // verde oscuro para el texto
            });

            this.cargarUsuarios();
          },
          error: (err) => {
            console.error('❌ Error cambiando estado:', err);

            // ❌ TOAST de error
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'error',
              title: 'Error al cambiar el estado del usuario',
              showConfirmButton: false,
              timer: 2500,
              timerProgressBar: true,
              background: '#fee2e2', // rojo claro
              color: '#7f1d1d',      // rojo oscuro texto
            });
          },
        });
      }
    });
  }

  eliminarUsuario(usuario: Usuario) {
    Swal.fire({
      title: `¿Eliminar usuario "${usuario.usuario}"?`,
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33", // rojo
      cancelButtonColor: "#6c757d",
      reverseButtons: true,
    }).then((result) => {
      if (result.isConfirmed) {
        this.usuariosService.deleteUsuario(usuario.usuario_id!).subscribe({
          next: (res) => {
            // ✅ Éxito
            Swal.fire({
              toast: true,
              position: "top-end",
              icon: "success",
              title: res.message || "Usuario eliminado correctamente",
              showConfirmButton: false,
              timer: 2500,
              timerProgressBar: true,
              background: "#f0fdf4",
              color: "#14532d",
            });
            this.cargarUsuarios();
          },
          error: (err) => {
            console.error("❌ Error eliminando usuario:", err);

            // ⚠️ Caso controlado: tiene auditorías
            if (err.error?.code === "USER_HAS_AUDIT_LOGS") {
              Swal.fire({
                icon: "info",
                title: "No se puede eliminar",
                text: "Este usuario tiene registros de auditoría y no puede eliminarse.",
                confirmButtonColor: "#2b3e4c",
              });
              return;
            }

            // ⚠️ Caso genérico o inesperado
            Swal.fire({
              toast: true,
              position: "top-end",
              icon: "error",
              title:
                err.error?.error ||
                "Error al eliminar el usuario. Intenta nuevamente.",
              showConfirmButton: false,
              timer: 2500,
              timerProgressBar: true,
              background: "#fee2e2",
              color: "#7f1d1d",
            });
          },
        });
      }
    });
  }



}
