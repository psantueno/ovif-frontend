import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { getUserRoleNames } from '../utils/roles.util';

const redirect = (router: Router, path: string[]): UrlTree => router.createUrlTree(path);

export const AuthGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  if (!authService.isLoggedIn()) {
    return redirect(router, ['/login']);
  }

  return authService.ensureUser().pipe(
    map((user) => {
      if (!user) {
        return redirect(router, ['/login']);
      }

      const roleNames = getUserRoleNames(user);

      if (roleNames.includes('administrador')) {
        return true;
      }

      if (roleNames.includes('operador')) {
        return true;
      }

      return true;
    }),
    catchError(() => of(redirect(router, ['/login'])))
  );
};
