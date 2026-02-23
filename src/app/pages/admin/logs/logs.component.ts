import { Component, OnInit, ViewChild, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator } from '@angular/material/paginator';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { LogDetailModalComponent } from './log-dialog.component';

import { MAT_DATE_LOCALE } from '@angular/material/core';
import { provideNativeDateAdapter } from '@angular/material/core';

// services
import { MunicipioService, MunicipioSelectOption } from '../../../services/municipio.service';
import { EjerciciosService, EjerciciosSelectOption } from '../../../services/ejercicios.service';
import { LogsService, Log } from '../../../services/logs.service';
import { AdminNavbarComponent, AdminBreadcrumb } from '../../../shared/components/admin-navbar/admin-navbar.component';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatDialogModule,
    MatTableModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatCardModule,
    MatChipsModule,
    ReactiveFormsModule,
    MatPaginatorModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    AdminNavbarComponent,
  ],
  templateUrl: './logs.component.html',
  styleUrls: ['./logs.component.scss'],
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
  ]
})

export class LogsComponent implements OnInit {
  displayedColumns: string[] = ['id_log', 'nombre_tarea', 'ejercicio', 'mes', 'municipio_id', 'estado', 'mensaje', 'fecha', 'acciones'];
  dataSource = new MatTableDataSource<Log>([]);
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  totalRegistros: number = 0;

  pagina: number = 1;
  limite: number = 10;

  filtroForm: FormGroup;

  municipios: MunicipioSelectOption[] = [];
  ejercicios: EjerciciosSelectOption[] = [];
  estados: string[] = ['OK', 'ERROR'];
  logs: Log[] = [];
  selectedRow: Log | null = null;

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Logs del Sistema' }
  ];

  constructor(
    private dialog: MatDialog,
    private fb: FormBuilder,
    private municipiosService: MunicipioService,
    private ejerciciosService: EjerciciosService,
    private logsService: LogsService
  ) {
    this.filtroForm = this.fb.group({
      ejercicio: [''],
      mes: [''],
      municipio_id: [''],
      estado: [''],
      desde: [''],
      hasta: ['']
    });
  }

  ngOnInit(): void {
    this.cargarMunicipios();
    this.cargarEjercicios();
    this.cargarLogs();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  cargarMunicipios() {
    this.municipiosService.getCatalogoMunicipios().subscribe({
      next: (response) => {
        this.municipios = response;
      },
      error: (error) => {
        console.error('Error cargando municipios:', error);
      }
    });
  }

  cargarEjercicios() {
    this.ejerciciosService.listarCatalogoEjercicios().subscribe({
      next: (response) => {
        this.ejercicios = response;
      },
      error: (error) => {
        console.error('Error cargando ejercicios:', error);
      }
    });
  }

  cargarLogs() {
    const filtros = this.filtroForm.value;
    this.logsService.listarLogs({ page: this.pagina, limit: this.limite }, filtros).subscribe({
      next: (response) => {
        console.log('Logs cargados:', response.data);
        this.dataSource.data = response.data;
        this.totalRegistros = response.total;
        this.logs = response.data;
      }
    });
  }

  limpiarFiltros(){
    this.filtroForm = this.fb.group({
      ejercicio: [''],
      mes: [''],
      municipio_id: [''],
      estado: [''],
      desde: [''],
      hasta: ['']
    });
  }

  cambiarPagina(event: PageEvent) {
    console.log("Nueva pagina ", event.pageIndex)
    console.log("Nuevo size ", event.pageSize)
    this.pagina = event.pageIndex + 1;
    this.limite = event.pageSize;
    this.cargarLogs()
  }

  verDetalle(log: Log) {
    const logData = { ...log }
    logData.municipio_nombre = this.getMunicipioNombre(log.municipio_id);
    this.dialog.open(LogDetailModalComponent, {
      data: logData,
      width: '650px',
      maxHeight: '90vh',
      panelClass: 'log-detail-dialog',
      autoFocus: false,
      disableClose: false
    });
  }

  cerrarDetalle() {
    this.selectedRow = null;
  }

  getMunicipioNombre(municipioId: number | undefined): string {
    const municipio = this.municipios.find(m => m.municipio_id === municipioId);
    return municipio ? municipio.municipio_nombre : 'Todos';
  }

  getMesNombre(mes: number | undefined): string {
    if(!mes) return "";

    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[mes - 1];
  }

  getEstadoColor(estado: string): string {
    switch (estado) {
      case 'OK': return 'primary';
      case 'ERROR': return 'warn';
      default: return 'primary';
    }
  }

  obtenerFechaMinima(fecha: Date | null): Date | null{
    if(!fecha) return null;

    const dia = fecha.getDate();
    const mes = fecha.getMonth();
    const anio = fecha.getFullYear();

    return new Date(anio, mes, dia + 1)
  }

  obtenerFechaMaxima(fecha: Date | null): Date | null{
    if(!fecha) return null;

    const dia = fecha.getDate();
    const mes = fecha.getMonth();
    const anio = fecha.getFullYear();

    return new Date(anio, mes, dia - 1)
  }
}




