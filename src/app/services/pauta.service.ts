import { catchError, map, Observable, of } from "rxjs";
import { Injectable, inject } from '@angular/core';
import { API_URL } from '../app.config';
import { HttpClient } from "@angular/common/http";

export interface PautaSelectOption {
  pauta_id: number;
  descripcion: string;
  tipo_pauta_id?: number | null;
  tipo_pauta_codigo?: string | null;
  tipo_pauta_nombre?: string | null;
  tipo_pauta_descripcion?: string | null;
  requiere_periodo_rectificar?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PautaService {
  private readonly apiUrl = inject(API_URL);
  private readonly http = inject(HttpClient);

  getCatalogoPautas(): Observable<PautaSelectOption[]> {
      return this.http.get<any>(`${this.apiUrl}/pautas-convenio/select`).pipe(
        map((res) => {
          const raw = Array.isArray(res)
            ? res
            : Array.isArray(res?.pautas)
              ? res.pautas
              : [];

          return raw
            .map((item: any) => ({
              pauta_id: Number(item?.pauta_id ?? item?.id ?? 0),
              descripcion: String(item?.pauta_descripcion ?? item?.descripcion ?? '').trim(),
              tipo_pauta_id: item?.tipo_pauta_id === undefined || item?.tipo_pauta_id === null
                ? null
                : Number(item.tipo_pauta_id),
              tipo_pauta_codigo: item?.tipo_pauta_codigo ? String(item.tipo_pauta_codigo) : null,
              tipo_pauta_nombre: item?.tipo_pauta_nombre ? String(item.tipo_pauta_nombre) : null,
              tipo_pauta_descripcion: item?.tipo_pauta_descripcion ? String(item.tipo_pauta_descripcion) : null,
              requiere_periodo_rectificar: Boolean(item?.requiere_periodo_rectificar)
            }))
            .filter((item: PautaSelectOption) => Number.isInteger(item.pauta_id) && item.pauta_id > 0);
        }),
        catchError((err) => {
          console.error('Error obteniendo catálogo de convenios:', err);
          return of([]);
        })
      );
    }
}
