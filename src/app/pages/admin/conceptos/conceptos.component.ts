import { Component, inject, OnInit, ViewChild, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
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
import { resolveErrorMessage } from '../../../core/utils/error.util';
import { confirmarEliminacion, mostrarToastExito, mostrarToastError } from '../../../core/utils/swal.util';
import { AdminNavbarComponent } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
import { AdminBreadcrumb } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { Concepto, ConceptosAdminService } from '../../../services/conceptos-admin.service';
import { ConceptoSelectOption, ConceptoService } from '../../../services/concepto.service';
import { ConceptoDialogComponent } from './concepto-dialog.component';

type ConceptoControlValue = ConceptoSelectOption | string;

@Component({
  selector: 'app-admin-conceptos',
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
  templateUrl: './conceptos.component.html',
  styleUrls: ['./conceptos.component.scss']
})

export class ConceptosComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Conceptos' }
  ];

  readonly displayedColumns = [
    'cod_concepto',
    'descripcion',
    'cod_recurso',
    'acciones'
  ];

  readonly dataSource = new MatTableDataSource<Concepto>([]);
  totalRegistros = 0;
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [10, 25, 50];

  cargandoLista = false;
  cargandoCatalogo = false;
  searchTerm: string | null = null;
  private readonly eliminando = new Set<number>();

  readonly buscadorControl = new FormControl<ConceptoControlValue>('');
  private readonly conceptosSubject = new BehaviorSubject<ConceptoSelectOption[]>([]);
  readonly filteredConceptos$ = combineLatest([
    this.buscadorControl.valueChanges.pipe(startWith('')),
    this.conceptosSubject.asObservable()
  ]).pipe(
    map(([value, conceptos]) => {
      const filterValue =
        typeof value === 'string'
          ? value.trim().toLowerCase()
          : value?.descripcion?.toLowerCase().trim() ?? '';

      if (!filterValue) {
        return conceptos;
      }

      return conceptos.filter((concepto) =>
        concepto.descripcion.toLowerCase().includes(filterValue)
      );
    })
  );

  enviando: boolean = false;

  @ViewChild(MatPaginator) paginator?: MatPaginator;

  constructor(
    private readonly conceptosAdminService: ConceptosAdminService,
    private readonly conceptoService: ConceptoService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.cargarCatalogo();
    this.cargarConceptos();
  }

  displayConcepto(value: ConceptoControlValue | null): string {
    if (!value) {
      return '';
    }
    return typeof value === 'string' ? value : value.descripcion;
  }

  buscarConceptos(): void {
    this.searchTerm = this.extraerTermino(this.buscadorControl.value);
    this.pageIndex = 0;
    this.cargarConceptos();
  }

  onConceptoSelected(event: MatAutocompleteSelectedEvent): void {
    const concepto = event.option.value as ConceptoSelectOption | undefined;
    if (!concepto) {
      return;
    }
    this.buscadorControl.setValue(concepto);
    this.buscarConceptos();
  }

  limpiarBuscador(): void {
    if (!this.searchTerm && !this.buscadorControl.value) {
      return;
    }
    this.buscadorControl.setValue('');
    this.searchTerm = null;
    this.pageIndex = 0;
    this.cargarConceptos();
  }

  cambiarPagina(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarConceptos();
  }

  abrirDialogCrear(): void {
    const dialogRef = this.dialog.open(ConceptoDialogComponent, {
      width: '520px',
      data: null
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      if (resultado) {
        this.cargarConceptos();
        this.cargarCatalogo();
      }
    });
  }

  abrirDialogEditar(concepto: Concepto): void {
    const dialogRef = this.dialog.open(ConceptoDialogComponent, {
      width: '520px',
      data: concepto
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      if (resultado) {
        this.cargarConceptos();
        this.cargarCatalogo();
      }
    });
  }

  eliminarConcepto(concepto: Concepto): void {
    if (!concepto?.cod_concepto) {
      return;
    }

    if (!concepto?.modificable) {
      Swal.fire({
        title: 'No se puede eliminar',
        text: 'Este concepto no puede ser eliminado porque se encuentra asociado a otros datos o ya fue procesado.',
        icon: 'warning',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    confirmarEliminacion(
      'Eliminar concepto',
      `¿Confirmás eliminar "${concepto.descripcion}"? Esta acción no se puede deshacer.`
    ).then((result) => {
      if (result.isConfirmed) {
        this.eliminando.add(concepto.cod_concepto);
        this.conceptosAdminService.eliminarConcepto(concepto.cod_concepto)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              this.cargarConceptos();
              this.cargarCatalogo();
              mostrarToastExito('Concepto eliminado');
            },
            error: (error) => {
              mostrarToastError(resolveErrorMessage(error, 'No se pudo eliminar el concepto.'));
            },
            complete: () => {
              this.eliminando.delete(concepto.cod_concepto);
            }
          });
      }
    });
  }

  estaEliminando(id: number): boolean {
    return this.eliminando.has(id);
  }

  private cargarCatalogo(): void {
    this.cargandoCatalogo = true;
    this.conceptoService
      .getCatalogoConceptos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (conceptos) => {
          this.conceptosSubject.next(conceptos ?? []);
        },
        error: (error) => {
          console.error('Error cargando catálogo de conceptos:', error);
          this.conceptosSubject.next([]);
        },
        complete: () => {
          this.cargandoCatalogo = false;
        }
      });
  }

  private cargarConceptos(): void {
    this.cargandoLista = true;
    const params = {
      pagina: this.pageIndex + 1,
      limite: this.pageSize,
      search: this.searchTerm
    };

    this.conceptosAdminService
      .listarConceptos(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.dataSource.data = response.data;
          this.totalRegistros = response.total;
          if (this.paginator) {
            this.paginator.pageIndex = this.pageIndex;
            this.paginator.pageSize = this.pageSize;
          }
          this.cargandoLista = false;
        },
        error: (error) => {
          this.dataSource.data = [];
          this.totalRegistros = 0;
          this.cargandoLista = false;
          mostrarToastError(resolveErrorMessage(error, 'No se pudieron cargar los conceptos de recaudación'));
        }
      });
  }

  private extraerTermino(value: ConceptoControlValue | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const termino = typeof value === 'string' ? value : value.descripcion;
    const clean = termino.trim();
    return clean.length > 0 ? clean : null;
  }
}
