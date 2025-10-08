import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { StepperModule } from 'primeng/stepper';
import { ProgressBarModule } from 'primeng/progressbar';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { TextareaModule } from 'primeng/textarea';
import { InputTextModule } from 'primeng/inputtext';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ChipModule } from 'primeng/chip';
import { TableModule } from 'primeng/table';
import { BadgeModule } from 'primeng/badge';
import { ToolbarModule } from 'primeng/toolbar';
import { FileUploadModule } from 'primeng/fileupload';

import { IaStateService } from './services/ia-state.service';
import { ValidateUrlsComponent } from "./components/validate-urls.component";
import { SetRootsComponent } from "./components/set-roots.component";
import { SearchCriteriaComponent } from './components/search-criteria.component';
import { IaTreeComponent } from './components/ia-tree.component';


@Component({
  selector: 'ca-ia-assistant',
  imports: [CommonModule, FormsModule, TranslateModule,
    TextareaModule, InputTextModule, IftaLabelModule, InputGroupModule, InputGroupAddonModule, ButtonModule, FileUploadModule,
    ProgressBarModule, ChipModule, StepperModule, ConfirmPopupModule, TableModule, BadgeModule, TooltipModule, ToolbarModule,
    SearchCriteriaComponent, IaTreeComponent, ValidateUrlsComponent, SetRootsComponent],
  templateUrl: './ia-assistant.component.html',
  styles: `
  ::ng-deep .upload-secondary-outline .p-button {
  border: 1px solid var(--p-zinc-200) !important;
  background-color: transparent !important;
 color: var(--p-button-secondary-color);
  }
  ::ng-deep .upload-secondary-outline .p-button:hover {
  background-color: var(--p-button-outlined-secondary-hover-background);
  color: var(--p-button-secondary-hover-color);
}
  
  ::ng-deep .upload-secondary-outline .p-button-label {
    display: none;
  }
 `
})
export class IaAssistantComponent {
  public iaState = inject(IaStateService);
}

