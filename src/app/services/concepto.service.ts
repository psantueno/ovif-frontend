import { catchError, map, Observable, of } from "rxjs";
import { Injectable, inject } from '@angular/core';
import { API_URL } from '../app.config';
import { HttpClient } from "@angular/common/http";

export interface ConceptoSelectOption {
  cod_concepto: number,
  descripcion: string
}

@Injectable({ providedIn: 'root' })
export class ConceptoService {
  private readonly apiUrl = inject(API_URL);
  private readonly http = inject(HttpClient);

  getCatalogoConceptos(): Observable<ConceptoSelectOption[]> {
      return this.http.get<any>(`${this.apiUrl}/conceptos-recaudaciones/select`).pipe(
        map((res) => {
          const raw = Array.isArray(res)
            ? res
            : Array.isArray(res?.conceptos)
              ? res.conceptos
              : [];

          return raw
            .map((item: any) => ({
              cod_concepto: Number(item?.cod_concepto ?? item?.id ?? 0),
              descripcion: String(item?.descripcion ?? '').trim()
            }))
            .filter((item: ConceptoSelectOption) => Number.isInteger(item.cod_concepto) && item.cod_concepto > 0);
        }),
        catchError((err) => {
          console.error('Error obteniendo catálogo de conceptos:', err);
          return of([]);
        })
      );
    }
}
