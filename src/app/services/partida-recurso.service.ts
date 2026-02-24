import { catchError, map, Observable, of } from "rxjs";
import { Injectable, inject } from '@angular/core';
import { API_URL } from '../app.config';
import { HttpClient } from "@angular/common/http";

export interface PartidaRecursoSelectOption {
  partidas_recursos_codigo: number,
  partidas_recursos_descripcion: string
}

@Injectable({ providedIn: 'root' })
export class PartidaRecursoService {
  private readonly apiUrl = inject(API_URL);
  private readonly http = inject(HttpClient);

  getCatalogoPartidasRecursos(): Observable<PartidaRecursoSelectOption[]> {
      return this.http.get<any>(`${this.apiUrl}/partidas-recursos/select`).pipe(
        map((res) => {
          const raw = Array.isArray(res)
            ? res
            : Array.isArray(res?.partidas)
              ? res.partidas
              : [];

          return raw
            .map((item: any) => ({
              partidas_recursos_codigo: Number(item?.partidas_recursos_codigo ?? 0),
              partidas_recursos_descripcion: String(item?.partidas_recursos_descripcion ?? '').trim()
            }))
            .filter((item: PartidaRecursoSelectOption) => Number.isInteger(item.partidas_recursos_codigo) && item.partidas_recursos_codigo > 0);
        }),
        catchError((err) => {
          console.error('Error obteniendo catálogo de partidas de recursos:', err);
          return of([]);
        })
      );
    }
}
