import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { StepperModule } from 'primeng/stepper';
import { ProgressBarModule } from 'primeng/progressbar';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService, TreeNode } from 'primeng/api';
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

import { PageData, BreadcrumbNode, BrokenLinks, SearchMatches } from './data/data.model'
import { IaRelationshipService } from './services/ia-relationship.service';
import { IaTreeService } from './services/ia-tree.service';
import { FetchService } from '../../services/fetch.service';
import { ThemeService } from '../../services/theme.service';

import { IaTreeComponent } from './components/ia-tree.component';
import { SearchCriteriaComponent } from './components/search-criteria.component';

import { environment } from '../../../environments/environment';

import { IaStateService } from './services/ia-state.service';
import { ValidateUrlsComponent } from "./components/validate-urls.component";
import { SetRootsComponent } from "./components/set-roots.component";


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
  private confirmationService = inject(ConfirmationService);
  private iaService = inject(IaRelationshipService);
  private fetchService = inject(FetchService);
  private theme = inject(ThemeService);
  private iaTreeService = inject(IaTreeService);
  public iaState = inject(IaStateService);

  production = environment.production;

  /******************************************
   * GET ROOT URLS AND VALIDATE BREADCRUMBS *
   ******************************************/
  //breadcrumbs: BreadcrumbNode[][] = [];
  //rootPages: PageData[] = [];
  //breadcrumbProgress = 0;
  //breadcrumbStep = '';
  //hasBreakBeforeRoot = false;
  //hasBreakAfterRoot = false;

  breadcrumbData = this.iaState.getBreadcrumbData;


  /*****************
   * SEARCH TERMS  *
   *****************/

  terms: string[] = [];
  /**********************
  *  BUILD THE IA TREE  *
  ***********************/
  iaTree: TreeNode[] = [];
  brokenLinks: BrokenLinks[] = []
  searchMatches: SearchMatches[] = []

  async buildIaTree(): Promise<void> {
    this.iaTreeService.setTreeContext(this.iaTree, this.iaState.getBreadcrumbData().breadcrumbs);
    await this.iaTreeService.crawlFromRoots(this.iaTree, this.brokenLinks, this.terms, this.searchMatches);
    this.iaTreeService.updateNodeStyles(this.iaTree, 0);
    console.log("Search matches:")
    console.log(this.searchMatches);
  }



}

