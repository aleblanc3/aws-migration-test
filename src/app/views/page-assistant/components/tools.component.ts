import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

//primeNG
import { AccordionModule } from 'primeng/accordion';

//Services
import { TranslateModule } from '@ngx-translate/core';

//Child components
import { HeadingStructureComponent } from "./tools/heading-structure.component";
import { IaStructureComponent } from "./tools/ia-structure.component";
import { ComponentGuidanceComponent } from "./tools/component-guidance.component";
import { SeoComponent } from "./tools/seo.component";
import { UserInsightsComponent } from "./tools/user-insights.component";
import { LinkReportComponent } from "./tools/link-report.component";
import { TemplateConversionComponent } from "./tools/template-conversion.component";

@Component({
  selector: 'ca-page-tools',
  imports: [CommonModule, TranslateModule,
    AccordionModule,
    TemplateConversionComponent, LinkReportComponent, SeoComponent, UserInsightsComponent, ComponentGuidanceComponent, HeadingStructureComponent, IaStructureComponent],
  templateUrl: './tools.component.html',
  styles: `
    :host {
      display: block;
    }
  `
})
export class PageToolsComponent {

  activePanels: number[] = [];

  isPanelOpen(panelIndex: number): boolean {
    return this.activePanels.includes(panelIndex);
  }

}
