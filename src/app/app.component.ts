import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// componentes standalone
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from './shared/footer/footer.component';
import { AuthService } from './services/auth.service';
import { MunicipioService } from './services/municipio.service';
import { getUserRoleNames } from './core/utils/roles.util';

@Component({
  selector: 'app-root',
  standalone: true, // 👈 falta esto
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'] // 👈 corregido (plural)
})
export class AppComponent {
  title = 'ovif-frontend';

  private readonly authService = inject(AuthService);
  private readonly municipioService = inject(MunicipioService);

  constructor() {
    this.authService.ensureUser().subscribe((user) => {
      if (user && getUserRoleNames(user).includes('operador')) {
        this.municipioService.ensureMunicipioSeleccionado().subscribe();
      }
    });
  }
}
