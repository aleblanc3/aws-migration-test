import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from "@ngx-translate/core";
import { LocalStorageService } from '../services/local-storage.service';

//PrimeNG
import { ButtonModule } from 'primeng/button';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddon } from 'primeng/inputgroupaddon';
import { IftaLabel } from 'primeng/iftalabel';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'ca-api-key',
  imports: [CommonModule, FormsModule, TranslateModule, ButtonModule, InputGroupModule, InputGroupAddon, IftaLabel, CardModule],
  templateUrl: './api-key.component.html',
  styles: ``
})
export class ApiKeyComponent {
  localStore = inject(LocalStorageService);

  api = '';
  error = '';
  emailLink = '';
  messageTemplate = '';
  apiKeyInstructions = '';
}
