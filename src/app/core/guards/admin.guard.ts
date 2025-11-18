import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { getUserRoleNames } from '../utils/roles.util';

const redirectTo = (router: Router, path: string[]): UrlTree => router.createUrlTree(path);

export const AdminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  if (!authService.isLoggedIn()) {
    return redirectTo(router, ['/login']);
  }

  return authService.ensureUser().pipe(
    map((user) => {
      if (!user) {
        return redirectTo(router, ['/login']);
      }

      const roleNames = getUserRoleNames(user);
      if (roleNames.includes('administrador')) {
        return true;
      }

      return redirectTo(router, ['/home']);
    }),
    catchError(() => of(redirectTo(router, ['/login'])))
  );
};
