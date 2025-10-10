import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

//primeNG
import { AccordionModule } from 'primeng/accordion';

//Services
import { TranslateModule } from '@ngx-translate/core';

//components
import { HeadingStructureComponent } from './problems/heading-structure.component';
import { ComponentGuidanceComponent } from './problems/component-guidance.component';
import { SeoComponent } from './problems/seo.component';
import { UserInsightsComponent } from './problems/user-insights.component';
import { LinkReportComponent } from './problems/link-report.component';
import { environment } from '../../../../environments/environment';

export interface ProblemsFlags {
  headingStructure: boolean;
  componentGuidance: boolean;
  seo: boolean;
  userInsights: boolean;
  linkReport: boolean;
}

@Component({
  selector: 'ca-page-problems',
  imports: [
    CommonModule,
    TranslateModule,
    AccordionModule,
    SeoComponent,
    UserInsightsComponent,
    LinkReportComponent,
    ComponentGuidanceComponent,
    HeadingStructureComponent,
  ],
  templateUrl: './problems.component.html',
  styles: [
    `
      :host ::ng-deep .p-accordion-header-content {
        display: flex;
        align-items: center;
      }

      /* takes up remaining space so the badge sits just before the caret */
      .flex-spacer {
        flex: 1 1 auto;
      }

      /* bigger red dot, tight to the caret */
      .feature-badge {
        width: 1rem; /* bigger circle */
        height: 1rem;
        border-radius: 9999px;
        background: #ef4444; /* red */
        margin-right: 0.25rem; /* tiny gap before caret */
        display: inline-block;
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06) inset;
      }
    `,
  ],
})
export class PageProblemsComponent {
  // keep your variables
  production: boolean = environment.production;
  activePanels: number[] = [];
  isPanelOpen(panelIndex: number): boolean {
    return this.activePanels.includes(panelIndex);
  }

  @Output() summary = new EventEmitter<ProblemsFlags>();

  // track the 5 features shown under Problems
  public flags: ProblemsFlags = {
    headingStructure: false,
    componentGuidance: false,
    seo: false,
    userInsights: false,
    linkReport: false,
  };

  /** Call this from each feature panel when its status changes */
  onFeatureProblem(feature: keyof ProblemsFlags, hasProblem: boolean) {
    this.flags = { ...this.flags, [feature]: hasProblem };
    this.summary.emit(this.flags);
  }
}
