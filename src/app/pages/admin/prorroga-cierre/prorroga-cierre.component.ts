import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AbstractControl, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { BehaviorSubject, Subject, combineLatest, map, startWith, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';

import { AdminNavbarComponent, AdminBreadcrumb } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { EjercicioCerradoResponse, MunicipioSelectOption, MunicipioService } from '../../../services/municipio.service';

type MunicipioControlValue = MunicipioSelectOption | string;

const ES_AR_DATE_FORMATS = {
  parse: {
    dateInput: 'DD/MM/YYYY'
  },
  display: {
    dateInput: 'dd/MM/yyyy',
    monthYearLabel: 'MMMM yyyy',
    dateA11yLabel: 'dd/MM/yyyy',
    monthYearA11yLabel: 'MMMM yyyy'
  }
};

@Component({
  selector: 'app-prorroga-cierre',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    AdminNavbarComponent
  ],
  providers: [
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
    { provide: MAT_DATE_FORMATS, useValue: ES_AR_DATE_FORMATS }
  ],
  templateUrl: './prorroga-cierre.component.html',
  styleUrls: ['./prorroga-cierre.component.scss']
})
export class ProrrogaCierreComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly municipiosSubject = new BehaviorSubject<MunicipioSelectOption[]>([]);

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Prórrogas de cierre' }
  ];

  readonly municipioControl = new FormControl<MunicipioControlValue>('');
  readonly filteredMunicipios$ = combineLatest([
    this.municipioControl.valueChanges.pipe(startWith('')),
    this.municipiosSubject.asObservable()
  ]).pipe(
    map(([value, municipios]) => {
      const filterValue =
        typeof value === 'string'
          ? value.toLowerCase().trim()
          : value?.municipio_nombre?.toLowerCase().trim() ?? '';

      if (!filterValue) {
        return municipios;
      }

      return municipios.filter((municipio) =>
        municipio.municipio_nombre.toLowerCase().includes(filterValue)
      );
    })
  );

  municipios: MunicipioSelectOption[] = [];
  selectedMunicipio: MunicipioSelectOption | null = null;
  cargandoMunicipios = false;

  periodos: EjercicioCerradoResponse[] = [];
  selectedPeriodo: EjercicioCerradoResponse | null = null;
  cargandoPeriodos = false;
  busquedaRealizada = false;

  readonly prorrogaForm: FormGroup;
  guardandoProrroga = false;

  readonly meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly municipioService: MunicipioService,
    private readonly dateAdapter: DateAdapter<Date>
  ) {
    this.dateAdapter.setLocale('es-AR');
    const hoy = this.getToday();
    this.prorrogaForm = this.fb.group({
      fechaFin: [hoy, [Validators.required, this.validarFechaPermitida()]]
    });
  }

  ngOnInit(): void {
    this.cargarMunicipios();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  displayMunicipio(value: MunicipioControlValue | null | undefined): string {
    if (!value) {
      return '';
    }
    return typeof value === 'string' ? value : value.municipio_nombre;
  }

  limpiarSeleccionMunicipio(): void {
    this.municipioControl.setValue('');
    this.selectedMunicipio = null;
    this.periodos = [];
    this.selectedPeriodo = null;
    this.busquedaRealizada = false;
    const hoy = this.getToday();
    this.prorrogaForm.patchValue({ fechaFin: hoy });
    this.prorrogaForm.get('fechaFin')?.updateValueAndValidity();
  }

  onMunicipioSelected(event: MatAutocompleteSelectedEvent): void {
    const municipio = event.option.value as MunicipioSelectOption;
    if (!municipio || !municipio.municipio_id) {
      return;
    }

    this.selectedMunicipio = municipio;
    this.busquedaRealizada = true;
    this.periodos = [];
    this.selectedPeriodo = null;

    this.cargarEjerciciosCerrados();
  }

  seleccionarPeriodo(periodo: EjercicioCerradoResponse): void {
    if (!periodo) {
      return;
    }

    this.selectedPeriodo = periodo;
    const fecha = this.obtenerFechaInicialPeriodo(periodo);
    this.prorrogaForm.patchValue({ fechaFin: fecha });
    const control = this.prorrogaForm.get('fechaFin');
    control?.updateValueAndValidity();
  }

  guardarProrroga(): void {
    if (!this.selectedMunicipio?.municipio_id || !this.selectedPeriodo) {
      return;
    }

    const control = this.prorrogaForm.get('fechaFin') as FormControl<Date | null>;
    if (!control || this.prorrogaForm.invalid) {
      control?.markAsTouched();
      const message = this.obtenerMensajeErrorFecha(control);
      Swal.fire({
        icon: 'warning',
        title: 'Fecha no válida',
        text: message,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#3085d6'
      });
      return;
    }

    const value = control.value;
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
      Swal.fire({
        icon: 'error',
        title: 'Fecha inválida',
        text: 'Seleccione una fecha válida antes de guardar.',
        confirmButtonText: 'Aceptar',
        confirmButtonColor: '#d33'
      });
      return;
    }

    const fechaFin = this.dateToISO(value);

    this.guardandoProrroga = true;
    this.municipioService.actualizarProrrogaMunicipio({
      municipioId: this.selectedMunicipio.municipio_id,
      ejercicio: this.selectedPeriodo.ejercicio,
      mes: this.selectedPeriodo.mes,
      fechaFin
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Prórroga actualizada',
          text: 'La nueva fecha de cierre se guardó correctamente.',
          timer: 2000,
          showConfirmButton: false
        });
        this.cargarEjerciciosCerrados();
      },
      error: (err) => {
        console.error('Error al actualizar la prórroga', err);
        Swal.fire({
          icon: 'error',
          title: 'No se pudo guardar',
          text: 'Verificá los datos e intentá nuevamente.',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#d33'
        });
      },
      complete: () => {
        this.guardandoProrroga = false;
      }
    });
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return '—';
    }
    const date = this.parseDate(value);
    if (!date) {
      return '—';
    }
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  getMesNombre(mes: number): string {
    if (!Number.isFinite(mes) || mes < 1 || mes > 12) {
      return `Mes ${mes}`;
    }
    return this.meses[mes - 1];
  }

  tieneProrroga(periodo: EjercicioCerradoResponse): boolean {
    return Boolean(periodo?.tiene_prorroga || periodo?.fecha_prorroga);
  }

  private cargarMunicipios(): void {
    this.cargandoMunicipios = true;
    this.municipioService.getCatalogoMunicipios()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          this.municipios = lista;
          this.municipiosSubject.next(lista);
        },
        error: (err) => {
          console.error('Error al cargar municipios', err);
          Swal.fire({
            icon: 'error',
            title: 'Error al cargar municipios',
            text: 'No pudimos obtener el listado de municipios.',
            confirmButtonText: 'Aceptar',
            confirmButtonColor: '#d33'
          });
        },
        complete: () => {
          this.cargandoMunicipios = false;
        }
      });
  }

  private cargarEjerciciosCerrados(): void {
    if (!this.selectedMunicipio?.municipio_id) {
      return;
    }

    this.cargandoPeriodos = true;
    this.municipioService.getEjerciciosCerradosMunicipio({
      municipioId: this.selectedMunicipio.municipio_id
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (periodos) => {
        const ordenados = [...periodos].sort((a, b) => {
          if (a.ejercicio !== b.ejercicio) {
            return b.ejercicio - a.ejercicio;
          }
          if (a.mes !== b.mes) {
            return b.mes - a.mes;
          }

          const convA = Number.isFinite(a.convenio_id) ? Number(a.convenio_id) : -Infinity;
          const convB = Number.isFinite(b.convenio_id) ? Number(b.convenio_id) : -Infinity;
          if (convA !== convB) {
            return convA - convB;
          }

          const pautaA = Number.isFinite(a.pauta_id) ? Number(a.pauta_id) : -Infinity;
          const pautaB = Number.isFinite(b.pauta_id) ? Number(b.pauta_id) : -Infinity;
          return pautaA - pautaB;
        });

        this.periodos = ordenados;
        if (ordenados.length > 0) {
          this.seleccionarPeriodo(ordenados[0]);
        } else {
          this.selectedPeriodo = null;
        }
      },
      error: (err) => {
        console.error('Error al obtener ejercicios cerrados', err);
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar periodos',
          text: 'No pudimos obtener los periodos cerrados del municipio.',
          confirmButtonText: 'Aceptar',
          confirmButtonColor: '#d33'
        });
      },
      complete: () => {
        this.cargandoPeriodos = false;
      }
    });
  }

  private parseFechaProrroga(periodo: EjercicioCerradoResponse): Date | null {
    const raw = periodo.raw ?? {};
    const prorroga = periodo.fecha_prorroga ??
      raw?.fecha_fin_prorroga ??
      raw?.fechaFinProrroga ??
      raw?.prorroga?.fecha_fin_nueva ??
      raw?.prorroga?.fecha_fin ??
      raw?.prorroga?.fechaFinNueva ??
      null;
    return this.parseDate(prorroga);
  }

  private parseDate(value?: string | null): Date | null {
    if (!value) {
      return null;
    }

    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const parts = normalized.split('T')[0]?.split('-');
    if (Array.isArray(parts) && parts.length === 3) {
      const [yearStr, monthStr, dayStr] = parts;
      const year = Number(yearStr);
      const month = Number(monthStr);
      const day = Number(dayStr);

      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        return new Date(year, month - 1, day);
      }
    }

    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private dateToISO(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private getToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  get minFechaSeleccionable(): Date | null {
    const hoy = this.getToday();
    const oficial = this.parseDate(this.selectedPeriodo?.fecha_fin_oficial);
    if (oficial && oficial > hoy) {
      return oficial;
    }
    return hoy;
  }

  private validarFechaPermitida(): ValidatorFn {
    return (control: AbstractControl) => {
      const value = control.value;
      if (!value) {
        return null;
      }

      if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        return { fechaInvalida: true };
      }

      const oficial = this.parseDate(this.selectedPeriodo?.fecha_fin_oficial);
      if (oficial && value < oficial) {
        return { fechaAnteriorOficial: true };
      }

      const hoy = this.getToday();
      if (value < hoy) {
        return { fechaEnPasado: true };
      }

      return null;
    };
  }

  private obtenerMensajeErrorFecha(control?: AbstractControl | null): string {
    if (!control) {
      return 'Debe seleccionar una fecha de cierre válida.';
    }

    if (control.hasError('fechaAnteriorOficial')) {
      return 'La prórroga no puede ser anterior a la fecha oficial de cierre.';
    }
    if (control.hasError('fechaEnPasado')) {
      return 'La prórroga debe ser posterior o igual a la fecha actual.';
    }
    if (control.hasError('fechaInvalida')) {
      return 'Seleccione una fecha válida antes de guardar.';
    }
    if (control.hasError('required')) {
      return 'Debe seleccionar una fecha de cierre para aplicar la prórroga.';
    }
    return 'La fecha seleccionada no es válida.';
  }

  private obtenerFechaInicialPeriodo(periodo: EjercicioCerradoResponse): Date | null {
    const prorroga = this.parseFechaProrroga(periodo);
    if (prorroga) {
      return prorroga;
    }

    const oficial = this.parseDate(periodo.fecha_fin_oficial);
    const hoy = this.getToday();
    if (oficial && oficial > hoy) {
      return oficial;
    }
    return hoy;
  }
}
