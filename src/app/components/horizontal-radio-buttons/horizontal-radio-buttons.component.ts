import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { RadioButton } from 'primeng/radiobutton';
import { ViewOption } from '../../views/page-assistant/data/data.model';

@Component({
  selector: 'ca-horizontal-radio-buttons',
  imports: [CommonModule, FormsModule, TranslateModule, RadioButton],
  template: `
    <div>
      <label class="mb-1 font-semibold block" [attr.id]="name + '-label'" [for]="name + '-0'">{{ label | translate }}</label>
      <div class="flex flex-wrap gap-3" role="radiogroup" [attr.aria-labelledby]="name + '-label'">
        <div *ngFor="let option of options; let i = index" class="field-radiobutton">
          <p-radioButton
            [inputId]="name + '-' + i"
            [name]="name"
            [value]="option.value"
            [(ngModel)]="selected"
            (ngModelChange)="onChange($event)">
          </p-radioButton>
          <label [for]="name + '-' + i">
            <i [class]="option.icon"></i>
            {{ option.label  | translate }}
          </label>
        </div>
      </div>
    </div>
  `,
  styles: ``
})
export class HorizontalRadioButtonsComponent<T = string> {
  @Input() label!: string;
  @Input() name!: string;
  @Input() options: ViewOption[] = [];
  @Input() selected!: T;
  @Output() selectedChange = new EventEmitter<T>();

  onChange(value: T) {
    this.selectedChange.emit(value);
  }
}
