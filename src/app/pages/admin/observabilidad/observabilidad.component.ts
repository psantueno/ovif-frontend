import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DATE_LOCALE, MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { AdminBreadcrumb, AdminNavbarComponent } from '../../../shared/components/admin-navbar/admin-navbar.component';
import {
  ObservabilidadAnomalias,
  ObservabilidadFilters,
  ObservabilidadMetricas,
  ObservabilidadRateLimits,
  ObservabilidadService,
} from '../../../services/observabilidad.service';

const ES_AR_DATE_FORMATS = {
  parse: {
    dateInput: null,
    timeInput: null,
  },
  display: {
    dateInput: { day: '2-digit', month: '2-digit', year: 'numeric' },
    timeInput: { hour: '2-digit', minute: '2-digit' },
    monthYearLabel: { month: 'long', year: 'numeric' },
    dateA11yLabel: { day: '2-digit', month: 'long', year: 'numeric' },
    monthYearA11yLabel: { month: 'long', year: 'numeric' },
    timeOptionLabel: { hour: '2-digit', minute: '2-digit' },
  },
};

@Component({
  selector: 'app-observabilidad',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    BaseChartDirective,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
    MatTabsModule,
    MatTooltipModule,
    AdminNavbarComponent,
  ],
  providers: [
    provideNativeDateAdapter(ES_AR_DATE_FORMATS),
    { provide: MAT_DATE_LOCALE, useValue: 'es-AR' },
    provideCharts(withDefaultRegisterables()),
  ],
  templateUrl: './observabilidad.component.html',
  styleUrls: ['./observabilidad.component.scss'],
})
export class ObservabilidadComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly observabilidadService = inject(ObservabilidadService);

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Observabilidad' },
  ];

  readonly methodOptions = ['', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  readonly limiterOptions = ['', 'global', 'login', 'refresh', 'forgot-password', 'reset-password', 'authenticated-user', 'write-burst', 'report-filters', 'report-download', 'pdf-generation', 'pdf-generation-concurrency', 'admin-heavy'];

  readonly filtrosForm = this.fb.group({
    desde: [this.defaultDesde()],
    hasta: [new Date()],
    usuario_id: [''],
    module: [''],
    route_pattern: [''],
    method: [''],
    status_code: [''],
    limiter: [''],
  });

  metricas: ObservabilidadMetricas | null = null;
  rateLimits: ObservabilidadRateLimits | null = null;
  anomalias: ObservabilidadAnomalias | null = null;
  explorerRows: any[] = [];
  explorerTotal = 0;
  explorerPage = 1;
  explorerPageSize = 20;
  loading = false;
  explorerLoading = false;
  error = '';
  explorerError = '';

  readonly slowEndpointColumns = ['method', 'route_pattern', 'total_requests', 'avg_duration_ms', 'p95_duration_ms'];
  readonly limiterColumns = ['limiter', 'total'];
  readonly usuariosAfectadosColumns = ['usuario_id', 'total'];
  readonly eventosColumns = ['fecha', 'limiter', 'usuario_id', 'method', 'route_pattern', 'rate_limit_used', 'rate_limit_limit'];
  readonly explorerColumns = ['fecha', 'usuario_id', 'method', 'route_pattern', 'status_code', 'duration_ms', 'limiter'];
  readonly anomaliasColumns = ['type', 'active', 'severity', 'metrics'];

  requestsDiaChart: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  requestsHoraChart: ChartConfiguration<'bar'>['data'] = { labels: [], datasets: [] };
  statusChart: ChartConfiguration<'doughnut'>['data'] = { labels: [], datasets: [] };
  readonly lineOptions: ChartConfiguration<'line'>['options'] = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } };
  readonly barOptions: ChartConfiguration<'bar'>['options'] = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };
  readonly doughnutOptions: ChartConfiguration<'doughnut'>['options'] = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } };

  ngOnInit(): void {
    this.cargarTodo();
  }

  cargarTodo(): void {
    const validationError = this.validateFilters();
    if (validationError) {
      this.error = validationError;
      this.explorerError = '';
      this.loading = false;
      this.explorerLoading = false;
      return;
    }

    this.loading = true;
    this.error = '';
    const filters = this.getFilters();
    this.observabilidadService.metricas(filters).subscribe({
      next: (metricas) => {
        this.metricas = metricas;
        this.actualizarCharts(metricas);
      },
      error: (error) => {
        this.error = error?.error?.error || 'No se pudieron cargar las métricas.';
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      },
    });
    this.observabilidadService.rateLimitsResumen(filters).subscribe({
      next: (rateLimits) => {
        this.rateLimits = rateLimits;
      },
      error: () => {
        this.rateLimits = null;
      },
    });
    this.observabilidadService.anomalias(filters).subscribe({
      next: (anomalias) => {
        this.anomalias = anomalias;
      },
      error: () => {
        this.anomalias = null;
      },
    });
    this.cargarExplorer();
  }

  cargarExplorer(): void {
    const validationError = this.validateFilters();
    if (validationError) {
      this.explorerRows = [];
      this.explorerTotal = 0;
      this.explorerError = '';
      this.explorerLoading = false;
      return;
    }

    this.explorerLoading = true;
    this.explorerError = '';
    this.observabilidadService.explorer(this.getFilters(), this.explorerPage, this.explorerPageSize).subscribe({
      next: (response) => {
        this.explorerRows = response.data;
        this.explorerTotal = response.total;
      },
      error: (error) => {
        this.explorerRows = [];
        this.explorerTotal = 0;
        this.explorerError = error?.error?.error || 'No se pudo cargar el explorer.';
        this.explorerLoading = false;
      },
      complete: () => {
        this.explorerLoading = false;
      },
    });
  }

  limpiarFiltros(): void {
    this.filtrosForm.reset({
      desde: this.defaultDesde(),
      hasta: new Date(),
      usuario_id: '',
      module: '',
      route_pattern: '',
      method: '',
      status_code: '',
      limiter: '',
    });
    this.explorerPage = 1;
    this.cargarTodo();
  }

  cambiarPaginaExplorer(event: PageEvent): void {
    this.explorerPage = event.pageIndex + 1;
    this.explorerPageSize = event.pageSize;
    this.cargarExplorer();
  }

  exportar(format: 'json' | 'csv'): void {
    const validationError = this.validateFilters();
    if (validationError) {
      this.error = validationError;
      return;
    }

    this.observabilidadService.exportar(this.getFilters(), format).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `observabilidad.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  formatMs(value: number | string | null | undefined): string {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '-';
    return `${Math.round(parsed)} ms`;
  }

  formatNumber(value: number | string | null | undefined): string {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '0';
    return parsed.toLocaleString('es-AR');
  }

  anomalyLabel(type: string): string {
    const labels: Record<string, string> = {
      refresh_loop: 'Refresh loop',
      error_spike: 'Spike de errores',
      slow_endpoint: 'Endpoints lentos',
      pdf_pressure: 'Presión PDF',
      rate_limit_spike: 'Spike rate limit',
    };
    return labels[type] || type;
  }

  private actualizarCharts(metricas: ObservabilidadMetricas): void {
    this.requestsDiaChart = {
      labels: metricas.requestsPorDia.map((row) => row.fecha),
      datasets: [{ data: metricas.requestsPorDia.map((row) => Number(row.requests || 0)), label: 'Requests', borderColor: '#1565c0', backgroundColor: 'rgba(21, 101, 192, 0.12)', tension: 0.25, fill: true }],
    };
    const hours = Array.from({ length: 24 }, (_, hour) => {
      const found = metricas.requestsPorHora.find((row) => Number(row.hora) === hour);
      return { label: `${hour.toString().padStart(2, '0')}:00`, value: Number(found?.requests || 0) };
    });
    this.requestsHoraChart = { labels: hours.map((hour) => hour.label), datasets: [{ data: hours.map((hour) => hour.value), label: 'Requests', backgroundColor: '#00897b' }] };
    this.statusChart = {
      labels: metricas.statusFamilies.map((row) => row.status_family),
      datasets: [{ data: metricas.statusFamilies.map((row) => Number(row.total || 0)), backgroundColor: ['#2e7d32', '#1565c0', '#f9a825', '#ef6c00', '#c62828'] }],
    };
  }

  private getFilters(): ObservabilidadFilters {
    return this.filtrosForm.value as ObservabilidadFilters;
  }

  private validateFilters(): string {
    const { desde, hasta, usuario_id, status_code } = this.filtrosForm.value;
    const desdeDate = this.asValidDate(desde);
    const hastaDate = this.asValidDate(hasta);

    if (!desdeDate || !hastaDate) {
      return 'Seleccioná fechas válidas para filtrar.';
    }

    if (desdeDate.getTime() > hastaDate.getTime()) {
      return 'La fecha "Desde" debe ser menor o igual a la fecha "Hasta".';
    }

    if (usuario_id && !/^\d+$/.test(String(usuario_id).trim())) {
      return 'El Usuario ID debe ser un número entero positivo.';
    }

    if (status_code) {
      const parsedStatus = Number(String(status_code).trim());
      if (!Number.isInteger(parsedStatus) || parsedStatus < 100 || parsedStatus > 599) {
        return 'El Status debe ser un código HTTP válido entre 100 y 599.';
      }
    }

    return '';
  }

  private asValidDate(value: Date | string | null | undefined): Date | null {
    const date = value instanceof Date ? value : value ? new Date(value) : null;
    return date && Number.isFinite(date.getTime()) ? date : null;
  }

  private defaultDesde(): Date {
    const date = new Date();
    date.setDate(date.getDate() - 15);
    return date;
  }
}
