import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_URL } from '../app.config';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface EjercicioMes {
  ejercicio: number;
  mes: number;
  fecha_inicio: string;
  fecha_fin: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EjerciciosPageResponse {
  data: EjercicioMes[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateEjercicioPayload {
  ejercicio: number;
  mes: number;
  fecha_inicio: string;
  fecha_fin: string;
}

export interface UpdateEjercicioPayload {
  fecha_inicio: string;
  fecha_fin: string;
}

@Injectable({ providedIn: 'root' })
export class EjerciciosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly baseUrl = `${this.apiUrl}/ejercicios`;

  listarEjercicios(params?: { page?: number; limit?: number; year?: number | string }): Observable<EjerciciosPageResponse> {
    const httpParams: Record<string, string> = {};
    if (params?.page) {
      httpParams['page'] = String(params.page);
    }
    if (params?.limit) {
      httpParams['limit'] = String(params.limit);
    }
    if (params?.year) {
      httpParams['year'] = String(params.year);
    }

    return this.http.get<any>(this.baseUrl, { params: httpParams }).pipe(
      map((response) => {
        if (response && Array.isArray(response.data)) {
          return {
            data: response.data.map((item: any) => this.normalizeEjercicio(item)),
            total: Number(response.total) || 0,
            page: Number(response.page) || 1,
            limit: Number(response.limit) || 12
          };
        }
        if (Array.isArray(response)) {
          return {
            data: response.map((item) => this.normalizeEjercicio(item)),
            total: response.length,
            page: 1,
            limit: response.length
          };
        }
        return { data: [], total: 0, page: 1, limit: params?.limit ?? 12 };
      }),
      catchError((error) => throwError(() => error))
    );
  }

  crearEjercicio(payload: CreateEjercicioPayload): Observable<EjercicioMes> {
    return this.http.post<any>(this.baseUrl, payload).pipe(
      map((response) => this.normalizeEjercicio(response)),
      catchError((error) => throwError(() => error))
    );
  }

  actualizarEjercicio(ejercicio: number, mes: number, payload: UpdateEjercicioPayload): Observable<EjercicioMes> {
    return this.http.put<any>(`${this.baseUrl}/${ejercicio}/mes/${mes}`, payload).pipe(
      map((response) => this.normalizeEjercicio(response)),
      catchError((error) => throwError(() => error))
    );
  }

  eliminarEjercicio(ejercicio: number, mes: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${ejercicio}/mes/${mes}`).pipe(
      catchError((error) => throwError(() => error))
    );
  }

  private normalizeEjercicio(data: any): EjercicioMes {
    return {
      ejercicio: Number(data?.ejercicio) || 0,
      mes: Number(data?.mes) || 0,
      fecha_inicio: this.toDateString(data?.fecha_inicio),
      fecha_fin: this.toDateString(data?.fecha_fin),
      createdAt: data?.createdAt ?? data?.created_at ?? undefined,
      updatedAt: data?.updatedAt ?? data?.updated_at ?? undefined
    };
  }

  private toDateString(value: any): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'string') {
      const [datePart] = value.split('T');
      if (datePart) {
        return datePart;
      }
    }

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }

    return '';
  }
}
