import { Injectable, inject, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, finalize, map, of, shareReplay, tap, timeout } from 'rxjs';
import { API_URL } from '../app.config';
import Swal from 'sweetalert2';
import { MunicipioService } from './municipio.service';
import { getLandingPathByRoles, getUserRoleNames } from '../core/utils/roles.util';
import { resetRefreshState } from '../core/interceptors/auth.interceptor';

/** Minimum elapsed time (ms) before re-checking session on visibility change. */
const VISIBILITY_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable({ providedIn: 'root' })

export class AuthService {
  private apiUrl = inject(API_URL);
  private http = inject(HttpClient);
  private router = inject(Router);
  private municipioService = inject(MunicipioService);
  private ngZone = inject(NgZone);

  private user: any = null;
  private readonly userSubject = new BehaviorSubject<any | null>(null);
  readonly user$ = this.userSubject.asObservable();
  private profileRequest$: Observable<any | null> | null = null;
  private loggingOut = false;

  /** Once true, no more profile/refresh attempts are made until next login. */
  private sessionDead = false;

  /** Tracks whether user was authenticated at any point during this app lifecycle. */
  private wasAuthenticated = false;

  /** Emits true when session expires — consumed by the overlay in AppComponent. */
  private readonly sessionExpiredSubject = new BehaviorSubject<boolean>(false);
  readonly sessionExpired$ = this.sessionExpiredSubject.asObservable();

  /** Timestamp of last successful profile verification. */
  private lastVerifiedAt = 0;

  constructor() {
    this.setupVisibilityCheck();
  }

  get isLoggingOut(): boolean {
    return this.loggingOut;
  }

  get isSessionDead(): boolean {
    return this.sessionDead;
  }

  private setUser(user: any | null): void {
    this.user = user ?? null;
    if (this.user) {
      this.wasAuthenticated = true;
    }
    this.userSubject.next(this.user);
  }

  private normalizeUserPayload(payload: any): any | null {
    if (!payload) {
      return null;
    }
    if (payload.user) {
      return payload.user;
    }
    return payload;
  }

  private clearSessionState(): void {
    this.setUser(null);
    this.profileRequest$ = null;
    this.municipioService.clear();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('municipioSeleccionado');
    localStorage.removeItem('ejercicioMesSeleccionado');
  }

  ensureUser(): Observable<any | null> {
    if (this.loggingOut || this.sessionDead) {
      return of(null);
    }

    if (this.user) {
      this.lastVerifiedAt = Date.now();
      return of(this.user);
    }

    if (!this.profileRequest$) {
      this.profileRequest$ = this.profile().pipe(
        map((res) => this.normalizeUserPayload(res)),
        tap((usuario) => {
          this.setUser(usuario);
          if (usuario) {
            this.lastVerifiedAt = Date.now();
          }
        }),
        catchError(() => {
          this.setUser(null);
          return of(null);
        }),
        finalize(() => {
          this.profileRequest$ = null;
        }),
        shareReplay(1)
      );
    }

    return this.profileRequest$;
  }

  login(usuario: string, password: string): Observable<any> {
    // Reset dead-session state so fresh login works cleanly
    this.sessionDead = false;
    this.sessionExpiredSubject.next(false);
    resetRefreshState();

    return new Observable((observer) => {
      this.http
        .post(`${this.apiUrl}/auth/login`, { usuario, password })
        .subscribe({
          next: (res: any) => {
            // Limpieza previa
            this.municipioService.clear();
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Guardar datos del usuario (cookies se setean automáticamente)
            this.setUser(res.user);

            const roleNames = getUserRoleNames(res.user);
            const isAdmin = roleNames.includes('administrador');
            const isOperador = roleNames.includes('operador');
            const landingPath = getLandingPathByRoles(roleNames);

            if (isAdmin) {
              this.router.navigate(['/admin']);
              observer.next(res);
              observer.complete();
              return;
            }

            // ✅ Paso adicional: verificar municipios antes de navegar
            this.obtenerMisMunicipios().subscribe({
              next: (municipios) => {
                const hasMunicipios = Array.isArray(municipios) && municipios.length > 0;

                if (!hasMunicipios) {
                  this.municipioService.clear();
                  if (isOperador) {
                    Swal.fire({
                      icon: 'warning',
                      title: 'Acceso no disponible',
                      text: 'Tu usuario no tiene municipios asignados. Contactá al administrador.',
                      confirmButtonColor: '#2b3e4c',
                    }).then(() => {
                      this.router.navigate(['/sin-acceso']);
                    });
                  } else {
                    this.router.navigate(['/sin-acceso']);
                  }
                } else if (municipios.length === 1) {
                  this.municipioService
                    .setMunicipio(municipios[0], { silent: true })
                    .then(() => {
                      this.router.navigate([landingPath]);
                    });
                } else {
                  this.municipioService.clear();
                  this.router.navigate(['/']);
                }

                observer.next(res);
                observer.complete();
              },
              error: (err) => {
                console.error('❌ Error al obtener municipios:', err);
                Swal.fire({
                  icon: 'error',
                  title: 'Error al obtener municipios',
                  text: 'No se pudo verificar la asignación de municipios. Intentalo nuevamente.',
                  confirmButtonColor: '#2b3e4c',
                });
                this.router.navigate(['/login']);
                observer.error(err);
              },
            });
          },
          error: (err) => {
            console.error('❌ Error en login:', err);

            // ✅ Tu lógica original de manejo de errores se mantiene igual
            if (err.status === 403 && err.error?.code === 'USER_DISABLED') {
              Swal.fire({
                icon: 'warning',
                title: 'Usuario deshabilitado',
                text:
                  err.error.error ||
                  'Tu cuenta se encuentra deshabilitada. Contactá al administrador.',
                confirmButtonColor: '#2b3e4c',
              });
            } else if (err.status === 401) {
              Swal.fire({
                icon: 'error',
                title: 'Credenciales inválidas',
                text: err.error.error || 'Usuario o contraseña incorrectos.',
                confirmButtonColor: '#2b3e4c',
              });
            } else {
              Swal.fire({
                icon: 'error',
                title: 'Error en el inicio de sesión',
                text: 'Ocurrió un error inesperado. Intentalo nuevamente.',
                confirmButtonColor: '#2b3e4c',
              });
            }

            observer.error(err);
          },
        });
    });
  }



  /** Limpieza local cuando la sesión expiró o fue revocada (sin POST al servidor). */
  handleSessionExpired(): void {
    if (this.loggingOut || this.sessionDead) {
      return;
    }
    this.sessionDead = true;
    this.clearSessionState();
    // Only show overlay if user was authenticated during this app lifecycle.
    // On a fresh page load with no valid session, just let the guard redirect to /login.
    if (this.wasAuthenticated) {
      this.sessionExpiredSubject.next(true);
    }
  }

  /** Called when user acknowledges the session-expired overlay. */
  acknowledgeSessionExpired(): void {
    this.sessionExpiredSubject.next(false);
    this.router.navigate(['/login']);
  }

  logout(): Observable<void> {
    if (this.loggingOut) {
      return of(void 0);
    }

    this.loggingOut = true;
    this.sessionDead = true;
    this.clearSessionState();
    this.router.navigate(['/login']);

    // Fire-and-forget: notificar al servidor sin bloquear la UX
    this.http.post(`${this.apiUrl}/auth/logout`, {}, { observe: 'response' }).pipe(
      timeout(3000),
      catchError(() => of(null)),
      finalize(() => {
        this.loggingOut = false;
      })
    ).subscribe();

    return of(void 0);
  }

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/change-password`, { oldPassword, newPassword });
  }

  profile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/profile`);
  }

  obtenerMisMunicipios(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/usuarios/me/municipios`);
  }

  isLoggedIn(): boolean {
    return !!this.user;
  }

  getUser() {
    return this.user;
  }

  /**
   * Listens for tab/window becoming visible again.
   * If enough time has passed, proactively verifies the session.
   */
  private setupVisibilityCheck(): void {
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        if (this.sessionDead || this.loggingOut || !this.user) return;
        if (Date.now() - this.lastVerifiedAt < VISIBILITY_CHECK_INTERVAL_MS) return;

        // Re-enter Angular zone so subscribers react
        this.ngZone.run(() => {
          this.profileRequest$ = null; // force fresh request
          this.ensureUser().subscribe();
        });
      });
    });
  }

  // solicitar blanqueo
  requestPasswordResetByUser(usuario: string) {
    return this.http.post(`${this.apiUrl}/auth/forgot-password`, { usuario });
  }

  confirmPasswordReset(token: string, newPassword: string) {
    return new Observable((observer) => {
      this.http
        .post(`${this.apiUrl}/auth/reset-password`, { token, newPassword })
        .subscribe({
          next: (res: any) => {
            // 🎉 Alerta de éxito con confirmación manual
            Swal.fire({
              icon: 'success',
              title: 'Contraseña actualizada',
              text: 'Tu contraseña fue modificada correctamente. Ahora podés iniciar sesión con tu nueva contraseña.',
              confirmButtonText: 'Ir al inicio de sesión',
              confirmButtonColor: '#2b3e4c',
              allowOutsideClick: false,
            }).then((result) => {
              if (result.isConfirmed) {
                this.router.navigate(['/login']);
              }
            });

            observer.next(res);
            observer.complete();
          },
          error: (err) => {
            console.error('❌ Error al confirmar blanqueo de contraseña:', err);

            Swal.fire({
              icon: 'error',
              title: 'Error al restablecer contraseña',
              text:
                err.error?.message ||
                'No se pudo actualizar la contraseña. Verificá el enlace o intentá nuevamente.',
              confirmButtonColor: '#2b3e4c',
            });

            observer.error(err);
          },
        });
    });
  }

}
