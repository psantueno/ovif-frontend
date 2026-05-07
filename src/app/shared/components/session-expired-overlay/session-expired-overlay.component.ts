import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-session-expired-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './session-expired-overlay.component.html',
  styleUrls: ['./session-expired-overlay.component.scss'],
})
export class SessionExpiredOverlayComponent {
  @Input() display = false;
  @Output() accepted = new EventEmitter<void>();

  onAccept(): void {
    this.accepted.emit();
  }
}
