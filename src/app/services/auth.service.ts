import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { API_URL } from '../app.config';
import Swal from 'sweetalert2'; // 👈 asegurate de tenerlo importado
import { MunicipioService } from './municipio.service';

@Injectable({ providedIn: 'root' })

export class AuthService {
  private apiUrl = inject(API_URL);
  private http = inject(HttpClient);
  private router = inject(Router);
  private municipioService = inject(MunicipioService);

  private user: any = null;
  private readonly operadorSinMunicipiosKey = 'operadorSinMunicipios';

  private extractRoleNames(user: any): string[] {
    if (!user) {
      return [];
    }

    const rawRoles = Array.isArray(user?.Roles)
      ? user.Roles
      : Array.isArray(user?.roles)
        ? user.roles
        : [];

    const roleNames = rawRoles
      .map((rol: any) => {
        if (typeof rol === 'string') {
          return rol;
        }
        if (rol && typeof rol?.nombre === 'string') {
          return rol.nombre;
        }
        return null;
      })
      .filter((nombre: string | null | undefined): nombre is string => typeof nombre === 'string' && nombre.length > 0)
      .map((nombre: string) => nombre.trim().toLowerCase());

    const inlineRoles = [user?.rol, user?.Rol, user?.role]
      .filter((nombre: unknown): nombre is string => typeof nombre === 'string' && nombre.length > 0)
      .map((nombre: string) => nombre.trim().toLowerCase());

    return Array.from(new Set([...roleNames, ...inlineRoles]));
  }

  login(usuario: string, password: string): Observable<any> {
    return new Observable((observer) => {
      this.http
        .post(`${this.apiUrl}/auth/login`, { usuario, password })
        .subscribe({
          next: (res: any) => {
            // Limpieza previa
            localStorage.removeItem('municipioSeleccionado');
            localStorage.removeItem(this.operadorSinMunicipiosKey);

            // Guardar datos del usuario y token
            this.user = res.user;
            localStorage.setItem('token', res.token);
            localStorage.setItem('user', JSON.stringify(res.user));

            const roleNames = this.extractRoleNames(this.user);
            const isAdmin = roleNames.includes('administrador');
            const isOperador = roleNames.includes('operador');

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
                    localStorage.setItem(this.operadorSinMunicipiosKey, 'true');
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
                      this.router.navigate(['/home']);
                    });
                } else {
                  this.municipioService.clear();
                  this.router.navigate(['/']);
                }

                if (hasMunicipios || !isOperador) {
                  localStorage.removeItem(this.operadorSinMunicipiosKey);
                }

                observer.next(res);
                observer.complete();
              },
              error: (err) => {
                console.error('❌ Error al obtener municipios:', err);
                localStorage.removeItem(this.operadorSinMunicipiosKey);
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



  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/logout`, {}).pipe(
      tap(() => {
        this.user = null;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('municipioSeleccionado');
        localStorage.removeItem(this.operadorSinMunicipiosKey);
        this.router.navigate(['/login']);
      })
    );
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
    return !!localStorage.getItem('token');
  }

  getUser() {
    return this.user || JSON.parse(localStorage.getItem('user') || 'null');
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
