import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

// componentes standalone
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from './shared/footer/footer.component';

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
}
