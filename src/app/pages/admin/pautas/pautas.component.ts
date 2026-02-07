import { Component, OnInit, ViewChild, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';

import { AdminNavbarComponent, AdminBreadcrumb } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { ConveniosAdminService, Convenio } from '../../../services/convenios-admin.service';
import { Pauta, PautasAdminService } from '../../../services/pautas-admin.service';
import { PautaService, PautaSelectOption } from '../../../services/pauta.service';
import { PautaDialogComponent } from './pauta-dialog.component';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

type PautaControlValue = PautaSelectOption | string;

@Component({
  selector: 'app-admin-pautas',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
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
    MatAutocompleteModule,
    MatChipsModule,
    MatDividerModule,
    AdminNavbarComponent,
    LoadingOverlayComponent
  ],
  templateUrl: './pautas.component.html',
  styleUrls: ['./pautas.component.scss']
})

export class PautasComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Pautas' }
  ];

  readonly displayedColumns = [
    'pauta_id',
    'descripcion',
    'convenio_nombre',
    'dia_vto',
    'plazo_vto',
    'cant_dias_rectifica',
    'plazo_mes_rectifica',
    'tipo_pauta',
    'acciones'
  ];

  readonly dataSource = new MatTableDataSource<Pauta>([]);
  totalRegistros = 0;
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [10, 25, 50];

  cargandoLista = false;
  cargandoCatalogo = false;
  searchTerm: string | null = null;
  private readonly eliminando = new Set<number>();

  readonly buscadorControl = new FormControl<PautaControlValue>('');
  private readonly pautasSubject = new BehaviorSubject<PautaSelectOption[]>([]);
  readonly filteredPautas$ = combineLatest([
    this.buscadorControl.valueChanges.pipe(startWith('')),
    this.pautasSubject.asObservable()
  ]).pipe(
    map(([value, pautas]) => {
      const filterValue =
        typeof value === 'string'
          ? value.trim().toLowerCase()
          : value?.descripcion?.toLowerCase().trim() ?? '';

      if (!filterValue) {
        return pautas;
      }

      return pautas.filter((pauta) =>
        pauta.descripcion.toLowerCase().includes(filterValue)
      );
    })
  );

  enviando: boolean = false;

  @ViewChild(MatPaginator) paginator?: MatPaginator;

  constructor(
    private readonly pautasAdminService: PautasAdminService,
    private readonly pautaService: PautaService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.cargarCatalogo();
    this.cargarPautas();
  }

  displayPauta(value: PautaControlValue | null): string {
    if (!value) {
      return '';
    }
    return typeof value === 'string' ? value : value.descripcion;
  }

  buscarPautas(): void {
    this.searchTerm = this.extraerTermino(this.buscadorControl.value);
    this.pageIndex = 0;
    this.cargarPautas();
  }

  onPautaSelected(event: MatAutocompleteSelectedEvent): void {
    const pauta = event.option.value as PautaSelectOption | undefined;
    if (!pauta) {
      return;
    }
    this.buscadorControl.setValue(pauta);
    this.buscarPautas();
  }

  limpiarBuscador(): void {
    if (!this.searchTerm && !this.buscadorControl.value) {
      return;
    }
    this.buscadorControl.setValue('');
    this.searchTerm = null;
    this.pageIndex = 0;
    this.cargarPautas();
  }

  cambiarPagina(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarPautas();
  }

  abrirDialogCrear(): void {
    const dialogRef = this.dialog.open(PautaDialogComponent, {
      width: '520px',
      data: null
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      if (resultado) {
        this.cargarPautas();
      }
    });
  }

  abrirDialogEditar(pauta: Pauta): void {
    const dialogRef = this.dialog.open(PautaDialogComponent, {
      width: '520px',
      data: pauta
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      if (resultado) {
        this.cargarPautas();
      }
    });
  }

  eliminarPauta(pauta: Pauta): void {
    if (!pauta?.pauta_id) {
      return;
    }

    if(!pauta?.modificable) {
      Swal.fire({
        title: 'Operación restringida',
        text: `No puedes eliminar la pauta "${pauta.descripcion}". Esta pauta está asociada a otros datos.`,
        icon: 'warning',
        confirmButtonText: 'Cancelar',
        confirmButtonColor: '#6c757d'
      })
      return;
    }

    Swal.fire({
      title: 'Eliminar pauta',
      text: `¿Confirmás eliminar "${pauta.descripcion}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.enviando = true;
      this.eliminando.add(pauta.pauta_id);
      this.pautasAdminService
        .eliminarPauta(pauta.pauta_id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: 'Pauta eliminada correctamente',
              showConfirmButton: false,
              timer: 2500,
              timerProgressBar: true,
              background: '#f0fdf4',
              color: '#14532d'
            });
            this.cargarPautas();
            this.eliminando.delete(pauta.pauta_id);
            this.enviando = false;
          },
          error: (error) => {
            const message = this.resolveErrorMessage(error, 'No se pudo eliminar el convenio.');
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'error',
              title: message,
              showConfirmButton: false,
              timer: 2500,
              timerProgressBar: true,
              background: '#fee2e2',
              color: '#7f1d1d'
            });
            this.eliminando.delete(pauta.pauta_id);
            this.enviando = false;
          }
        });
    });
  }

  estaEliminando(id: number): boolean {
    return this.eliminando.has(id);
  }

  private cargarCatalogo(): void {
    this.cargandoCatalogo = true;
    this.pautaService
      .getCatalogoPautas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (pautas) => {
          this.pautasSubject.next(pautas ?? []);
        },
        error: (error) => {
          console.error('Error obteniendo catálogo de pautas', error);
        },
        complete: () => {
          this.cargandoCatalogo = false;
        }
      });
  }

  private cargarPautas(): void {
    this.cargandoLista = true;
    const params = {
      pagina: this.pageIndex + 1,
      limite: this.pageSize,
      search: this.searchTerm
    };

    this.pautasAdminService
      .listarPautas(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const datos = Array.isArray(response?.data) ? response.data : [];
          if (datos.length === 0 && (response?.total ?? 0) > 0 && this.pageIndex > 0) {
            this.pageIndex = Math.max(this.pageIndex - 1, 0);
            this.cargandoLista = false;
            this.cargarPautas();
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
          if (this.paginator) {
            this.paginator.pageIndex = this.pageIndex;
          }
        },
        error: (error) => {
          const message = this.resolveErrorMessage(error, 'No se pudieron obtener las pautas.');
          Swal.fire({
            icon: 'error',
            title: 'Error al cargar',
            text: message,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
          });
        },
        complete: () => {
          this.cargandoLista = false;
        }
      });
  }

  private extraerTermino(value: PautaControlValue | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const termino = typeof value === 'string' ? value : value.descripcion;
    const clean = termino.trim();
    return clean.length > 0 ? clean : null;
  }

  private resolveErrorMessage(error: any, fallback: string): string {
    if (error?.error) {
      const err = error.error.error;
      if (typeof err === 'string' && err.trim().length > 0) {
        return err;
      }
      if (typeof err?.message === 'string' && err.message.trim().length > 0) {
        return err.message;
      }
    }
    if (typeof error?.message === 'string' && error.message.trim().length > 0) {
      return error.message;
    }
    return fallback;
  }
}
