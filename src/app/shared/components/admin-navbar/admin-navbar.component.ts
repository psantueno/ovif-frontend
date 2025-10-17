import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface AdminBreadcrumb {
  label: string;
  link?: string | any[];
}

@Component({
  selector: 'app-admin-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule],
  templateUrl: './admin-navbar.component.html',
  styleUrls: ['./admin-navbar.component.scss']
})
export class AdminNavbarComponent {
  @Input() breadcrumbs: AdminBreadcrumb[] = [];
  @Input() backLink: string | any[] = '/admin';
  @Input() backLabel = 'Volver';
  @Input() showBack = true;
}
