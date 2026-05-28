import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BehaviorSubject, Subject, combineLatest, map, startWith, takeUntil } from 'rxjs';
import { mostrarToastExito, mostrarToastError, mostrarToastWarning } from '../../../core/utils/swal.util';
import { AdminNavbarComponent, AdminBreadcrumb } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { MunicipioService, MunicipioSelectOption } from '../../../services/municipio.service';
import {
  TestCierreModulosService,
  TestCierreModulosResponse,
  ModuloCierre,
  MailTestGrupo
} from '../../../services/test-cierre-modulos.service';

type MunicipioControlValue = MunicipioSelectOption | string;

@Component({
  selector: 'app-test-cierre-modulos',
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
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatTableModule,
    MatTooltipModule,
    AdminNavbarComponent
  ],
  templateUrl: './test-cierre-modulos.component.html',
  styleUrls: ['./test-cierre-modulos.component.scss']
})
export class TestCierreModulosComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly municipiosSubject = new BehaviorSubject<MunicipioSelectOption[]>([]);

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Test de Cierre de Módulos' }
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
      return filterValue
        ? municipios.filter(m => m.municipio_nombre.toLowerCase().includes(filterValue))
        : municipios;
    })
  );

  municipios: MunicipioSelectOption[] = [];
  selectedMunicipio: MunicipioSelectOption | null = null;
  cargandoMunicipios = false;

  readonly form: FormGroup;

  simulando = false;
  resultado: TestCierreModulosResponse | null = null;
  private readonly gruposExpandidos = new Set<number>();

  readonly meses = [
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

  readonly gruposModulos: { label: string; hint: string; modulos: ModuloCierre[] }[] = [
    { label: 'Gastos y Recursos', hint: 'GASTOS, RECURSOS', modulos: ['GASTOS', 'RECURSOS'] },
    { label: 'Recaudaciones y Remuneraciones', hint: 'RECAUDACIONES, REMUNERACIONES', modulos: ['RECAUDACIONES', 'REMUNERACIONES'] },
    { label: 'Determinación Tributaria', hint: 'DETERMINACION_TRIBUTARIA', modulos: ['DETERMINACION_TRIBUTARIA'] }
  ];

  readonly simulacionColumns = ['modulo', 'tipo_cierre', 'estado', 'cierre_existente', 'observacion'];

  constructor(
    private readonly fb: FormBuilder,
    private readonly municipioService: MunicipioService,
    private readonly testService: TestCierreModulosService,
    private readonly sanitizer: DomSanitizer
  ) {
    this.form = this.fb.group({
      ejercicio: [
        new Date().getFullYear(),
        [Validators.required, Validators.min(2000), Validators.max(2100)]
      ],
      mes: [null, Validators.required],
      modulos: [[], this.atLeastOneModuloValidator],
      enviarMail: [false]
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
    if (!value) return '';
    return typeof value === 'string' ? value : value.municipio_nombre;
  }

  limpiarSeleccionMunicipio(): void {
    this.municipioControl.setValue('');
    this.selectedMunicipio = null;
    this.resultado = null;
    this.gruposExpandidos.clear();
  }

  onMunicipioSelected(event: MatAutocompleteSelectedEvent): void {
    const municipio = event.option.value as MunicipioSelectOption;
    if (!municipio?.municipio_id) return;
    this.selectedMunicipio = municipio;
    this.resultado = null;
    this.gruposExpandidos.clear();
  }

  isGrupoSelected(grupo: { modulos: ModuloCierre[] }): boolean {
    const current: ModuloCierre[] = this.form.get('modulos')?.value ?? [];
    return grupo.modulos.every(m => current.includes(m));
  }

  toggleGrupo(grupo: { modulos: ModuloCierre[] }): void {
    const control = this.form.get('modulos');
    let current: ModuloCierre[] = [...(control?.value ?? [])];
    if (this.isGrupoSelected(grupo)) {
      current = current.filter(m => !grupo.modulos.includes(m));
    } else {
      for (const m of grupo.modulos) {
        if (!current.includes(m)) {
          current.push(m);
        }
      }
    }
    control?.setValue(current);
    control?.markAsTouched();
  }

  simular(): void {
    if (!this.selectedMunicipio?.municipio_id) {
      mostrarToastWarning('Municipio requerido', 'Seleccioná un municipio para continuar.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      mostrarToastWarning('Formulario incompleto', this.obtenerMensajeErrorFormulario());
      return;
    }

    const { ejercicio, mes, modulos, enviarMail } = this.form.value as {
      ejercicio: number;
      mes: number;
      modulos: ModuloCierre[];
      enviarMail: boolean;
    };

    this.simulando = true;
    this.resultado = null;
    this.gruposExpandidos.clear();

    this.testService
      .simularCierreModulos({
        ejercicio: Number(ejercicio),
        mes: Number(mes),
        municipio_id: this.selectedMunicipio.municipio_id,
        modulos,
        enviar_mail: enviarMail ?? false
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.resultado = res;
          mostrarToastExito(
            'Simulación completada',
            `Se procesaron ${res.simulacion.length} módulo(s).`
          );
        },
        error: (err) => {
          console.error('Error en simulación de cierre', err);
          const msg = (err?.error?.message as string) ?? 'Verificá los datos e intentá nuevamente.';
          mostrarToastError('Error en la simulación', msg);
        },
        complete: () => {
          this.simulando = false;
        }
      });
  }

  limpiarFormulario(): void {
    this.form.reset({
      ejercicio: new Date().getFullYear(),
      mes: null,
      modulos: [],
      enviarMail: false
    });
    this.limpiarSeleccionMunicipio();
  }

  toggleGrupoMailPreview(index: number): void {
    if (this.gruposExpandidos.has(index)) {
      this.gruposExpandidos.delete(index);
    } else {
      this.gruposExpandidos.add(index);
    }
  }

  isGrupoMailExpandido(index: number): boolean {
    return this.gruposExpandidos.has(index);
  }

  mailHtmlSeguroForGrupo(grupo: MailTestGrupo): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(grupo.html ?? '');
  }

  private cargarMunicipios(): void {
    this.cargandoMunicipios = true;
    this.municipioService
      .getCatalogoMunicipios()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          this.municipios = lista;
          this.municipiosSubject.next(lista);
        },
        error: (err) => {
          console.error('Error al cargar municipios', err);
          mostrarToastError('Error al cargar municipios', 'No pudimos obtener el listado de municipios.');
        },
        complete: () => {
          this.cargandoMunicipios = false;
        }
      });
  }

  private atLeastOneModuloValidator(control: AbstractControl): { requiereModulo: true } | null {
    const value = control.value;
    return Array.isArray(value) && value.length > 0 ? null : { requiereModulo: true };
  }

  private obtenerMensajeErrorFormulario(): string {
    const ejercicioCtrl = this.form.get('ejercicio');
    const mesCtrl = this.form.get('mes');
    const modulosCtrl = this.form.get('modulos');
    if (ejercicioCtrl?.invalid) return 'Ingresá un año de ejercicio válido (2000–2100).';
    if (mesCtrl?.invalid) return 'Seleccioná el mes.';
    if (modulosCtrl?.invalid) return 'Seleccioná al menos un módulo.';
    return 'Revisá los campos e intentá nuevamente.';
  }
}
