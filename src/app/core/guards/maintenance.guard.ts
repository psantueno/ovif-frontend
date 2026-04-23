import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { MaintenanceService } from '../../services/maintenance.service';

export const MaintenanceGuard: CanActivateFn = () => {
  const router = inject(Router);
  const maintenanceService = inject(MaintenanceService);

  return maintenanceService.checkStatus().pipe(
    map((isMaintenance) => {
      if (isMaintenance) {
        return router.createUrlTree(['/mantenimiento']);
      }
      return true;
    })
  );
};
