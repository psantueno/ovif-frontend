import { catchError, map, Observable, of } from "rxjs";
import { Injectable, inject } from '@angular/core';
import { API_URL } from '../app.config';
import { HttpClient } from "@angular/common/http";

export interface ConvenioSelectOption {
  convenio_id: number,
  nombre: string
}

@Injectable({ providedIn: 'root' })
export class ConvenioService {
  private readonly apiUrl = inject(API_URL);
  private readonly http = inject(HttpClient);

  getCatalogoConvenios(): Observable<ConvenioSelectOption[]> {
      return this.http.get<any>(`${this.apiUrl}/convenios/select`).pipe(
        map((res) => {
          const raw = Array.isArray(res)
            ? res
            : Array.isArray(res?.convenios)
              ? res.convenios
              : [];

          return raw
            .map((item: any) => ({
              convenio_id: Number(item?.convenio_id ?? item?.id ?? 0),
              nombre: String(item?.convenio_nombre ?? item?.nombre ?? '').trim()
            }))
            .filter((item: ConvenioSelectOption) => Number.isInteger(item.convenio_id) && item.convenio_id > 0);
        }),
        catchError((err) => {
          console.error('Error obteniendo catálogo de convenios:', err);
          return of([]);
        })
      );
    }
}
