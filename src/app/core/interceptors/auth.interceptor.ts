import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, Observable, shareReplay, switchMap, throwError } from 'rxjs';
import { API_URL } from '../../app.config';

/** Single-flight: solo un refresh a la vez */
let refreshInProgress$: Observable<any> | null = null;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Capturamos inject() en el contexto de inyección del interceptor
  const http = inject(HttpClient);
  const apiUrl = inject(API_URL);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isAuthUrl(req.url)) {
        // Single-flight refresh
        if (!refreshInProgress$) {
          refreshInProgress$ = http.post(`${apiUrl}/auth/refresh`, {}).pipe(
            shareReplay(1),
            catchError((refreshError) => {
              refreshInProgress$ = null;
              localStorage.removeItem('municipioSeleccionado');
              router.navigate(['/login']);
              return throwError(() => refreshError);
            }),
          );
        }

        return refreshInProgress$.pipe(
          switchMap(() => {
            refreshInProgress$ = null;
            return next(req.clone());
          }),
          catchError((err) => {
            refreshInProgress$ = null;
            return throwError(() => err);
          })
        );
      }
      return throwError(() => error);
    })
  );
};

function isAuthUrl(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/refresh');
}