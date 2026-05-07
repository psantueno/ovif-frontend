import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../app.config';

export interface ObservabilidadFilters {
  desde?: Date | string | null;
  hasta?: Date | string | null;
  usuario_id?: number | string | null;
  module?: string | null;
  route_pattern?: string | null;
  endpoint?: string | null;
  method?: string | null;
  status_code?: number | string | null;
  limiter?: string | null;
}

export interface ObservabilidadMetricas {
  periodo: { desde: string; hasta: string };
  kpis: {
    totalRequests: number;
    total4xx: number;
    total5xx: number;
    total429: number;
    avgDurationMs: number;
    p95DurationMs: number;
    usuariosActivos: number | null;
    usuariosActivosExacto: boolean;
  };
  requestsPorDia: Array<{ fecha: string; requests: number; avg_duration_ms: number }>;
  requestsPorHora: Array<{ hora: number; requests: number }>;
  statusFamilies: Array<{ status_family: string; total: number }>;
  modules: Array<{ module: string; total_requests: number; total_4xx: number; total_5xx: number; avg_duration_ms: number }>;
  topEndpointsLentos: Array<{
    route_pattern: string;
    method: string;
    total_requests: number;
    avg_duration_ms: number;
    max_duration_ms: number;
    p95_duration_ms: number;
  }>;
}

export interface ObservabilidadRateLimits {
  bloqueosPorLimiter: Array<{ limiter: string; total: number }>;
  usuariosAfectados: Array<{ usuario_id: number; total: number }>;
  eventosRecientes: any[];
}

export interface ObservabilidadExplorerResponse {
  data: any[];
  total: number;
  page: number;
  limit: number;
}

export interface ObservabilidadAnomalias {
  anomalias: Array<{ type: string; active: boolean; severity: string; metrics: any }>;
  thresholds: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class ObservabilidadService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly baseUrl = `${this.apiUrl}/logs/observabilidad`;

  metricas(filters: ObservabilidadFilters): Observable<ObservabilidadMetricas> {
    return this.http.get<ObservabilidadMetricas>(`${this.baseUrl}/metricas`, { params: this.toParams(filters) });
  }

  rateLimitsResumen(filters: ObservabilidadFilters): Observable<ObservabilidadRateLimits> {
    return this.http.get<ObservabilidadRateLimits>(`${this.baseUrl}/rate-limits-resumen`, { params: this.toParams(filters) });
  }

  explorer(filters: ObservabilidadFilters, page = 1, limit = 20): Observable<ObservabilidadExplorerResponse> {
    return this.http.get<ObservabilidadExplorerResponse>(`${this.baseUrl}/explorer`, {
      params: { ...this.toParams(filters), page, limit },
    });
  }

  anomalias(filters: ObservabilidadFilters): Observable<ObservabilidadAnomalias> {
    return this.http.get<ObservabilidadAnomalias>(`${this.baseUrl}/anomalias`, { params: this.toParams(filters) });
  }

  userJourney(usuarioId: number, filters: ObservabilidadFilters, page = 1, limit = 50): Observable<ObservabilidadExplorerResponse> {
    return this.http.get<ObservabilidadExplorerResponse>(`${this.baseUrl}/user-journey/${usuarioId}`, {
      params: { ...this.toParams(filters), page, limit },
    });
  }

  exportar(filters: ObservabilidadFilters, format: 'json' | 'csv'): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/informe`, {
      params: { ...this.toParams(filters), format },
      responseType: 'blob',
    });
  }

  private toParams(filters: ObservabilidadFilters): Record<string, string> {
    const params: Record<string, string> = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      if (value instanceof Date) {
        params[key] = value.toISOString().split('T')[0];
      } else {
        params[key] = String(value);
      }
    });
    return params;
  }
}
