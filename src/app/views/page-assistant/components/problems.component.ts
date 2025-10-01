import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

// PrimeNG
import { AccordionModule } from 'primeng/accordion';

// i18n (optional; safe to keep for consistency)
import { TranslateModule } from '@ngx-translate/core';

// Child panels (standalone components)
import { LinkReportComponent } from './tools/link-report.component';

interface ProblemsFlags {
  linkReport: boolean;
  // add future feature flags here, e.g.:
}

@Component({
  selector: 'ca-page-problems',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    AccordionModule,
    LinkReportComponent,
  ],
  templateUrl: './problems.component.html',
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class ProblemsPanelComponent {
  @Output() summary = new EventEmitter<ProblemsFlags>();
  /** Keep all panels closed by default */
  activePanels: number[] = [];

  private flags: ProblemsFlags = { linkReport: false };

  /** Helper for the collapsed preview text (same as Tools panel uses) */
  isPanelOpen(idx: number): boolean {
    return this.activePanels.includes(idx);
  }

  onLinkReportProblem(has: boolean) {
    this.flags = { ...this.flags, linkReport: has };
    this.summary.emit(this.flags);
  }
}
