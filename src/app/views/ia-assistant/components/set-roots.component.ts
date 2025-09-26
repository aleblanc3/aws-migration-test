import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';

import { IaRelationshipService } from '../services/ia-relationship.service';
import { FetchService } from '../../../services/fetch.service';

import { IaStateService } from '../services/ia-state.service';

@Component({
  selector: 'ca-set-roots',
  imports: [CommonModule, FormsModule, TranslateModule,
    ProgressBarModule, TooltipModule
  ],
  templateUrl: './set-roots.component.html',
  styles: ``
})
export class SetRootsComponent implements OnInit {
  public iaState = inject(IaStateService);
  private iaService = inject(IaRelationshipService);
  private fetchService = inject(FetchService);


  async ngOnInit(): Promise<void> {
    await this.checkBreadcrumbs();
  }

  breadcrumbData = this.iaState.getBreadcrumbData;

  async checkBreadcrumbs() {
    console.log(this.breadcrumbData().progress);
    if (this.breadcrumbData().progress >= 100) return;
    if (this.breadcrumbData().progress < 60) {
      this.iaState.setBreadcrumbData({ progress: 0, step: '' });
      this.iaState.setBreadcrumbData({ progress: 20, step: "Getting all breadcrumbs" });
      const allPages = await this.iaService.getAllBreadcrumbs(this.iaState.getUrlData().urlPairs);

      this.iaState.setBreadcrumbData({ progress: 40, step: "Finding root pages" });
      await this.fetchService.simulateDelay(2000);
      this.breadcrumbData().rootPages = this.iaService.getRoots(allPages);

      this.iaState.setBreadcrumbData({ progress: 50, step: "Filtering breadcrumbs" });
      await this.fetchService.simulateDelay(2000);
      this.breadcrumbData().breadcrumbs = this.iaService.filterBreadcrumbs(allPages)
    }
    if (this.breadcrumbData().progress < 90) {
      this.iaState.saveToLocalStorage();
      this.iaState.setBreadcrumbData({ progress: 60, step: "Validating breadcrumbs" });
      this.breadcrumbData().breadcrumbs = await this.iaService.validateBreadcrumbs(this.breadcrumbData().breadcrumbs);
    }
    this.iaState.setBreadcrumbData({ progress: 90, step: "Highlighting breadcrumbs" });
    await this.fetchService.simulateDelay(2000);

    const { breadcrumbs: highlighted, hasBreakAfterRoot, hasBreakBeforeRoot } = this.iaService.highlightBreadcrumbs(this.breadcrumbData().breadcrumbs, this.breadcrumbData().rootPages);
    this.iaState.setBreadcrumbData({
      breadcrumbs: highlighted,
      hasBreakAfterRoot,
      hasBreakBeforeRoot,
      progress: 100,
      step: "Complete"
    });
    this.iaState.saveToLocalStorage();
  }

}
