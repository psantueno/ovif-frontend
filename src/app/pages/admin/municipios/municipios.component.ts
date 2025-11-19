import { Component, OnInit, ViewChild, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
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
import { MunicipiosAdminService, Municipio } from '../../../services/municipios-admin.service';
import { MunicipioService, MunicipioSelectOption } from '../../../services/municipio.service';
import { MunicipioDialogComponent } from './municipio-dialog.component';

type MunicipioControlValue = MunicipioSelectOption | string;

@Component({
  selector: 'app-admin-municipios',
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
    AdminNavbarComponent
  ],
  templateUrl: './municipios.component.html',
  styleUrls: ['./municipios.component.scss']
})
export class MunicipiosComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Municipios' }
  ];

  readonly displayedColumns = [
    'municipio_id',
    'municipio_nombre',
    'municipio_usuario',
    'municipio_spar',
    'municipio_ubge',
    'municipio_subir_archivos',
    'municipio_poblacion',
    'acciones'
  ];

  readonly dataSource = new MatTableDataSource<Municipio>([]);
  totalRegistros = 0;
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [10, 25, 50];

  cargandoLista = false;
  cargandoCatalogo = false;
  searchTerm: string | null = null;
  private readonly eliminando = new Set<number>();

  readonly buscadorControl = new FormControl<MunicipioControlValue>('');
  private readonly municipiosSubject = new BehaviorSubject<MunicipioSelectOption[]>([]);
  readonly filteredMunicipios$ = combineLatest([
    this.buscadorControl.valueChanges.pipe(startWith('')),
    this.municipiosSubject.asObservable()
  ]).pipe(
    map(([value, municipios]) => {
      const filterValue =
        typeof value === 'string'
          ? value.trim().toLowerCase()
          : value?.municipio_nombre?.toLowerCase().trim() ?? '';

      if (!filterValue) {
        return municipios;
      }

      return municipios.filter((municipio) =>
        municipio.municipio_nombre.toLowerCase().includes(filterValue)
      );
    })
  );

  @ViewChild(MatPaginator) paginator?: MatPaginator;

  constructor(
    private readonly municipiosService: MunicipiosAdminService,
    private readonly municipioService: MunicipioService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.cargarCatalogo();
    this.cargarMunicipios();
  }

  displayMunicipio(value: MunicipioControlValue | null): string {
    if (!value) {
      return '';
    }
    return typeof value === 'string' ? value : value.municipio_nombre;
  }

  buscarMunicipios(): void {
    this.searchTerm = this.extraerTermino(this.buscadorControl.value);
    this.pageIndex = 0;
    this.cargarMunicipios();
  }

  onMunicipioSelected(event: MatAutocompleteSelectedEvent): void {
    const municipio = event.option.value as MunicipioSelectOption | undefined;
    if (!municipio) {
      return;
    }
    this.buscadorControl.setValue(municipio);
    this.buscarMunicipios();
  }

  limpiarBuscador(): void {
    if (!this.searchTerm && !this.buscadorControl.value) {
      return;
    }
    this.buscadorControl.setValue('');
    this.searchTerm = null;
    this.pageIndex = 0;
    this.cargarMunicipios();
  }

  cambiarPagina(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarMunicipios();
  }

  abrirDialogCrear(): void {
    const dialogRef = this.dialog.open(MunicipioDialogComponent, {
      width: '520px',
      data: null
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      if (resultado) {
        this.cargarMunicipios();
      }
    });
  }

  abrirDialogEditar(municipio: Municipio): void {
    const dialogRef = this.dialog.open(MunicipioDialogComponent, {
      width: '520px',
      data: municipio
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      if (resultado) {
        this.cargarMunicipios();
      }
    });
  }

  eliminarMunicipio(municipio: Municipio): void {
    if (!municipio?.municipio_id) {
      return;
    }

    Swal.fire({
      title: 'Eliminar municipio',
      text: `¿Confirmás eliminar "${municipio.municipio_nombre}"? Esta acción no se puede deshacer.`,
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

      this.eliminando.add(municipio.municipio_id);
      this.municipiosService
        .eliminarMunicipio(municipio.municipio_id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            Swal.fire({
              icon: 'success',
              title: 'Municipio eliminado',
              text: 'El municipio se eliminó correctamente.',
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#3085d6'
            });
            this.cargarMunicipios();
          },
          error: (error) => {
            const message = this.resolveErrorMessage(error, 'No se pudo eliminar el municipio.');
            Swal.fire({
              icon: 'error',
              title: 'Error al eliminar',
              text: message,
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#d33'
            });
          },
          complete: () => {
            this.eliminando.delete(municipio.municipio_id);
          }
        });
    });
  }

  estaEliminando(id: number): boolean {
    return this.eliminando.has(id);
  }

  private cargarCatalogo(): void {
    this.cargandoCatalogo = true;
    this.municipioService
      .getCatalogoMunicipios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (municipios) => {
          this.municipiosSubject.next(municipios ?? []);
        },
        error: (error) => {
          console.error('Error obteniendo catálogo de municipios', error);
        },
        complete: () => {
          this.cargandoCatalogo = false;
        }
      });
  }

  private cargarMunicipios(): void {
    this.cargandoLista = true;
    const params = {
      pagina: this.pageIndex + 1,
      limite: this.pageSize,
      search: this.searchTerm
    };

    this.municipiosService
      .listarMunicipios(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const datos = Array.isArray(response?.data) ? response.data : [];
          if (datos.length === 0 && (response?.total ?? 0) > 0 && this.pageIndex > 0) {
            this.pageIndex = Math.max(this.pageIndex - 1, 0);
            this.cargandoLista = false;
            this.cargarMunicipios();
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
          const message = this.resolveErrorMessage(error, 'No se pudieron obtener los municipios.');
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

  private extraerTermino(value: MunicipioControlValue | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const termino = typeof value === 'string' ? value : value.municipio_nombre;
    const clean = termino.trim();
    return clean.length > 0 ? clean : null;
  }

  private resolveErrorMessage(error: any, fallback: string): string {
    if (error?.error) {
      const err = error.error;
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
