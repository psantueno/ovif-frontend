import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UsuarioContextCardComponent } from '../usuario-context-card/usuario-context-card.component';
import { MunicipioService } from '../../services/municipio.service';

@Component({
  selector: 'main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, UsuarioContextCardComponent],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss']
})
export class MainLayout implements OnInit, OnDestroy {
  private readonly municipioService = inject(MunicipioService);
  private readonly router = inject(Router);

  private readonly destroy$ = new Subject<void>();

  private readonly rutasControladas = ['gastos', 'recursos', 'remuneraciones', 'subir-archivos'];

  ngOnInit(): void {
    this.municipioService.municipio$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.handleMunicipioChange();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private handleMunicipioChange(): void {
    const url = this.router.url.split('?')[0];
    const seccion = url.split('/').filter(Boolean).pop() ?? '';

    if (this.rutasControladas.includes(seccion)) {
      this.router.navigate(['/panel-carga-mensual']);
    }
  }
}
