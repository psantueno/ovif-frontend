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
import { ConvenioService, ConvenioSelectOption } from '../../../services/convenio.service';
import { ConvenioDialogComponent } from './convenio-dialog.component';

import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

type ConvenioControlValue = ConvenioSelectOption | string;

@Component({
  selector: 'app-admin-convenios',
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
  templateUrl: './convenios.component.html',
  styleUrls: ['./convenios.component.scss']
})

export class ConveniosComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Convenios' }
  ];

  readonly displayedColumns = [
    'convenio_id',
    'nombre',
    'descripcion',
    'fecha_inicio',
    'fecha_fin',
    'acciones'
  ];

  readonly dataSource = new MatTableDataSource<Convenio>([]);
  totalRegistros = 0;
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [10, 25, 50];

  cargandoLista = false;
  cargandoCatalogo = false;
  searchTerm: string | null = null;
  private readonly eliminando = new Set<number>();

  readonly buscadorControl = new FormControl<ConvenioControlValue>('');
  private readonly conveniosSubject = new BehaviorSubject<ConvenioSelectOption[]>([]);
  readonly filteredConvenios$ = combineLatest([
    this.buscadorControl.valueChanges.pipe(startWith('')),
    this.conveniosSubject.asObservable()
  ]).pipe(
    map(([value, convenios]) => {
      const filterValue =
        typeof value === 'string'
          ? value.trim().toLowerCase()
          : value?.nombre?.toLowerCase().trim() ?? '';

      if (!filterValue) {
        return convenios;
      }

      return convenios.filter((convenio) =>
        convenio.nombre.toLowerCase().includes(filterValue)
      );
    })
  );

  enviando: boolean = false;

  @ViewChild(MatPaginator) paginator?: MatPaginator;

  constructor(
    private readonly conveniosAdminService: ConveniosAdminService,
    private readonly convenioService: ConvenioService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.cargarCatalogo();
    this.cargarConvenios();
  }

  displayConvenio(value: ConvenioControlValue | null): string {
    if (!value) {
      return '';
    }
    return typeof value === 'string' ? value : value.nombre;
  }

  buscarConvenios(): void {
    this.searchTerm = this.extraerTermino(this.buscadorControl.value);
    this.pageIndex = 0;
    this.cargarConvenios();
  }

  onConvenioSelected(event: MatAutocompleteSelectedEvent): void {
    const convenio = event.option.value as ConvenioSelectOption | undefined;
    if (!convenio) {
      return;
    }
    this.buscadorControl.setValue(convenio);
    this.buscarConvenios();
  }

  limpiarBuscador(): void {
    if (!this.searchTerm && !this.buscadorControl.value) {
      return;
    }
    this.buscadorControl.setValue('');
    this.searchTerm = null;
    this.pageIndex = 0;
    this.cargarConvenios();
  }

  cambiarPagina(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarConvenios();
  }

  abrirDialogCrear(): void {
    const dialogRef = this.dialog.open(ConvenioDialogComponent, {
      width: '520px',
      data: null
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      if (resultado) {
        this.cargarConvenios();
      }
    });
  }

  abrirDialogEditar(convenio: Convenio): void {
    const dialogRef = this.dialog.open(ConvenioDialogComponent, {
      width: '520px',
      data: convenio
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      if (resultado) {
        this.cargarConvenios();
      }
    });
  }

  eliminarConvenio(convenio: Convenio): void {
    if (!convenio?.convenio_id) {
      return;
    }

    if(!convenio?.modificable) {
      Swal.fire({
        title: 'Operación restringida',
        text: `No puedes eliminar el convenio "${convenio.nombre}". Este convenio está asociado a otros datos.`,
        icon: 'warning',
        confirmButtonText: 'Cancelar',
        confirmButtonColor: '#6c757d'
      })
      return;
    }

    Swal.fire({
      title: 'Eliminar convenio',
      text: `¿Confirmás eliminar "${convenio.nombre}"? Esta acción no se puede deshacer.`,
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
      this.eliminando.add(convenio.convenio_id);
      this.conveniosAdminService
        .eliminarConvenio(convenio.convenio_id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            Swal.fire({
              toast: true,
              position: 'top-end',
              icon: 'success',
              title: 'Convenio eliminado correctamente',
              showConfirmButton: false,
              timer: 2500,
              timerProgressBar: true,
              background: '#f0fdf4',
              color: '#14532d'
            });
            this.cargarConvenios();
            this.eliminando.delete(convenio.convenio_id);
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
            this.eliminando.delete(convenio.convenio_id);
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
    this.convenioService
      .getCatalogoConvenios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (convenios) => {
          this.conveniosSubject.next(convenios ?? []);
        },
        error: (error) => {
          console.error('Error obteniendo catálogo de convenio', error);
        },
        complete: () => {
          this.cargandoCatalogo = false;
        }
      });
  }

  private cargarConvenios(): void {
    this.cargandoLista = true;
    const params = {
      pagina: this.pageIndex + 1,
      limite: this.pageSize,
      search: this.searchTerm
    };

    this.conveniosAdminService
      .listarConvenios(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const datos = Array.isArray(response?.data) ? response.data : [];
          if (datos.length === 0 && (response?.total ?? 0) > 0 && this.pageIndex > 0) {
            this.pageIndex = Math.max(this.pageIndex - 1, 0);
            this.cargandoLista = false;
            this.cargarConvenios();
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
          const message = this.resolveErrorMessage(error, 'No se pudieron obtener los convenios.');
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

  private extraerTermino(value: ConvenioControlValue | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const termino = typeof value === 'string' ? value : value.nombre;
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
