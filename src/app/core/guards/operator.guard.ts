import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { getUserRoleNames } from '../utils/roles.util';

const redirectTo = (router: Router, path: string[]): UrlTree => router.createUrlTree(path);

export const OperatorGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return authService.ensureUser().pipe(
    map((user) => {
      if (!user) {
        return redirectTo(router, ['/']);
      }

      const roleNames = getUserRoleNames(user);
      const isOperador = roleNames.includes('operador');
      const isAdministrador = roleNames.includes('administrador');

      if (isOperador) {
        return true;
      }

      if (isAdministrador) {
        return redirectTo(router, ['/unauthorized']);
      }

      return redirectTo(router, ['/sin-acceso']);
    }),
    catchError(() => of(redirectTo(router, ['/'])))
  );
};
