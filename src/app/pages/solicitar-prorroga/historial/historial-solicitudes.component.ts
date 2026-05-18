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
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';

import {
  SolicitudesProrrogaService, SolicitudProrroga, EstadoSolicitud,
  formatearFechaParaBackend, mostrarFecha, MESES_LABELS
} from '../../../services/solicitudes-prorroga.service';
import { MunicipioService, MunicipioSelectOption } from '../../../services/municipio.service';
import { ConvenioService, ConvenioSelectOption } from '../../../services/convenio.service';
import { PautaService, PautaSelectOption } from '../../../services/pauta.service';
import { DetalleSolicitudDialogComponent } from './detalle-dialog/detalle-solicitud-dialog.component';
import { EditarSolicitudDialogComponent } from './editar-dialog/editar-solicitud-dialog.component';
import { CancelarSolicitudDialogComponent } from './cancelar-dialog/cancelar-solicitud-dialog.component';
import { mostrarToastError } from '../../../core/utils/swal.util';

@Component({
  selector: 'app-historial-solicitudes',
  standalone: true,
  imports: [
    CommonModule,
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
    MatDialogModule,
  ],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
  ],
  templateUrl: './historial-solicitudes.component.html',
  styleUrls: ['./historial-solicitudes.component.scss'],
})
export class HistorialSolicitudesComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private readonly solicitudesService = inject(SolicitudesProrrogaService);
  private readonly municipioService = inject(MunicipioService);
  private readonly conveniosService = inject(ConvenioService);
  private readonly pautasService = inject(PautaService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly mesesLabels = MESES_LABELS;
  readonly mostrarFecha = mostrarFecha;

  readonly displayedColumns = [
    'fecha_solicitud', 'municipio', 'ejercicio', 'mes', 'convenio',
    'pauta', 'fecha_cierre_solicitada', 'estado', 'fecha_resolucion',
    'comentario_resolucion', 'acciones'
  ];

  readonly estados: EstadoSolicitud[] = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA'];
  readonly ejercicios: number[] = Array.from({ length: 15 }, (_, i) => 2026 - i);

  dataSource = new MatTableDataSource<SolicitudProrroga>([]);
  totalRegistros = 0;
  pagina = 1;
  limite = 10;
  cargando = false;

  municipiosAsignados: MunicipioSelectOption[] = [];
  convenios: ConvenioSelectOption[] = [];
  pautas: PautaSelectOption[] = [];

  filtroForm: FormGroup = this.fb.group({
    estado: [''],
    municipio_id: [''],
    ejercicio: [''],
    mes: [''],
    convenio_id: [''],
    pauta_id: [''],
    fecha_solicitud_desde: [null],
    fecha_solicitud_hasta: [null],
  });

  ngOnInit(): void {
    this.cargarMunicipios();
    this.cargarConvenios();
    this.cargarPautas();
    this.buscar();
  }

  private cargarMunicipios(): void {
    this.municipioService.getMisMunicipios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(m => this.municipiosAsignados = m);
  }

  private cargarConvenios(): void {
    this.conveniosService.getCatalogoConvenios()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => this.convenios = res);
  }

  private cargarPautas(): void {
    this.pautasService.getCatalogoPautas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(res => this.pautas = res);
  }

  buscar(): void {
    this.pagina = 1;
    this.cargar();
  }

  limpiarFiltros(): void {
    this.filtroForm.reset({
      estado: '', municipio_id: '', ejercicio: '', mes: '',
      convenio_id: '', pauta_id: '', fecha_solicitud_desde: null, fecha_solicitud_hasta: null,
    });
    this.buscar();
  }

  cambiarPagina(event: PageEvent): void {
    this.pagina = event.pageIndex + 1;
    this.limite = event.pageSize;
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
      fecha_solicitud_desde: formatearFechaParaBackend(f.fecha_solicitud_desde),
      fecha_solicitud_hasta: formatearFechaParaBackend(f.fecha_solicitud_hasta),
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
          mostrarToastError('Error al cargar el historial.');
          this.cargando = false;
        },
      });
  }

  get fechaSolicitudDesdeMax(): Date | null {
    return this.filtroForm.get('fecha_solicitud_hasta')?.value ?? null;
  }

  get fechaSolicitudHastaMin(): Date | null {
    return this.filtroForm.get('fecha_solicitud_desde')?.value ?? null;
  }

  // ─── Acciones ───────────────────────────────────────────────────────────────

  verDetalle(solicitud: SolicitudProrroga): void {
    this.solicitudesService.obtener(solicitud.solicitud_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detalle) => {
          this.dialog.open(DetalleSolicitudDialogComponent, {
            width: '700px',
            data: detalle,
          });
        },
        error: () => mostrarToastError('No se pudo cargar el detalle.'),
      });
  }

  editarSolicitud(solicitud: SolicitudProrroga): void {
    const ref = this.dialog.open(EditarSolicitudDialogComponent, {
      width: '480px',
      data: solicitud,
    });
    ref.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => { if (result) this.cargar(); });
  }

  cancelarSolicitud(solicitud: SolicitudProrroga): void {
    const ref = this.dialog.open(CancelarSolicitudDialogComponent, {
      width: '480px',
      data: solicitud,
    });
    ref.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => { if (result) this.cargar(); });
  }
}
