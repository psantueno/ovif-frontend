import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import Swal from 'sweetalert2';

import { AdminBreadcrumb, AdminNavbarComponent } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { TipoPauta, TiposPautaAdminService } from '../../../services/tipos-pauta-admin.service';
import { TipoPautaDialogComponent } from './tipo-pauta-dialog.component';

@Component({
  selector: 'app-tipos-pauta',
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
    AdminNavbarComponent
  ],
  templateUrl: './tipos-pauta.component.html',
  styleUrls: ['./tipos-pauta.component.scss']
})
export class TiposPautaComponent implements OnInit {
  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Tipos de pauta' }
  ];

  readonly displayedColumns = ['tipo_pauta_id', 'codigo', 'nombre', 'descripcion', 'requiere_periodo_rectificar', 'acciones'];
  readonly dataSource = new MatTableDataSource<TipoPauta>([]);

  totalRegistros = 0;
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [10, 25, 50];

  searchTerm = '';
  cargandoLista = false;
  private readonly eliminando = new Set<number>();

  constructor(
    private readonly dialog: MatDialog,
    private readonly tiposPautaAdminService: TiposPautaAdminService
  ) {}

  ngOnInit(): void {
    this.cargarTiposPauta();
  }

  buscarTiposPauta(): void {
    this.pageIndex = 0;
    this.cargarTiposPauta();
  }

  limpiarBuscador(): void {
    if (!this.searchTerm.trim()) return;
    this.searchTerm = '';
    this.pageIndex = 0;
    this.cargarTiposPauta();
  }

  cambiarPagina(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarTiposPauta();
  }

  abrirDialogCrear(): void {
    const dialogRef = this.dialog.open(TipoPautaDialogComponent, {
      width: '560px',
      data: null
    });

    dialogRef.afterClosed().subscribe((updated) => {
      if (updated) this.cargarTiposPauta();
    });
  }

  abrirDialogEditar(tipoPauta: TipoPauta): void {
    const dialogRef = this.dialog.open(TipoPautaDialogComponent, {
      width: '560px',
      data: tipoPauta
    });

    dialogRef.afterClosed().subscribe((updated) => {
      if (updated) this.cargarTiposPauta();
    });
  }

  eliminarTipoPauta(tipoPauta: TipoPauta): void {
    if (!tipoPauta?.tipo_pauta_id) return;

    Swal.fire({
      title: 'Eliminar tipo de pauta',
      text: `¿Confirmás eliminar "${tipoPauta.nombre}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.eliminando.add(tipoPauta.tipo_pauta_id);
      this.tiposPautaAdminService.eliminarTipoPauta(tipoPauta.tipo_pauta_id).subscribe({
        next: () => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Tipo de pauta eliminado correctamente',
            showConfirmButton: false,
            timer: 2200,
            timerProgressBar: true,
            background: '#f0fdf4',
            color: '#14532d'
          });
          this.cargarTiposPauta();
          this.eliminando.delete(tipoPauta.tipo_pauta_id);
        },
        error: (error) => {
          this.eliminando.delete(tipoPauta.tipo_pauta_id);
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: this.resolveErrorMessage(error, 'No se pudo eliminar el tipo de pauta'),
            showConfirmButton: false,
            timer: 3500,
            timerProgressBar: true,
            background: '#fee2e2',
            color: '#7f1d1d'
          });
        }
      });
    });
  }

  estaEliminando(tipoPautaId: number): boolean {
    return this.eliminando.has(tipoPautaId);
  }

  private cargarTiposPauta(): void {
    this.cargandoLista = true;
    this.tiposPautaAdminService
      .listarTiposPauta({
        pagina: this.pageIndex + 1,
        limite: this.pageSize,
        search: this.searchTerm.trim() || null
      })
      .subscribe({
        next: (response) => {
          const datos = Array.isArray(response?.data) ? response.data : [];
          if (datos.length === 0 && (response?.total ?? 0) > 0 && this.pageIndex > 0) {
            this.pageIndex = Math.max(this.pageIndex - 1, 0);
            this.cargandoLista = false;
            this.cargarTiposPauta();
            return;
          }
          this.dataSource.data = datos;
          this.totalRegistros = Number(response?.total) || datos.length;
          const limite = Number(response?.limite);
          this.pageSize = Number.isFinite(limite) && limite > 0 ? limite : this.pageSize;
          const pagina = Number(response?.pagina);
          if (Number.isFinite(pagina) && pagina > 0) {
            this.pageIndex = pagina - 1;
          }
        },
        error: (error) => {
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'error',
            title: this.resolveErrorMessage(error, 'No se pudieron cargar los tipos de pauta'),
            showConfirmButton: false,
            timer: 3500,
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
      if (typeof err === 'string' && err.trim().length > 0) {
        return err;
      }
    }
    return fallback;
  }
}
