import { catchError, map, Observable, of } from "rxjs";
import { Injectable, inject } from '@angular/core';
import { API_URL } from '../app.config';
import { HttpClient } from "@angular/common/http";

export interface MunicipioMailSelectOption {
  email: string,
}

@Injectable({ providedIn: 'root' })
export class MunicipioMailService {
  private readonly apiUrl = inject(API_URL);
  private readonly http = inject(HttpClient);

  getCatalogoMunicipiosMails(): Observable<MunicipioMailSelectOption[]> {
      return this.http.get<any>(`${this.apiUrl}/municipios-mails/select`).pipe(
        map((res) => {
          const raw = Array.isArray(res)
            ? res
            : Array.isArray(res?.mails)
              ? res.mails
              : [];

          return raw
            .map((item: any) => ({
              email: String(item?.email ?? '').trim(),
            }))
            .filter((item: MunicipioMailSelectOption) => item.email);
        }),
        catchError((err) => {
          console.error('Error obteniendo catálogo de mails de municipios:', err);
          return of([]);
        })
      );
    }
}
