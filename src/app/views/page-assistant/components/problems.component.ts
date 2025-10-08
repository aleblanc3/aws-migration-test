import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

//primeNG
import { AccordionModule } from 'primeng/accordion';

//Services
import { TranslateModule } from '@ngx-translate/core';

//Child components
import { HeadingStructureComponent } from './problems/heading-structure.component';
import { ComponentGuidanceComponent } from './problems/component-guidance.component';
import { SeoComponent } from './problems/seo.component';
import { UserInsightsComponent } from './problems/user-insights.component';
import { LinkReportComponent } from './problems/link-report.component';
import { environment } from '../../../../environments/environment';

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
  styles: `
    :host {
      display: block;
    }
  `,
})
export class PageProblemsComponent {
  production: boolean = environment.production;
  activePanels: number[] = [];

  isPanelOpen(panelIndex: number): boolean {
    return this.activePanels.includes(panelIndex);
  }
}
