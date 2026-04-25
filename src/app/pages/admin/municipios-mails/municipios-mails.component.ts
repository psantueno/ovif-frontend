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
import { resolveErrorMessage } from '../../../core/utils/error.util';
import { confirmarEliminacion, mostrarToastExito, mostrarToastError } from '../../../core/utils/swal.util';
import { AdminNavbarComponent } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';
import { AdminBreadcrumb } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { MunicipioMailSelectOption, MunicipioMailService } from '../../../services/municipio-mails.service';
import { MunicipioMail, MunicipiosMailsAdminService } from '../../../services/municipios-mails-admin.service';
import { MunicipioMailDialogComponent } from './municipio-mail-dialog.component';

type MunicipioMailControlValue = MunicipioMailSelectOption | string;

@Component({
  selector: 'app-admin-municipios-mails',
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
  templateUrl: './municipios-mails.component.html',
  styleUrls: ['./municipios-mails.component.scss']
})

export class MunicipioMailsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Mails de Municipios' }
  ];

  readonly displayedColumns = [
    'municipio_nombre',
    'email',
    'nombre',
    'acciones'
  ];

  readonly dataSource = new MatTableDataSource<MunicipioMail>([]);
  totalRegistros = 0;
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [10, 25, 50];

  cargandoLista = false;
  cargandoCatalogo = false;
  searchTerm: string | null = null;
  private readonly eliminando = new Set<MunicipioMail>();

  municipiosSinCargar: string[] = [];
  sinMailsExpanded = false;

  readonly buscadorControl = new FormControl<MunicipioMailControlValue>('');
  private readonly municipiosMailsSubject = new BehaviorSubject<MunicipioMailSelectOption[]>([]);
  readonly filteredMunicipiosMails$ = combineLatest([
    this.buscadorControl.valueChanges.pipe(startWith('')),
    this.municipiosMailsSubject.asObservable()
  ]).pipe(
    map(([value, mails]) => {
      const filterValue =
        typeof value === 'string'
          ? value.trim().toLowerCase()
          : value?.email?.toLowerCase().trim() ?? '';

      if (!filterValue) {
        return mails;
      }

      return mails.filter((mail) =>
        mail.email.toLowerCase().includes(filterValue)
      );
    })
  );

  enviando: boolean = false;

  @ViewChild(MatPaginator) paginator?: MatPaginator;

  constructor(
    private readonly municipiosMailsAdminService: MunicipiosMailsAdminService,
    private readonly municipioMailService: MunicipioMailService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.cargarCatalogo();
    this.cargarMunicipiosMails();
    this.cargarMunicipiosSinMails();
  }

  displayMunicipioMail(value: MunicipioMailControlValue | null): string {
    if (!value) {
      return '';
    }
    return typeof value === 'string' ? value : value.email;
  }

  buscarMunicipiosMails(): void {
    this.searchTerm = this.extraerTermino(this.buscadorControl.value);
    this.pageIndex = 0;
    this.cargarMunicipiosMails();
  }

  onMunicipioMailSelected(event: MatAutocompleteSelectedEvent): void {
    const mail = event.option.value as MunicipioMailSelectOption | undefined;
    if (!mail) {
      return;
    }
    this.buscadorControl.setValue(mail);
    this.buscarMunicipiosMails();
  }

  limpiarBuscador(): void {
    if (!this.searchTerm && !this.buscadorControl.value) {
      return;
    }
    this.buscadorControl.setValue('');
    this.searchTerm = null;
    this.pageIndex = 0;
    this.cargarMunicipiosMails();
  }

  cambiarPagina(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarMunicipiosMails();
  }

  abrirDialogCrear(): void {
    const dialogRef = this.dialog.open(MunicipioMailDialogComponent, {
      width: '520px',
      data: null
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      if (resultado) {
        this.cargarMunicipiosMails();
        this.cargarCatalogo();
        this.cargarMunicipiosSinMails()
      }
    });
  }

  abrirDialogEditar(mail: MunicipioMail): void {
    const dialogRef = this.dialog.open(MunicipioMailDialogComponent, {
      width: '520px',
      data: mail
    });

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((resultado) => {
      if (resultado) {
        this.cargarMunicipiosMails();
        this.cargarCatalogo();
        this.cargarMunicipiosSinMails()
      }
    });
  }

  eliminarMunicipioMail(mail: MunicipioMail): void {
    if (!mail?.municipio_id || !mail?.email) {
      return;
    }

    confirmarEliminacion(
      'Eliminar mail',
      `¿Confirmás eliminar el mail "${mail.email}" del municipio "${mail.municipio_nombre}"? Esta acción no se puede deshacer.`
    ).then((result) => {
      if (result.isConfirmed) {
        this.eliminando.add(mail);
        this.municipiosMailsAdminService.eliminarMunicipioMail(mail.municipio_id, mail.email).subscribe({
          next: () => {
            this.cargarMunicipiosMails();
            this.cargarCatalogo();
            this.cargarMunicipiosSinMails();
            mostrarToastExito('Mail eliminado');
          },
          error: (error) => {
            mostrarToastError(resolveErrorMessage(error, 'No se pudo eliminar el mail.'));
          },
          complete: () => {
            this.eliminando.delete(mail);
          }
        });
      }
    });
  }

  estaEliminando(mail: MunicipioMail): boolean {
    return this.eliminando.has(mail);
  }

  private cargarCatalogo(): void {
    this.cargandoCatalogo = true;
    this.municipioMailService
      .getCatalogoMunicipiosMails()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (mails) => {
          this.municipiosMailsSubject.next(mails ?? []);
        },
        error: (error) => {
          console.error('Error cargando catálogo de mails:', error);
          this.municipiosMailsSubject.next([]);
        },
        complete: () => {
          this.cargandoCatalogo = false;
        }
      });
  }

  private cargarMunicipiosMails(): void {
    this.cargandoLista = true;
    const params = {
      pagina: this.pageIndex + 1,
      limite: this.pageSize,
      search: this.searchTerm
    };

    this.municipiosMailsAdminService
      .listarMailsMunicipios(params)
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
          mostrarToastError(resolveErrorMessage(error, 'No se pudieron cargar los mails de municipios'));
        }
      });
  }

  private cargarMunicipiosSinMails(): void {
    this.cargandoLista = true;
    this.municipiosMailsAdminService
      .listarMunicipiosSinMail()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.municipiosSinCargar = response;
          this.cargandoLista = false;
        },
        error: (error) => {
          console.error('Error cargando mails:', error);
          this.municipiosSinCargar = [];
          this.cargandoLista = false;
        }
      });
  }

  private extraerTermino(value: MunicipioMailControlValue | null | undefined): string | null {
    if (!value) {
      return null;
    }
    const termino = typeof value === 'string' ? value : value.email;
    const clean = termino.trim();
    return clean.length > 0 ? clean : null;
  }
}
