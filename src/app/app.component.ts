import { Component, inject, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';

// componentes standalone
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from './shared/footer/footer.component';
import { AuthService } from './services/auth.service';
import { MunicipioService } from './services/municipio.service';
import { getUserRoleNames } from './core/utils/roles.util';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {
  title = 'ovif-frontend';

  private readonly authService = inject(AuthService);
  private readonly municipioService = inject(MunicipioService);
  private readonly userSub: Subscription;

  constructor() {
    // Reaccionar cuando los guards validen la sesión y user$ emita un usuario
    this.userSub = this.authService.user$.subscribe((user) => {
      if (user && getUserRoleNames(user).includes('operador')) {
        this.municipioService.ensureMunicipioSeleccionado().subscribe();
      }
    });
  }

  ngOnDestroy() {
    this.userSub.unsubscribe();
  }
}
