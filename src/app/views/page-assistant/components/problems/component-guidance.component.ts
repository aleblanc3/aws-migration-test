// src/app/views/page-assistant/components/tools/component-guidance.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { TooltipModule } from 'primeng/tooltip';
import { TranslateService, TranslateModule } from '@ngx-translate/core';

import { UploadStateService } from '../../services/upload-state.service';
import { ValidatorService } from '../../services/validator.service';
import {
  ComponentAiService,
  ComponentAiInput,
  ComponentAiResult,
} from '../../services/component-ai.service';

import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';

type Health = 'ok' | 'issue' | 'unknown';

interface GuidanceRow {
  order: number;
  component: string; // translated label
  url: string; // translated URL
  // AI fields:
  health?: Health;
  codeUpToDate?: boolean;
  issues?: string[];
  rationale?: string;
  // internal:
  __nameKey?: string;
  __urlKey?: string;
}

@Component({
  selector: 'ca-component-guidance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    CheckboxModule,
    TooltipModule,
    TranslateModule,
  ],
  templateUrl: './component-guidance.component.html',
  styles: [
    `
      .muted {
        color: #6b7280;
        font-size: 12px;
      }
      .issues {
        margin: 0;
        padding-left: 1rem;
      }
      .health-cell {
        display: flex;
        gap: 0.4rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.15rem 0.5rem;
        border-radius: 9999px;
        font-size: 12px;
        line-height: 1.2;
        border: 1px solid transparent;
      }
      .chip-ok {
        background: #dcfce7;
        color: #166534;
        border-color: #bbf7d0;
      }
      .chip-issue {
        background: #fee2e2;
        color: #991b1b;
        border-color: #fecaca;
      }
      .chip-unk {
        background: #e5e7eb;
        color: #374151;
        border-color: #e5e7eb;
      }
      .tag {
        font-size: 11px;
        padding: 0.05rem 0.4rem;
        border-radius: 6px;
        border: 1px solid transparent;
      }
      .tag-ok {
        background: #eefdf3;
        color: #166534;
        border-color: #bbf7d0;
      }
      .tag-warn {
        background: #fff7ed;
        color: #9a3412;
        border-color: #fed7aa;
      }
      .ai-btn {
        font-weight: 600;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `,
  ],
})
export class ComponentGuidanceComponent implements OnInit {
  private uploadState = inject(UploadStateService);
  private translate = inject(TranslateService);
  private validator = inject(ValidatorService);
  private http = inject(HttpClient);
  private ai = inject(ComponentAiService);

  production: boolean = environment.production;

  guidanceList: { name: string; url: string }[] = [];
  rows: GuidanceRow[] = [];

  // multi-select
  selectedRows: GuidanceRow[] = [];
  isLoading = false;

  cols = [
    { field: 'order', header: 'Index' },
    { field: 'component', header: 'Component' },
    { field: 'url', header: 'UCDG guidance' },
    { field: 'health', header: 'Component health' },
    { field: 'rationale', header: 'Explanation' },
  ];

  ngOnInit() {
    const data = this.uploadState.getUploadData();
    if (data?.originalHtml) {
      this.guidanceList = this.validator.collectGuidanceUrls(data.originalHtml);
      this.rows = this.buildRows(this.guidanceList);
    }
  }

  /** Build sorted, de-duped table rows from validator findings. */
  private buildRows(list: { name: string; url: string }[]): GuidanceRow[] {
    const unique = new Map<string, { nameKey: string; urlKey: string }>();
    for (const g of list)
      if (!unique.has(g.url))
        unique.set(g.url, { nameKey: g.name, urlKey: g.url });

    const resolved = Array.from(unique.values()).map((it) => ({
      component: this.translate.instant(it.nameKey) || it.nameKey,
      url: this.translate.instant(it.urlKey) || it.urlKey,
      __nameKey: it.nameKey,
      __urlKey: it.urlKey,
    }));

    resolved.sort((a, b) =>
      a.component.localeCompare(b.component, undefined, {
        sensitivity: 'base',
      }),
    );

    return resolved.map((r, i) => ({
      order: i + 1,
      component: r.component,
      url: r.url,
      __nameKey: r.__nameKey,
      __urlKey: r.__urlKey,
      health: 'unknown',
    }));
  }

  /** Click handler for the GenAI button. */
  async sendToAI(): Promise<void> {
    if (!this.selectedRows.length || this.isLoading) return;
    this.isLoading = true;

    try {
      const html = this.uploadState.getUploadData()?.originalHtml || '';
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Build inputs for selected rows
      const inputs: ComponentAiInput[] = this.selectedRows.map((row) => ({
        componentLabel: row.component,
        guidanceUrl: row.url,
        htmlSnippet:
          this.findSnippetForRow(doc, row) || this.trimHtml(html, 8000),
      }));

      const results = await this.ai.assess(inputs);
      this.applyResults(results);
    } finally {
      this.isLoading = false;
    }
  }

  /** Try to find a compact snippet in the current page that matches the component */
  private findSnippetForRow(doc: Document, row: GuidanceRow): string | null {
    void row; // silence TS6133
    const candidate = doc.querySelector('[class]');
    if (!candidate) return null;
    const html = candidate.outerHTML;
    return html.length > 2000 ? html.slice(0, 2000) : html;
  }

  private trimHtml(s: string, max = 12000): string {
    const t = (s || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max) : t;
  }

  /** Merge AI outputs back into table rows */
  private applyResults(results: ComponentAiResult[]) {
    // Map by label for simplicity (labels are stable, de-duped)
    const byLabel = new Map(results.map((r) => [r.componentLabel, r]));

    this.rows = this.rows.map((r) => {
      const ai = byLabel.get(r.component);
      if (!ai) return r;

      const out: GuidanceRow = {
        ...r,
        health: ai.health,
        codeUpToDate: ai.codeUpToDate,
        issues: ai.issues || [],
        rationale: ai.rationale || '',
      };
      return out;
    });
  }

  // (leftover dev helper if you still need it)
  // TEMP FXN FOR BUILDING WHITELIST
  classes: string[] = [];
  async extractCSS(url: string): Promise<string[]> {
    const css = await firstValueFrom(
      this.http.get(url, { responseType: 'text' }),
    );
    const classPattern = /\.([a-zA-Z0-9_-]+)/g;
    const classes = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = classPattern.exec(css)) !== null) classes.add(match[1]);
    return [...classes].sort();
  }

  // Expose computed table rows if you still want via getter:
  get tableRows(): GuidanceRow[] {
    return this.rows;
  }
}
