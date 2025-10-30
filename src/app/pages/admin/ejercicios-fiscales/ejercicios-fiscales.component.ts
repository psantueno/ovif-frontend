import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import Swal from 'sweetalert2';

import { AdminNavbarComponent, AdminBreadcrumb } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { EjerciciosService, EjercicioMes, EjerciciosPageResponse } from '../../../services/ejercicios.service';
import { EjerciciosFiscalesDialogComponent } from './ejercicios-fiscales-dialog.component';

interface MesOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-ejercicios-fiscales',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    MatDialogModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    AdminNavbarComponent
  ],
  templateUrl: './ejercicios-fiscales.component.html',
  styleUrls: ['./ejercicios-fiscales.component.scss']
})
export class EjerciciosFiscalesComponent implements OnInit {
  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Ejercicios fiscales' }
  ];

  readonly displayedColumns = ['ejercicio', 'mes', 'fecha_inicio', 'fecha_fin', 'acciones'];

  readonly meses: MesOption[] = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  ejercicios: EjercicioMes[] = [];
  cargando = false;
  private readonly eliminando = new Set<string>();
  totalRegistros = 0;
  pageSize = 12;
  pageIndex = 0;
  readonly pageSizeOptions = [12];
  yearControl = new FormControl<string | null>(null);
  private readonly destroyRef = inject(DestroyRef);
  private yearFilter: string | null = null;

  constructor(
    private readonly ejerciciosService: EjerciciosService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.yearControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef), debounceTime(300), distinctUntilChanged())
      .subscribe((value) => {
        const sanitized = value ? value.replace(/\D/g, '').slice(0, 4) : null;
        if (value !== sanitized) {
          this.yearControl.setValue(sanitized, { emitEvent: false });
        }
        this.yearFilter = sanitized && sanitized.length > 0 ? sanitized : null;
        this.pageIndex = 0;
        this.cargarEjercicios();
      });
    this.cargarEjercicios();
  }

  mesLabel(mes: number): string {
    const option = this.meses.find((m) => m.value === mes);
    return option ? option.label : `${mes}`;
  }

  eliminarEjercicio(ejercicio: EjercicioMes): void {
    Swal.fire({
      title: 'Eliminar ejercicio fiscal',
      text: `¿Desea eliminar el ejercicio ${ejercicio.ejercicio} / mes ${this.mesLabel(ejercicio.mes)}? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6'
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      const key = this.buildKey(ejercicio.ejercicio, ejercicio.mes);
      this.eliminando.add(key);

      this.ejerciciosService.eliminarEjercicio(ejercicio.ejercicio, ejercicio.mes).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Ejercicio eliminado',
            text: 'El ejercicio fiscal se eliminó correctamente.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#3085d6'
          });
          this.cargarEjercicios();
        },
        error: (error) => {
          const message = this.resolveErrorMessage(
            error,
            'No se pudo eliminar el ejercicio porque está vinculado a otros registros.'
          );
          Swal.fire({
            icon: 'error',
            title: 'No se pudo eliminar',
            text: message,
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
          });
        },
        complete: () => {
          this.eliminando.delete(key);
        }
      });
    });
  }

  estaEliminando(ejercicio: number, mes: number): boolean {
    return this.eliminando.has(this.buildKey(ejercicio, mes));
  }

  abrirDialogCrear(): void {
    const dialogRef = this.dialog.open(EjerciciosFiscalesDialogComponent, {
      width: '500px',
      data: null
    });

    dialogRef.afterClosed().subscribe((resultado) => {
      if (resultado) {
        this.cargarEjercicios();
      }
    });
  }

  abrirDialogEditar(ejercicio: EjercicioMes): void {
    const dialogRef = this.dialog.open(EjerciciosFiscalesDialogComponent, {
      width: '500px',
      data: { ejercicio }
    });

    dialogRef.afterClosed().subscribe((resultado) => {
      if (resultado) {
        this.cargarEjercicios();
      }
    });
  }

  private cargarEjercicios(): void {
    this.cargando = true;
    const page = this.pageIndex + 1;
    const params: { page: number; limit: number; year?: string } = {
      page,
      limit: this.pageSize
    };

    if (this.yearFilter) {
      params.year = this.yearFilter;
    }

    this.ejerciciosService.listarEjercicios(params).subscribe({
      next: (response: EjerciciosPageResponse) => {
        const datos = Array.isArray(response?.data) ? response.data : [];
        if (datos.length === 0 && (response?.total ?? 0) > 0 && this.pageIndex > 0) {
          this.pageIndex = Math.max(this.pageIndex - 1, 0);
          this.cargando = false;
          this.cargarEjercicios();
          return;
        }
        this.ejercicios = datos;
        this.totalRegistros = Number(response?.total) || datos.length;
        this.pageSize = Number(response?.limit) || this.pageSize;
        this.ordenarEjercicios();
      },
      error: (error) => {
        const message = this.resolveErrorMessage(error, 'No se pudieron obtener los ejercicios fiscales.');
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar',
          text: message,
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#d33'
        });
      },
      complete: () => {
        this.cargando = false;
      }
    });
  }

  cambiarPagina(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.cargarEjercicios();
  }

  private ordenarEjercicios(): void {
    this.ejercicios.sort((a, b) => {
      if (a.ejercicio === b.ejercicio) {
        return b.mes - a.mes;
      }
      return b.ejercicio - a.ejercicio;
    });
  }

  private resolveErrorMessage(error: any, fallback: string): string {
    if (error?.error) {
      const err = error.error;
      if (typeof err === 'string' && err.trim().length > 0) {
        return err;
      }
      if (typeof err === 'object' && typeof err.error === 'string' && err.error.trim().length > 0) {
        return err.error;
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

  private buildKey(ejercicio: number, mes: number): string {
    return `${ejercicio}-${mes}`;
  }
}
