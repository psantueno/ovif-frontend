import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, shareReplay, switchMap, throwError } from 'rxjs';
import { API_URL } from '../../app.config';
import { AuthService } from '../../services/auth.service';

/** Single-flight: solo un refresh a la vez */
let refreshInProgress$: Observable<any> | null = null;

const RETRIED_HEADER = 'X-Retried';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const http = inject(HttpClient);
  const apiUrl = inject(API_URL);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // No intentar refresh si: no es 401, es URL de auth, ya se reintentó, o se está deslogueando
      if (
        error.status !== 401 ||
        isAuthUrl(req.url) ||
        req.headers.has(RETRIED_HEADER) ||
        authService.isLoggingOut
      ) {
        return throwError(() => error);
      }

      // Single-flight refresh
      if (!refreshInProgress$) {
        refreshInProgress$ = http.post(`${apiUrl}/auth/refresh`, {}).pipe(
          shareReplay(1),
          catchError((refreshError) => {
            refreshInProgress$ = null;
            // Refresh falló → sesión muerta en el servidor, limpiar localmente
            authService.handleSessionExpired();
            return throwError(() => refreshError);
          }),
        );
      }

      return refreshInProgress$.pipe(
        switchMap(() => {
          refreshInProgress$ = null;
          // Reintentar con header de marca para evitar loop infinito
          const retried = req.clone({
            setHeaders: { [RETRIED_HEADER]: '1' }
          });
          return next(retried);
        }),
        catchError((err) => {
          refreshInProgress$ = null;
          return throwError(() => err);
        })
      );
    })
  );
};

function isAuthUrl(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/logout');
}
