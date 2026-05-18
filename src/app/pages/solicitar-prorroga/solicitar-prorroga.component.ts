import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminNavbarComponent, AdminBreadcrumb } from '../../shared/components/admin-navbar/admin-navbar.component';
import { TabComponent } from '../../shared/components/tabs/tab.component';
import { TabGroupComponent } from '../../shared/components/tabs/tab-group.component';
import { NuevaSolicitudComponent } from './nueva-solicitud/nueva-solicitud.component';
import { HistorialSolicitudesComponent } from './historial/historial-solicitudes.component';

@Component({
  selector: 'app-solicitar-prorroga',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AdminNavbarComponent,
    TabGroupComponent,
    TabComponent,
    NuevaSolicitudComponent,
    HistorialSolicitudesComponent,
  ],
  templateUrl: './solicitar-prorroga.component.html',
  styleUrls: ['./solicitar-prorroga.component.scss'],
})
export class SolicitarProrrogaComponent {
  @ViewChild(HistorialSolicitudesComponent) historial!: HistorialSolicitudesComponent;

  readonly breadcrumbs: AdminBreadcrumb[] = [
    { label: 'Inicio', link: '/home' },
    { label: 'Solicitar Prórroga' },
  ];

  tabActivo = 0;

  onTabChange(index: number): void {
    this.tabActivo = index;
    if (index === 1) {
      setTimeout(() => this.historial?.buscar(), 0);
    }
  }

  irAHistorial(): void {
    this.onTabChange(1);
  }
}
