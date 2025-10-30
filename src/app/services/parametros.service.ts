import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_URL } from '../app.config';

export interface ParametrosEjercicioFiscal {
  cierreDia: number;
  mesesOffset: number;
}

@Injectable({ providedIn: 'root' })
export class ParametrosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  private ejercicioFiscal$?: Observable<ParametrosEjercicioFiscal>;

  getParametrosEjercicioFiscal(): Observable<ParametrosEjercicioFiscal> {
    if (!this.ejercicioFiscal$) {
      this.ejercicioFiscal$ = this.http
        .get<{ cierreDia: number; mesesOffset: number }>(`${this.apiUrl}/parametros/ejercicio-fiscal`)
        .pipe(
          map((response) => ({
            cierreDia: Number(response?.cierreDia) || 1,
            mesesOffset: Number(response?.mesesOffset) || 0
          })),
          shareReplay({ bufferSize: 1, refCount: true })
        );
    }
    return this.ejercicioFiscal$;
  }
}
