import { Component } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { LocalStorageService } from '../services/local-storage.service';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'ca-api-reset',
  imports: [TranslateModule, ButtonModule],
  template: `
    <p-button icon="pi pi-key" [label]="'apiKey.change' | translate" [rounded]="true" outlined severity="secondary"
    id="api-key-reset-btn" class="my-2 api-button" styleClass="surface-border" (click)="this.localStore.removeData('apiKey');" />
  `,
  styles: `
  @media (max-width: 768px) {
  ::ng-deep .api-button .p-button-label {
    display: none;
  }
}
 ::ng-deep .api-button:hover .p-button-icon {
    color: var(--p-primary-400) !important;
  }

  ::ng-deep html.dark-mode .api-button:hover .p-button-icon {
    color: var(--p-primary-200) !important;
  }`
})
export class ApiResetComponent {
  constructor(public localStore: LocalStorageService) { }
}