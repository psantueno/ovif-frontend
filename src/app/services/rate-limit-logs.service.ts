import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../app.config';

export interface RateLimitFilters {
  desde?: Date | string | null;
  hasta?: Date | string | null;
  usuario_id?: number | string | null;
  endpoint?: string | null;
  limiter?: string | null;
  status_code?: number | string | null;
}

export interface RateLimitSummary {
  totalRequests: number;
  total429: number;
  total4xx: number;
  total5xx: number;
  usuariosActivos: number;
  bloqueosPorLimiter: Array<{ limiter: string; total: number }>;
  topEndpoints: any[];
  topUsuarios: any[];
  endpointsLentos: any[];
  patrones: {
    profile401: number;
    refreshRequests: number;
    posibleLoopProfileRefresh: boolean;
  };
}

export interface RateLimitEventsResponse {
  data: any[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class RateLimitLogsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly baseUrl = `${this.apiUrl}/logs/rate-limits`;

  obtenerResumen(filters: RateLimitFilters): Observable<RateLimitSummary> {
    return this.http.get<RateLimitSummary>(`${this.baseUrl}/resumen`, { params: this.toParams(filters) });
  }

  listarUsuarios(filters: RateLimitFilters): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.baseUrl}/usuarios`, { params: this.toParams(filters) });
  }

  listarEndpoints(filters: RateLimitFilters): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.baseUrl}/endpoints`, { params: this.toParams(filters) });
  }

  listarEventos(filters: RateLimitFilters, page = 1, limit = 20): Observable<RateLimitEventsResponse> {
    return this.http.get<RateLimitEventsResponse>(`${this.baseUrl}/eventos`, {
      params: { ...this.toParams(filters), page, limit },
    });
  }

  exportar(filters: RateLimitFilters, format: 'json' | 'csv'): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/informe`, {
      params: { ...this.toParams(filters), format },
      responseType: 'blob',
    });
  }

  private toParams(filters: RateLimitFilters): Record<string, string> {
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
