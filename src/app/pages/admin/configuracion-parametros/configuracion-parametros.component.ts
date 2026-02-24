import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { FormsModule } from '@angular/forms';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import Swal from 'sweetalert2';

import { AdminNavbarComponent, AdminBreadcrumb } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { Parametro, ParametrosAdminService } from '../../../services/parametros-admin.service';
import { ParametroDialogComponent, ParametroDialogData } from './parametro-dialog.component';

@Component({
  selector: 'app-configuracion-parametros',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatChipsModule,
    MatSlideToggleModule,
    AdminNavbarComponent
  ],
  templateUrl: './configuracion-parametros.component.html',
  styleUrls: ['./configuracion-parametros.component.scss']
})
export class ConfiguracionParametrosComponent implements OnInit {
  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Configuración de Parametros' }
  ];

  readonly displayedColumns = ['parametro_id', 'nombre', 'valor', 'descripcion', 'estado', 'acciones'];
  readonly dataSource = new MatTableDataSource<Parametro>([]);

  totalRegistros = 0;
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [10, 25, 50];

  searchTerm = '';
  cargandoLista = false;
  private readonly cambiandoEstado = new Set<number>();

  constructor(
    private readonly dialog: MatDialog,
    private readonly parametrosAdminService: ParametrosAdminService
  ) {}

  ngOnInit(): void {
    this.cargarParametros();
  }

  buscarParametros(): void {
    this.pageIndex = 0;
    this.cargarParametros();
  }

  limpiarBuscador(): void {
    if (!this.searchTerm.trim()) return;
    this.searchTerm = '';
    this.pageIndex = 0;
    this.cargarParametros();
  }

  cambiarPagina(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarParametros();
  }

  abrirDialogCrear(): void {
    this.abrirDialog({ mode: 'create', parametro: null });
  }

  verParametro(parametro: Parametro): void {
    this.parametrosAdminService.getParametroById(parametro.parametro_id).subscribe({
      next: (detalle) => {
        this.abrirDialog({ mode: 'view', parametro: detalle });
      },
      error: (error) => {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: this.resolveErrorMessage(error, 'No se pudo cargar el detalle del parámetro'),
          showConfirmButton: false,
          timer: 3000,
          timerProgressBar: true,
          background: '#fee2e2',
          color: '#7f1d1d'
        });
      }
    });
  }

  editarParametro(parametro: Parametro): void {
    this.abrirDialog({ mode: 'edit', parametro });
  }

  cambiarEstado(parametro: Parametro, event: MatSlideToggleChange): void {
    const estadoNuevo = event.checked;
    const accion = estadoNuevo ? 'activar' : 'desactivar';

    Swal.fire({
      title: `¿Confirmás ${accion}?`,
      text: `Vas a ${accion} el parámetro "${parametro.nombre}".`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: `Sí, ${accion}`,
      cancelButtonText: 'Cancelar',
      confirmButtonColor: estadoNuevo ? '#2b3e4c' : '#d33',
      cancelButtonColor: '#6c757d',
      reverseButtons: true
    }).then((result) => {
      if (!result.isConfirmed) {
        event.source.checked = !estadoNuevo;
        return;
      }

      this.cambiandoEstado.add(parametro.parametro_id);
      this.parametrosAdminService.actualizarEstadoParametro(parametro.parametro_id, estadoNuevo).subscribe({
        next: () => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: `Parámetro ${estadoNuevo ? 'activado' : 'desactivado'} correctamente`,
            showConfirmButton: false,
            timer: 2200,
            timerProgressBar: true,
            background: '#f0fdf4',
            color: '#14532d'
          });
          this.cargarParametros();
          this.cambiandoEstado.delete(parametro.parametro_id);
        },
        error: (error) => {
          this.cambiandoEstado.delete(parametro.parametro_id);
          event.source.checked = !estadoNuevo;
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: this.resolveErrorMessage(error, 'No se pudo actualizar el estado'),
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: '#fee2e2',
            color: '#7f1d1d'
          });
        }
      });
    });
  }

  estadoEnCambio(parametroId: number): boolean {
    return this.cambiandoEstado.has(parametroId);
  }

  private abrirDialog(data: ParametroDialogData): void {
    const dialogRef = this.dialog.open(ParametroDialogComponent, {
      width: '560px',
      data
    });

    dialogRef.afterClosed().subscribe((updated) => {
      if (updated) this.cargarParametros();
    });
  }

  private cargarParametros(): void {
    this.cargandoLista = true;

    this.parametrosAdminService
      .listarParametros({
        pagina: this.pageIndex + 1,
        limite: this.pageSize,
        search: this.searchTerm.trim() || null
      })
      .subscribe({
        next: (response) => {
          this.dataSource.data = response.data;
          this.totalRegistros = response.total;
        },
        error: (error) => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: this.resolveErrorMessage(error, 'No se pudieron cargar los parámetros'),
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: '#fee2e2',
            color: '#7f1d1d'
          });
        },
        complete: () => {
          this.cargandoLista = false;
        }
      });
  }

  private resolveErrorMessage(error: any, fallback: string): string {
    if (error?.error) {
      const err = error.error.error;
      if (typeof err === 'string' && err.trim().length > 0) return err;
    }
    return fallback;
  }
}
