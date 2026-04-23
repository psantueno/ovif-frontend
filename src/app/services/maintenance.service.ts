import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, catchError, map, tap, shareReplay } from 'rxjs';
import { API_URL } from '../app.config';

@Injectable({ providedIn: 'root' })
export class MaintenanceService {
  private readonly apiUrl = inject(API_URL);
  private readonly http = inject(HttpClient);

  private maintenanceEnabled: boolean | null = null;
  private statusRequest$: Observable<boolean> | null = null;

  checkStatus(): Observable<boolean> {
    if (this.maintenanceEnabled !== null) {
      return of(this.maintenanceEnabled);
    }

    if (!this.statusRequest$) {
      this.statusRequest$ = this.http
        .get<{ maintenance: boolean }>(`${this.apiUrl}/status`)
        .pipe(
          map((res) => res.maintenance === true),
          tap((val) => {
            this.maintenanceEnabled = val;
          }),
          catchError(() => of(false)),
          shareReplay(1)
        );
    }

    return this.statusRequest$;
  }
}
