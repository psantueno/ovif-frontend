import { Component, inject, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import Swal from 'sweetalert2';

// componentes standalone
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from './shared/footer/footer.component';
import { SessionExpiredOverlayComponent } from './shared/components/session-expired-overlay/session-expired-overlay.component';
import { AuthService } from './services/auth.service';
import { MunicipioService } from './services/municipio.service';
import { getUserRoleNames } from './core/utils/roles.util';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    HeaderComponent,
    FooterComponent,
    SessionExpiredOverlayComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {
  title = 'ovif-frontend';

  private readonly authService = inject(AuthService);
  private readonly municipioService = inject(MunicipioService);
  private readonly dialog = inject(MatDialog);
  private readonly userSub: Subscription;
  private readonly sessionExpiredSub: Subscription;

  sessionExpired = false;

  constructor() {
    // Reaccionar cuando los guards validen la sesión y user$ emita un usuario
    this.userSub = this.authService.user$.subscribe((user) => {
      if (user && getUserRoleNames(user).includes('operador')) {
        this.municipioService.ensureMunicipioSeleccionado().subscribe();
      }
    });

    this.sessionExpiredSub = this.authService.sessionExpired$.subscribe((expired) => {
      if (expired) {
        this.closeFloatingUi();
      }
      this.sessionExpired = expired;
    });
  }

  onSessionExpiredAccepted(): void {
    this.closeFloatingUi();
    this.authService.acknowledgeSessionExpired();
  }

  private closeFloatingUi(): void {
    this.dialog.closeAll();
    Swal.close();
  }

  ngOnDestroy() {
    this.userSub.unsubscribe();
    this.sessionExpiredSub.unsubscribe();
  }
}
