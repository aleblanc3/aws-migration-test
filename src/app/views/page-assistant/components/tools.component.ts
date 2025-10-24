import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

//primeNG
import { AccordionModule } from 'primeng/accordion';

//Services
import { TranslateModule } from '@ngx-translate/core';

//Child components
import { TemplateConversionComponent } from './tools/template-conversion.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'ca-page-tools',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    AccordionModule,
    TemplateConversionComponent,
  ],
  templateUrl: './tools.component.html',
  styles: `
    :host {
      display: block;
    }
  `,
})
export class PageToolsComponent {
  production: boolean = environment.production;
  activePanels: number[] = [];

  isPanelOpen(panelIndex: number): boolean {
    return this.activePanels.includes(panelIndex);
  }
}
