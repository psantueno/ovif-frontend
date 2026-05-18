import { Component, OnInit, ViewChild, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatCheckboxModule, MatCheckboxChange } from '@angular/material/checkbox';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { RouterModule } from '@angular/router';
import { provideNativeDateAdapter } from '@angular/material/core';
import Swal from 'sweetalert2';
import { LoadingOverlayComponent } from '../../../shared/components/loading-overlay/loading-overlay.component';

import {
  SolicitudesProrrogaService, SolicitudProrroga, EstadoSolicitud,
  RechazarLoteItem, AprobarLoteItem,
  formatearFechaParaBackend, mostrarFecha, MESES_LABELS
} from '../../../services/solicitudes-prorroga.service';
import { MunicipioService, MunicipioSelectOption } from '../../../services/municipio.service';
import { ConveniosAdminService, Convenio } from '../../../services/convenios-admin.service';
import { PautasAdminService, Pauta } from '../../../services/pautas-admin.service';
import { AdminNavbarComponent, AdminBreadcrumb } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { AprobarSolicitudDialogComponent } from './aprobar-admin/aprobar-solicitud-dialog.component';
import { RechazarSolicitudDialogComponent } from './rechazar-admin/rechazar-solicitud-dialog.component';
import { DetalleSolicitudAdminDialogComponent } from './detalle-admin/detalle-solicitud-admin-dialog.component';
import { mostrarToastExito, mostrarToastError } from '../../../core/utils/swal.util';

@Component({
  selector: 'app-solicitudes-prorroga-admin',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatDividerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatDialogModule,
    AdminNavbarComponent,
    LoadingOverlayComponent,
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
  ],
  templateUrl: './solicitudes-prorroga-admin.component.html',
  styleUrls: ['./solicitudes-prorroga-admin.component.scss'],
})
export class SolicitudesProrrogaAdminComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private readonly solicitudesService = inject(SolicitudesProrrogaService);
  private readonly municipioService = inject(MunicipioService);
  private readonly conveniosService = inject(ConveniosAdminService);
  private readonly pautasService = inject(PautasAdminService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Solicitudes de Prórroga' },
  ];

  readonly mesesLabels = MESES_LABELS;
  readonly mostrarFecha = mostrarFecha;
  readonly estados: EstadoSolicitud[] = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA'];
  readonly ejercicios: number[] = Array.from({ length: 15 }, (_, i) => 2026 - i);

  readonly displayedColumns = [
    'seleccion', 'fecha_solicitud', 'solicitante', 'municipio', 'ejercicio', 'mes',
    'convenio', 'pauta', 'fecha_cierre_solicitada', 'estado',
    'resuelto_por', 'fecha_resolucion', 'acciones'
  ];

  dataSource = new MatTableDataSource<SolicitudProrroga>([]);
  totalRegistros = 0;
  pagina = 1;
  limite = 10;
  cargando = false;

  municipios: MunicipioSelectOption[] = [];
  convenios: Convenio[] = [];
  pautas: Pauta[] = [];
  seleccionadas = new Set<number>();

  filtroForm: FormGroup = this.fb.group({
    estado: ['PENDIENTE'],
    municipio_id: [''],
    ejercicio: [''],
    mes: [''],
    convenio_id: [''],
    pauta_id: [''],
    fecha_solicitud_desde: [null],
    fecha_solicitud_hasta: [null],
    fecha_resolucion_desde: [null],
    fecha_resolucion_hasta: [null],
  });

  enviando = false;

  get seleccionadasArray(): SolicitudProrroga[] {
    return this.dataSource.data.filter(s => this.seleccionadas.has(s.solicitud_id));
  }

  get pendientesEnPagina(): SolicitudProrroga[] {
    return this.dataSource.data.filter(s => s.estado === 'PENDIENTE');
  }

  get todasSeleccionadas(): boolean {
    const pendientes = this.pendientesEnPagina;
    return pendientes.length > 0 && pendientes.every(s => this.seleccionadas.has(s.solicitud_id));
  }

  get fechaSolicitudDesdeMax(): Date | null {
    return this.filtroForm.get('fecha_solicitud_hasta')?.value ?? null;
  }

  get fechaSolicitudHastaMin(): Date | null {
    return this.filtroForm.get('fecha_solicitud_desde')?.value ?? null;
  }

  get fechaResolucionDesdeMax(): Date | null {
    return this.filtroForm.get('fecha_resolucion_hasta')?.value ?? null;
  }

  get fechaResolucionHastaMin(): Date | null {
    return this.filtroForm.get('fecha_resolucion_desde')?.value ?? null;
  }

  ngOnInit(): void {
    this.cargarMunicipios();
    this.cargarConvenios();
    this.cargarPautas();
    this.buscar();
  }

  private cargarMunicipios(): void {
    this.municipioService.getCatalogoMunicipios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(m => this.municipios = m);
  }

  private cargarConvenios(): void {
    this.conveniosService.listarConvenios({ limite: 999 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => this.convenios = res.data);
  }

  private cargarPautas(): void {
    this.pautasService.listarPautas({ limite: 999 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => this.pautas = res.data);
  }

  buscar(): void {
    this.pagina = 1;
    this.seleccionadas.clear();
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtroForm.reset({ estado: 'PENDIENTE' });
    this.buscar();
  }

  cambiarPagina(event: PageEvent): void {
    this.pagina = event.pageIndex + 1;
    this.limite = event.pageSize;
    this.seleccionadas.clear();
    this.cargar();
  }

  private cargar(): void {
    this.cargando = true;
    const f = this.filtroForm.value;
    this.solicitudesService.listar({
      estado: f.estado || undefined,
      municipio_id: f.municipio_id || undefined,
      ejercicio: f.ejercicio || undefined,
      mes: f.mes || undefined,
      convenio_id: f.convenio_id || undefined,
      pauta_id: f.pauta_id || undefined,
      solicitado_por: f.solicitado_por || undefined,
      fecha_solicitud_desde: formatearFechaParaBackend(f.fecha_solicitud_desde),
      fecha_solicitud_hasta: formatearFechaParaBackend(f.fecha_solicitud_hasta),
      fecha_resolucion_desde: formatearFechaParaBackend(f.fecha_resolucion_desde),
      fecha_resolucion_hasta: formatearFechaParaBackend(f.fecha_resolucion_hasta),
      page: this.pagina,
      limit: this.limite,
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.dataSource.data = res.data;
          this.totalRegistros = res.total;
          this.cargando = false;
        },
        error: () => {
          mostrarToastError('Error al cargar las solicitudes.');
          this.cargando = false;
        },
      });
  }

  // ─── Selección ───────────────────────────────────────────────────────────────

  toggleTodas(change: MatCheckboxChange): void {
    if (change.checked) {
      this.pendientesEnPagina.forEach(s => this.seleccionadas.add(s.solicitud_id));
    } else {
      this.pendientesEnPagina.forEach(s => this.seleccionadas.delete(s.solicitud_id));
    }
  }

  toggleSolicitud(id: number, change: MatCheckboxChange): void {
    change.checked ? this.seleccionadas.add(id) : this.seleccionadas.delete(id);
  }

  estaSeleccionada(id: number): boolean {
    return this.seleccionadas.has(id);
  }

  // ─── Acciones individuales ───────────────────────────────────────────────────

  verDetalle(solicitud: SolicitudProrroga): void {
    this.solicitudesService.obtener(solicitud.solicitud_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          this.dialog.open(DetalleSolicitudAdminDialogComponent, {
            width: '650px', maxWidth: '700px', data: detalle,
          });
        },
        error: () => mostrarToastError('No se pudo cargar el detalle.'),
      });
  }

  aprobarSolicitud(solicitud: SolicitudProrroga): void {
    const ref = this.dialog.open(AprobarSolicitudDialogComponent, {
      width: '500px', data: solicitud,
    });
    ref.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result) this.cargar();
      });
  }

  rechazarSolicitud(solicitud: SolicitudProrroga): void {
    const ref = this.dialog.open(RechazarSolicitudDialogComponent, {
      width: '460px', data: solicitud,
    });
    ref.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result) this.cargar();
      });
  }

  // ─── Acciones masivas ────────────────────────────────────────────────────────

  aprobarLote(): void {
    const ids = [...this.seleccionadas];
    if (ids.length === 0) return;

    Swal.fire({
      title: `¿Aprobar ${ids.length} solicitud${ids.length !== 1 ? 'es' : ''}?`,
      text: 'Se usará la fecha de cierre solicitada de cada una como fecha aprobada.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, aprobar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2e7d32',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
    }).then(result => {
      if (!result.isConfirmed) return;

      const items: AprobarLoteItem[] = ids.map(solicitud_id => ({ solicitud_id }));
      this.enviando = true;
      this.solicitudesService.aprobarLote(items)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.seleccionadas.clear();
            const exitosas = res.resultados.filter(r => r.success).length;
            const fallidas = res.resultados.filter(r => !r.success);

            mostrarToastExito(`${exitosas} solicitud${exitosas !== 1 ? 'es aprobadas' : ' aprobada'}.`);

            if (fallidas.length > 0) {
              const detalle = fallidas.map(f => `• #${f.solicitud_id}: ${f.error}`).join('\n');
              Swal.fire({
                icon: 'warning',
                title: `${fallidas.length} solicitud${fallidas.length !== 1 ? 'es' : ''} con error`,
                html: `<pre style="text-align:left;font-size:12px">${detalle}</pre>`,
                confirmButtonColor: '#2b3e4c',
              });
            }
            this.cargar();
            this.enviando = false;
          },
          error: () => {
            this.enviando = false;
            mostrarToastError('Error al aprobar en lote.')
          },
        });
    });
  }

  rechazarLote(): void {
    const ids = [...this.seleccionadas];
    if (ids.length === 0) return;

    Swal.fire({
      title: `Rechazar ${ids.length} solicitud${ids.length !== 1 ? 'es' : ''}`,
      text: 'Ingresá el motivo de rechazo (se aplicará a todas las seleccionadas).',
      icon: 'warning',
      input: 'textarea',
      inputPlaceholder: 'Motivo de rechazo obligatorio...',
      inputAttributes: { rows: '3' },
      showCancelButton: true,
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d32f2f',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
      preConfirm: (motivo: string) => {
        if (!motivo?.trim()) {
          Swal.showValidationMessage('El motivo es obligatorio.');
        }
        return motivo?.trim();
      },
    }).then(result => {
      if (!result.isConfirmed || !result.value) return;

      const items: RechazarLoteItem[] = ids.map(solicitud_id => ({
        solicitud_id,
        comentario_resolucion: result.value,
      }));

      this.enviando = true;
      this.solicitudesService.rechazarLote(items)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.seleccionadas.clear();
            const exitosas = res.resultados.filter(r => r.success).length;
            const fallidas = res.resultados.filter(r => !r.success);

            mostrarToastExito(`${exitosas} solicitud${exitosas !== 1 ? 'es rechazadas' : ' rechazada'}.`);

            if (fallidas.length > 0) {
              const detalle = fallidas.map(f => `• #${f.solicitud_id}: ${f.error}`).join('\n');
              Swal.fire({
                icon: 'warning',
                title: `${fallidas.length} con error`,
                html: `<pre style="text-align:left;font-size:12px">${detalle}</pre>`,
                confirmButtonColor: '#2b3e4c',
              });
            }
            this.cargar();
            this.enviando = false;
          },
          error: () => {
            this.enviando = false;
            mostrarToastError('Error al rechazar en lote.')
          },
        });
    });
  }
}
