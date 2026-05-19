import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BorradoContexto } from '../../../models/borrado.model';
import { nombreMes } from '../../../core/utils/borrado.util';

@Component({
  selector: 'app-carga-borrado-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './carga-borrado-panel.component.html',
  styleUrls: ['./carga-borrado-panel.component.scss'],
})
export class CargaBorradoPanelComponent {
  @Input() contexto: BorradoContexto | null = null;
  @Input() disabled = false;
  @Input() borrando = false;
  @Output() confirmar = new EventEmitter<void>();

  get botonDeshabilitado(): boolean {
    return !this.contexto || this.disabled || this.borrando;
  }

  get nombreMesLabel(): string {
    return this.contexto ? nombreMes(this.contexto.mes) : '';
  }

  get tipoLabel(): string {
    return this.contexto?.tipoCarga === 'rectificacion' ? 'Rectificación' : 'Regular';
  }

  onClickBorrar(): void {
    if (this.botonDeshabilitado) return;
    this.confirmar.emit();
  }
}
