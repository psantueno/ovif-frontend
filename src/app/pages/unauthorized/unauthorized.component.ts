import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../services/auth.service';
import { getUserRoleNames } from '../../core/utils/roles.util';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterModule, MatIconModule],
  templateUrl: './unauthorized.component.html',
  styleUrls: ['./unauthorized.component.scss']
})
export class UnauthorizedComponent {
  private readonly location = inject(Location);
  private readonly authService = inject(AuthService);

  get homePath(): string {
    const user = this.authService.getUser();
    return getUserRoleNames(user).includes('administrador') ? '/admin' : '/home';
  }

  goBack(): void {
    this.location.back();
  }
}
