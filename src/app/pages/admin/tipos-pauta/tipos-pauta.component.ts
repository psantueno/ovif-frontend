import { Component, DestroyRef, OnInit, inject } from '@angular/core';
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
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { resolveErrorMessage } from '../../../core/utils/error.util';
import { confirmarEliminacion, mostrarToastExito, mostrarToastError } from '../../../core/utils/swal.util';

import { AdminBreadcrumb, AdminNavbarComponent } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { TipoPauta, TiposPautaAdminService } from '../../../services/tipos-pauta-admin.service';
import { TipoPautaDialogComponent, TipoPautaDialogData } from './tipo-pauta-dialog.component';

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
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Tipos de pauta' }
  ];

  readonly displayedColumns = ['tipo_pauta_id', 'codigo', 'nombre', 'requiere_periodo_rectificar', 'acciones'];
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
    if (!this.searchTerm) return;
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
    const dialogRef = this.dialog.open<TipoPautaDialogComponent, TipoPautaDialogData>(TipoPautaDialogComponent, {
      width: '560px',
      data: {
        mode: 'create',
        tipoPauta: null
      }
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((updated) => {
      if (updated) this.cargarTiposPauta();
    });
  }

  abrirDialogEditar(tipoPauta: TipoPauta): void {
    const dialogRef = this.dialog.open<TipoPautaDialogComponent, TipoPautaDialogData>(TipoPautaDialogComponent, {
      width: '560px',
      data: {
        mode: 'edit',
        tipoPauta
      }
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((updated) => {
      if (updated) this.cargarTiposPauta();
    });
  }

  abrirDialogVer(tipoPauta: TipoPauta): void {
    this.dialog.open<TipoPautaDialogComponent, TipoPautaDialogData>(TipoPautaDialogComponent, {
      width: '560px',
      data: {
        mode: 'view',
        tipoPauta
      }
    });
  }

  eliminarTipoPauta(tipoPauta: TipoPauta): void {
    if (!tipoPauta?.tipo_pauta_id) return;

    confirmarEliminacion(
      'Eliminar tipo de pauta',
      `¿Confirmás eliminar "${tipoPauta.nombre}"? Esta acción no se puede deshacer.`
    ).then((result) => {
      if (!result.isConfirmed) return;

      this.eliminando.add(tipoPauta.tipo_pauta_id);
      this.tiposPautaAdminService.eliminarTipoPauta(tipoPauta.tipo_pauta_id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            mostrarToastExito('Tipo de pauta eliminado correctamente');
            this.cargarTiposPauta();
            this.eliminando.delete(tipoPauta.tipo_pauta_id);
          },
          error: (error) => {
            this.eliminando.delete(tipoPauta.tipo_pauta_id);
            mostrarToastError(resolveErrorMessage(error, 'No se pudo eliminar el tipo de pauta'));
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
      .pipe(
        finalize(() => {
          this.cargandoLista = false;
        })
      )
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
          mostrarToastError(resolveErrorMessage(error, 'No se pudieron cargar los tipos de pauta'));
        }
      });
  }
}
