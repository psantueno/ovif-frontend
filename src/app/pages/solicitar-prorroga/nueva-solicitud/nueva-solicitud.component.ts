import {
  Component, OnInit, DestroyRef, inject, Output, EventEmitter
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, FormArray, FormGroup,
  FormControl, Validators
} from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import Swal from 'sweetalert2';

import { MunicipioService, EjercicioCerradoResponse, MunicipioSelectOption } from '../../../services/municipio.service';
import {
  SolicitudesProrrogaService, SolicitudProrrogaItem,
  formatearFechaParaBackend, MESES_LABELS
} from '../../../services/solicitudes-prorroga.service';
import { mostrarToastExito, mostrarToastError } from '../../../core/utils/swal.util';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

interface FilaState {
  periodosCerrados: EjercicioCerradoResponse[];
  ejerciciosDisponibles: number[];
  mesesDisponibles: number[];
  conveniosDisponibles: { convenio_id: number; convenio_nombre: string }[];
  pautasDisponibles: { pauta_id: number; pauta_descripcion: string }[];
  cargandoPeriodos: boolean;
}

@Component({
  selector: 'app-nueva-solicitud',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatTooltipModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    LoadingOverlayComponent,
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
  ],
  templateUrl: './nueva-solicitud.component.html',
  styleUrls: ['./nueva-solicitud.component.scss'],
})
export class NuevaSolicitudComponent implements OnInit {
  @Output() solicitudEnviada = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly municipioService = inject(MunicipioService);
  private readonly solicitudesService = inject(SolicitudesProrrogaService);
  private readonly destroyRef = inject(DestroyRef);

  readonly mesesLabels = MESES_LABELS;
  readonly maxMotivo = 500;
  readonly hoy = new Date();

  cargandoMunicipios = false;
  enviando = false;
  municipiosAsignados: MunicipioSelectOption[] = [];

  // FormArray de filas
  readonly solicitudesForm = this.fb.group({
    filas: this.fb.array<FormGroup>([]),
  });

  // Estado paralelo de cada fila (opciones de cascada, loading)
  filasState: FilaState[] = [];

  get filas(): FormArray {
    return this.solicitudesForm.get('filas') as FormArray;
  }

  ngOnInit(): void {
    this.cargarMunicipios();
  }

  private cargarMunicipios(): void {
    this.cargandoMunicipios = true;
    this.municipioService.getMisMunicipios()
      .pipe(
        catchError(() => of([])),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(municipios => {
        this.municipiosAsignados = municipios;
        this.cargandoMunicipios = false;
      });
  }

  // ─── Gestión de filas ───────────────────────────────────────────────────────

  agregarFila(): void {
    const grupo = this.fb.group({
      municipios: new FormControl<number[]>([], { nonNullable: true, validators: [Validators.required] }),
      ejercicio: new FormControl<number | null>(null, Validators.required),
      mes: new FormControl<number | null>({ value: null, disabled: true }, Validators.required),
      convenio_id: new FormControl<number | null>({ value: null, disabled: true }, Validators.required),
      pauta_id: new FormControl<number | null>({ value: null, disabled: true }, Validators.required),
      fecha_cierre_solicitada: new FormControl<Date | null>(null, Validators.required),
      motivo: new FormControl<string>('', [Validators.required, Validators.maxLength(this.maxMotivo)]),
    });

    this.filas.push(grupo);
    this.filasState.push({
      periodosCerrados: [],
      ejerciciosDisponibles: [],
      mesesDisponibles: [],
      conveniosDisponibles: [],
      pautasDisponibles: [],
      cargandoPeriodos: false,
    });

    // Escuchar cambios de municipios en la fila recién creada
    const idx = this.filas.length - 1;
    grupo.get('municipios')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.onMunicipioFilaChanged(idx));

    grupo.get('ejercicio')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.onEjercicioFilaChanged(idx));

    grupo.get('mes')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.onMesFilaChanged(idx));

    grupo.get('convenio_id')!.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.onConvenioFilaChanged(idx));
  }

  eliminarFila(idx: number): void {
    this.filas.removeAt(idx);
    this.filasState.splice(idx, 1);
  }

  // ─── Cascada de selects por fila ────────────────────────────────────────────

  onMunicipioFilaChanged(idx: number): void {
    const fila = this.filas.at(idx) as FormGroup;
    const municipioIds: number[] = fila.get('municipios')?.value ?? [];

    this.resetCascadaDesde(idx, 'ejercicio');

    if (municipioIds.length === 0) {
      this.filasState[idx].periodosCerrados = [];
      this.filasState[idx].ejerciciosDisponibles = [];
      return;
    }

    this.filasState[idx].cargandoPeriodos = true;

    const requests = municipioIds.map(id =>
      this.municipioService.getEjerciciosCerradosMunicipio({ municipioId: id })
        .pipe(catchError(() => of([] as EjercicioCerradoResponse[])))
    );

    forkJoin(requests)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultados) => {
          const interseccion = this.calcularInterseccionPeriodos(resultados);
          this.filasState[idx].periodosCerrados = interseccion;
          this.filasState[idx].ejerciciosDisponibles = this.ejerciciosUnicos(interseccion);
          this.filasState[idx].cargandoPeriodos = false;
          fila.get('ejercicio')?.enable();
        },
        error: () => {
          this.filasState[idx].cargandoPeriodos = false;
        },
      });
  }

  onEjercicioFilaChanged(idx: number): void {
    const fila = this.filas.at(idx) as FormGroup;
    const ejercicio: number | null = fila.get('ejercicio')?.value;
    this.resetCascadaDesde(idx, 'mes');

    if (!ejercicio) return;

    const periodos = this.filasState[idx].periodosCerrados;
    this.filasState[idx].mesesDisponibles = this.mesesUnicos(
      periodos.filter(p => p.ejercicio === ejercicio)
    );
    fila.get('mes')?.enable();
  }

  onMesFilaChanged(idx: number): void {
    const fila = this.filas.at(idx) as FormGroup;
    const ejercicio: number | null = fila.get('ejercicio')?.value;
    const mes: number | null = fila.get('mes')?.value;
    this.resetCascadaDesde(idx, 'convenio_id');

    if (!ejercicio || !mes) return;

    const periodos = this.filasState[idx].periodosCerrados.filter(
      p => p.ejercicio === ejercicio && p.mes === mes
    );
    this.filasState[idx].conveniosDisponibles = this.conveniosUnicos(periodos);
    fila.get('convenio_id')?.enable();
  }

  onConvenioFilaChanged(idx: number): void {
    const fila = this.filas.at(idx) as FormGroup;
    const ejercicio: number | null = fila.get('ejercicio')?.value;
    const mes: number | null = fila.get('mes')?.value;
    const convenio_id: number | null = fila.get('convenio_id')?.value;
    this.resetCascadaDesde(idx, 'pauta_id');

    if (!ejercicio || !mes || !convenio_id) return;

    const periodos = this.filasState[idx].periodosCerrados.filter(
      p => p.ejercicio === ejercicio && p.mes === mes && p.convenio_id === convenio_id
    );
    this.filasState[idx].pautasDisponibles = this.pautasUnicas(periodos);
    fila.get('pauta_id')?.enable();
  }

  private resetCascadaDesde(idx: number, desde: string): void {
    const fila = this.filas.at(idx) as FormGroup;
    const orden = ['ejercicio', 'mes', 'convenio_id', 'pauta_id'];
    const inicioIdx = orden.indexOf(desde);

    orden.slice(inicioIdx).forEach(campo => {
      const ctrl = fila.get(campo);
      ctrl?.setValue(null, { emitEvent: false });
      if (campo !== 'ejercicio') {
        ctrl?.disable({ emitEvent: false });
      }
    });

    if (inicioIdx <= 1) {
      this.filasState[idx].mesesDisponibles = [];
      this.filasState[idx].conveniosDisponibles = [];
      this.filasState[idx].pautasDisponibles = [];
    } else if (inicioIdx <= 2) {
      this.filasState[idx].conveniosDisponibles = [];
      this.filasState[idx].pautasDisponibles = [];
    } else if (inicioIdx <= 3) {
      this.filasState[idx].pautasDisponibles = [];
    }
  }

  // ─── Lógica de intersección ─────────────────────────────────────────────────

  private calcularInterseccionPeriodos(resultados: EjercicioCerradoResponse[][]): EjercicioCerradoResponse[] {
    if (resultados.length === 0) return [];
    if (resultados.length === 1) return resultados[0];

    const makeKey = (p: EjercicioCerradoResponse) =>
      `${p.ejercicio}-${p.mes}-${p.convenio_id ?? 'null'}-${p.pauta_id ?? 'null'}`;

    const keySets = resultados.map(r => new Set(r.map(makeKey)));

    return resultados[0].filter(p => {
      const key = makeKey(p);
      return keySets.slice(1).every(set => set.has(key));
    });
  }

  private ejerciciosUnicos(periodos: EjercicioCerradoResponse[]): number[] {
    return [...new Set(periodos.map(p => p.ejercicio))].sort((a, b) => b - a);
  }

  private mesesUnicos(periodos: EjercicioCerradoResponse[]): number[] {
    return [...new Set(periodos.map(p => p.mes))].sort((a, b) => a - b);
  }

  private conveniosUnicos(periodos: EjercicioCerradoResponse[]): { convenio_id: number; convenio_nombre: string }[] {
    const mapa = new Map<number, string>();
    periodos.forEach(p => {
      if (p.convenio_id != null) {
        mapa.set(p.convenio_id, p.convenio_nombre ?? String(p.convenio_id));
      }
    });
    return [...mapa.entries()].map(([convenio_id, convenio_nombre]) => ({ convenio_id, convenio_nombre }));
  }

  private pautasUnicas(periodos: EjercicioCerradoResponse[]): { pauta_id: number; pauta_descripcion: string }[] {
    const mapa = new Map<number, string>();
    periodos.forEach(p => {
      if (p.pauta_id != null) {
        mapa.set(p.pauta_id, p.pauta_descripcion ?? String(p.pauta_id));
      }
    });
    return [...mapa.entries()].map(([pauta_id, pauta_descripcion]) => ({ pauta_id, pauta_descripcion }));
  }

  // ─── Envío ──────────────────────────────────────────────────────────────────

  enviar(): void {
    if (this.filas.length === 0) {
      mostrarToastError('Agregá al menos una solicitud.');
      return;
    }

    this.solicitudesForm.markAllAsTouched();
    this.filas.controls.forEach(ctrl => (ctrl as FormGroup).markAllAsTouched());

    if (this.solicitudesForm.invalid) {
      mostrarToastError('Completá todos los campos obligatorios antes de enviar.');
      return;
    }

    // Expandir filas → array de ítems (uno por municipio × fila)
    const items: SolicitudProrrogaItem[] = [];
    this.filas.controls.forEach(ctrl => {
      const fila = ctrl as FormGroup;
      const municipios: number[] = fila.get('municipios')?.value ?? [];
      const ejercicio: number = fila.get('ejercicio')?.value;
      const mes: number = fila.get('mes')?.value;
      const convenio_id: number = fila.get('convenio_id')?.value;
      const pauta_id: number = fila.get('pauta_id')?.value;
      const fecha: Date = fila.get('fecha_cierre_solicitada')?.value;
      const motivo: string = fila.get('motivo')?.value;

      municipios.forEach(municipio_id => {
        items.push({
          municipio_id,
          ejercicio,
          mes,
          convenio_id,
          pauta_id,
          fecha_cierre_solicitada: formatearFechaParaBackend(fecha)!,
          motivo,
        });
      });
    });

    this.enviando = true;
    this.solicitudesService.crear(items)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.enviando = false;
          const cantidad = res.solicitudes?.length ?? items.length;
          mostrarToastExito(`${cantidad} solicitud${cantidad !== 1 ? 'es' : ''} enviada${cantidad !== 1 ? 's' : ''} correctamente.`);
          this.limpiarFormulario();
          this.solicitudEnviada.emit();
        },
        error: (err) => {
          this.enviando = false;
          const errores = err?.error?.errores;
          if (Array.isArray(errores) && errores.length > 0) {
            const detalle = errores
              .map((e: any) => `• Ítem ${e.indice}: ${e.error}`)
              .join('\n');
            Swal.fire({
              icon: 'error',
              title: 'Errores en las solicitudes',
              html: `<pre style="text-align:left;font-size:13px;padding: 5px">${detalle}</pre>`,
              confirmButtonColor: '#2b3e4c',
            });
          } else {
            mostrarToastError(err?.error?.error ?? 'No se pudieron enviar las solicitudes.');
          }
        },
      });
  }

  private limpiarFormulario(): void {
    while (this.filas.length > 0) {
      this.filas.removeAt(0);
    }
    this.filasState = [];
  }

  // ─── Helpers de template ────────────────────────────────────────────────────

  getNombreMunicipio(id: number): string {
    return this.municipiosAsignados.find(m => m.municipio_id === id)?.municipio_nombre ?? String(id);
  }

  getMotivoLength(idx: number): number {
    const v = (this.filas.at(idx) as FormGroup).get('motivo')?.value;
    return typeof v === 'string' ? v.length : 0;
  }
}
