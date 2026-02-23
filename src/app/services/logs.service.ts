import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_URL } from '../app.config';
import { EjerciciosPageResponse } from './ejercicios.service';

export interface Log {
  id_log: number;
  nombre_tarea: string;
  ejercicio?: number;
  mes?: number;
  municipio_id?: number;
  municipio_nombre?: string;
  estado: string;
  mensaje: string;
  fecha: Date;
}

export interface LogsPageResponse {
  data: Log[];
  total: number;
  page: number;
  limit: number;
}

@Injectable({ providedIn: 'root' })
export class LogsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly baseUrl = `${this.apiUrl}/logs`;

  listarLogs(params?: { page?: number; limit?: number; }, filters?: { ejercicio?: number, mes?: number, municipio_id?: number, estado?: string, desde?: Date, hasta?: Date }): Observable<LogsPageResponse>{
    const httpParams: Record<string, string> = {};
    if (params?.page) {
      httpParams['page'] = String(params.page);
    }
    if (params?.limit) {
      httpParams['limit'] = String(params.limit);
    }
    if (filters?.ejercicio) {
      httpParams['ejercicio'] = String(filters.ejercicio);
    }
    if (filters?.mes) {
      httpParams['mes'] = String(filters.mes);
    }
    if (filters?.municipio_id) {
      httpParams['municipio_id'] = String(filters.municipio_id);
    }
    if (filters?.estado) {
      httpParams['estado'] = filters.estado;
    }
    if (filters?.desde) {
      httpParams['desde'] = filters.desde.toISOString().split('T')[0];
    }
    if (filters?.hasta) {
      httpParams['hasta'] = filters.hasta.toISOString().split('T')[0];
    }

    return this.http.get<LogsPageResponse>(this.baseUrl, { params: httpParams }).pipe(
      map(response => {
        return {
          data: response.data.map(log => ({
            ...log,
            fecha: new Date(log.fecha)
          })),
          total: response.total,
          page: response.page,
          limit: response.limit
        };
      })
    );
  }
}
