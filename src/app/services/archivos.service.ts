import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';
import { API_URL } from '../app.config';

export interface ArchivoMunicipio {
  archivo_id?: number;
  archivo_descripcion: string;
  archivo_path: string;
  archivo_ejercicio?: number;
  archivo_mes?: number;
  municipio_id?: number;
  created_at?: string;
  updated_at?: string;
}

@Injectable({ providedIn: 'root' })
export class ArchivosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  listarArchivos(municipioId: number, ejercicio: number, mes: number): Observable<ArchivoMunicipio[]> {
    const params = new HttpParams()
      .set('ejercicio', String(ejercicio))
      .set('mes', String(mes));

    return this.http
      .get<any>(`${this.apiUrl}/municipios/${municipioId}/archivos`, { params })
      .pipe(
        map((response) => {
          if (Array.isArray(response)) {
            return response;
          }
          if (Array.isArray(response?.archivos)) {
            return response.archivos;
          }
          if (response?.data && Array.isArray(response.data)) {
            return response.data;
          }
          return [];
        }),
        catchError((error) => throwError(() => error))
      );
  }

  subirArchivo(
    municipioId: number,
    ejercicio: number,
    mes: number,
    archivo: File,
    descripcion?: string | null
  ): Observable<any> {
    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('ejercicio', String(ejercicio));
    formData.append('mes', String(mes));

    if (descripcion) {
      formData.append('descripcion', descripcion);
    }

    return this.http
      .post(`${this.apiUrl}/municipios/${municipioId}/archivos`, formData)
      .pipe(catchError((error) => throwError(() => error)));
  }
}
