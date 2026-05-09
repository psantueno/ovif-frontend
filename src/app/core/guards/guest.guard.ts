import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree} from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { getUserRoleNames } from '../utils/roles.util';

export const GuestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const redirect = (router: Router, path: string[]): UrlTree => router.createUrlTree(path);

  return authService.ensureUser().pipe(
    map((user) => {
      const roles = getUserRoleNames(user)

      if (roles.includes('administrador')) {
        return redirect(router, ['/admin']);
      }

      if (roles.includes('operador')) {
        return redirect(router, ['/home']);
      }

      return true
    }),
    catchError(() => of(true))
  );
};
