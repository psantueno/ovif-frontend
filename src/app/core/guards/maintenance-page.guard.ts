import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, switchMap } from 'rxjs';
import { MaintenanceService } from '../../services/maintenance.service';
import { AuthService } from '../../services/auth.service';
import { getUserRoleNames } from '../utils/roles.util';

export const MaintenancePageGuard: CanActivateFn = () => {
  const router = inject(Router);
  const maintenanceService = inject(MaintenanceService);
  const authService = inject(AuthService);

  return maintenanceService.checkStatus().pipe(
    switchMap((isMaintenance) => {
      if (isMaintenance) {
        return [true];
      }

      return authService.ensureUser().pipe(
        map((user) => {
          const roles = getUserRoleNames(user);
          if (roles.includes('administrador')) {
            return router.createUrlTree(['/admin']);
          }
          return router.createUrlTree(['/home']);
        })
      );
    })
  );
};
