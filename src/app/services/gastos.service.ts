import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { API_URL } from '../app.config';

export interface PartidaGastoResponse {
  partidas_gastos_codigo: number;
  partidas_gastos_descripcion: string;
  partidas_gastos_padre?: number | null;
  partidas_gastos_carga?: number | boolean;
  gastos_importe_devengado?: number | string | null;
  children?: PartidaGastoResponse[];
}

@Injectable({ providedIn: 'root' })
export class GastosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  obtenerPartidas(): Observable<PartidaGastoResponse[]> {
    return this.http
      .get<PartidaGastoResponse[] | null | undefined>(`${this.apiUrl}/gastos/partidas`)
      .pipe(
        map((response) => {
          if (!response) {
            return [];
          }
          return Array.isArray(response) ? response : [];
        }),
        catchError((error) => throwError(() => error))
      );
  }
}
