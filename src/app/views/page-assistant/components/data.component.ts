import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

//primeNG
import { AccordionModule } from 'primeng/accordion';

//Services
import { TranslateModule } from '@ngx-translate/core';

//Child components
import { SearchComponent } from './data/search.component';
import { ChatLogsComponent } from './data/chatLogs.component';
import { FeedbackComponent } from './data/feedback.component';
import { UxTestingComponent } from './data/uxTesting.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'ca-page-data',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    AccordionModule,
    SearchComponent,
    ChatLogsComponent,
    FeedbackComponent,
    UxTestingComponent,
  ],
  templateUrl: './data.component.html',
  styles: `
    :host {
      display: block;
    }
  `,
})
export class PageDataComponent {
  production: boolean = environment.production;
  activePanels: number[] = [];

  isPanelOpen(panelIndex: number): boolean {
    return this.activePanels.includes(panelIndex);
  }
}
