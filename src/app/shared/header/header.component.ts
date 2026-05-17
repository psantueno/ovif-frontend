import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { getUserRoleNames } from '../../core/utils/roles.util';

@Component({
  selector: 'app-header',
  standalone: true,
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  irAlInicio(event: Event): void {
    event.preventDefault();

    const user = this.authService.getUser();
    if (!user) {
      this.router.navigate(['/']);
      return;
    }

    const roleNames = getUserRoleNames(user);
    if (roleNames.includes('administrador')) {
      this.router.navigate(['/admin']);
      return;
    }

    if (roleNames.includes('operador')) {
      this.router.navigate(['/home']);
      return;
    }

    this.router.navigate(['/sin-acceso']);
  }
}
