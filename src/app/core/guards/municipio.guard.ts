import { inject } from '@angular/core';
import { CanActivateChildFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { MunicipioService } from '../../services/municipio.service';
import { getUserRoleNames } from '../utils/roles.util';

const MUNICIPIO_STORAGE_KEY = 'municipioSeleccionado';
const RUTAS_RESTRINGIDAS = new Set(['home', 'gastos', 'recursos', 'personal', 'recaudaciones']);

const validarMunicipioSeleccionado = (municipioService: MunicipioService): boolean => {
  if (municipioService.getMunicipioActual()) {
    return true;
  }

  const almacenado = localStorage.getItem(MUNICIPIO_STORAGE_KEY);
  if (!almacenado) {
    return false;
  }

  try {
    const parsed = JSON.parse(almacenado);
    return !!parsed;
  } catch {
    return false;
  }
};

const redirectToSinAcceso = (router: Router): UrlTree => router.createUrlTree(['/sin-acceso']);
const redirectToLogin = (router: Router): UrlTree => router.createUrlTree(['/login']);

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
    map((user) => {
      if (!user) {
        return redirectToLogin(router);
      }

      const roleNames = getUserRoleNames(user);
      if (roleNames.includes('administrador')) {
        return true;
      }

      const tieneMunicipioSeleccionado = validarMunicipioSeleccionado(municipioService);
      if (!tieneMunicipioSeleccionado) {
        return redirectToSinAcceso(router);
      }

      return true;
    }),
    catchError(() => of(redirectToLogin(router)))
  );
};
