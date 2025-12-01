import { inject } from '@angular/core';
import { CanActivateChildFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { MunicipioService } from '../../services/municipio.service';
import { getUserRoleNames } from '../utils/roles.util';

const RUTAS_RESTRINGIDAS = new Set(['home', 'gastos', 'recursos', 'remuneraciones', 'recaudaciones']);

const redirectToSinAcceso = (router: Router): UrlTree => router.createUrlTree(['/sin-acceso']);
const redirectToAdmin = (router: Router): UrlTree => router.createUrlTree(['/admin']);
const redirectToLogin = (router: Router): UrlTree => router.createUrlTree(['/login']);
const redirectToSeleccion = (router: Router): UrlTree => router.createUrlTree(['/']);

export const MunicipioGuard: CanActivateChildFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const municipioService = inject(MunicipioService);

  const rutaDestino = route.routeConfig?.path ?? '';
  if (!RUTAS_RESTRINGIDAS.has(rutaDestino)) {
    return true;
  }

  if (!authService.isLoggedIn()) {
    return redirectToLogin(router);
  }

  return authService.ensureUser().pipe(
    switchMap((user) => {
      if (!user) {
        return of(redirectToLogin(router));
      }

      const roleNames = getUserRoleNames(user);
      if (roleNames.includes('administrador')) {
        return of(redirectToAdmin(router));
      }

      if (municipioService.getMunicipioActual()) {
        return of(true);
      }

      return municipioService.ensureMunicipioSeleccionado().pipe(
        map((resultado) => {
          if (resultado === 'ok') {
            return true;
          }

          if (resultado === 'seleccionar') {
            return redirectToSeleccion(router);
          }

          return redirectToSinAcceso(router);
        })
      );
    }),
    catchError(() => of(redirectToLogin(router)))
  );
};
