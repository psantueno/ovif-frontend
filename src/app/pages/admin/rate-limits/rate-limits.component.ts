import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import { AdminBreadcrumb, AdminNavbarComponent } from '../../../shared/components/admin-navbar/admin-navbar.component';
import { RateLimitFilters, RateLimitLogsService, RateLimitSummary } from '../../../services/rate-limit-logs.service';

@Component({
  selector: 'app-rate-limits',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    MatTooltipModule,
    AdminNavbarComponent,
  ],
  templateUrl: './rate-limits.component.html',
  styleUrls: ['./rate-limits.component.scss'],
  providers: [provideNativeDateAdapter()],
})
export class RateLimitsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly rateLimitLogsService = inject(RateLimitLogsService);

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Admin', link: '/admin' },
    { label: 'Observabilidad y Rate Limits' },
  ];

  readonly limiterOptions = [
    'global',
    'login',
    'refresh',
    'forgot-password',
    'reset-password',
    'authenticated-user',
    'write-burst',
    'report-filters',
    'report-download',
    'pdf-generation',
    'pdf-generation-concurrency',
    'admin-heavy',
  ];

  readonly filtrosForm = this.fb.group({
    desde: [this.defaultDesde()],
    hasta: [new Date()],
    usuario_id: [''],
    endpoint: [''],
    limiter: [''],
    status_code: [''],
  });

  resumen: RateLimitSummary | null = null;
  usuarios: any[] = [];
  endpoints: any[] = [];
  eventos: any[] = [];
  totalEventos = 0;
  page = 1;
  pageSize = 20;
  cargando = false;

  readonly limiterColumns = ['limiter', 'total'];
  readonly userColumns = ['usuario_id', 'total_requests', 'total_429', 'avg_duration_ms', 'ultimo_request'];
  readonly endpointColumns = ['method', 'route_pattern', 'total_requests', 'total_429', 'avg_duration_ms', 'p95_duration_ms'];
  readonly eventColumns = ['fecha', 'limiter', 'usuario_id', 'method', 'route_pattern', 'rate_limit_used', 'rate_limit_limit'];

  ngOnInit(): void {
    this.cargarInforme();
  }

  cargarInforme(): void {
    const filters = this.getFilters();
    this.cargando = true;
    this.rateLimitLogsService.obtenerResumen(filters).subscribe({
      next: (resumen) => {
        this.resumen = resumen;
        this.usuarios = resumen.topUsuarios || [];
        this.endpoints = resumen.topEndpoints || [];
      },
      complete: () => {
        this.cargando = false;
      },
    });
    this.cargarEventos();
  }

  cargarEventos(): void {
    this.rateLimitLogsService.listarEventos(this.getFilters(), this.page, this.pageSize).subscribe({
      next: (response) => {
        this.eventos = response.data;
        this.totalEventos = response.total;
      },
    });
  }

  limpiarFiltros(): void {
    this.filtrosForm.reset({
      desde: this.defaultDesde(),
      hasta: new Date(),
      usuario_id: '',
      endpoint: '',
      limiter: '',
      status_code: '',
    });
    this.page = 1;
    this.cargarInforme();
  }

  cambiarPagina(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.cargarEventos();
  }

  exportar(format: 'json' | 'csv'): void {
    this.rateLimitLogsService.exportar(this.getFilters(), format).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `rate-limits.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  formatMs(value: number | string | null | undefined): string {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '-';
    return `${Math.round(parsed)} ms`;
  }

  private getFilters(): RateLimitFilters {
    return this.filtrosForm.value as RateLimitFilters;
  }

  private defaultDesde(): Date {
    const date = new Date();
    date.setDate(date.getDate() - 15);
    return date;
  }
}
