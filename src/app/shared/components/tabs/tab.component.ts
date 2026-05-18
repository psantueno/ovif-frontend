import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-tab',
  standalone: true,
  templateUrl: './tab.component.html',
  styleUrl: './tab.component.scss',
})
export class TabComponent {
  @Input({ required: true }) label = '';
  @Input() active = false;
  @Output() clicked = new EventEmitter<void>();
}
