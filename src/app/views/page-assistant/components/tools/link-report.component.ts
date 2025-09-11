import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { UploadStateService } from '../../services/upload-state.service';

type LinkType = 'anchor' | 'mailto' | 'tel' | 'file' | 'internal' | 'external';
type MatchStatus = 'match' | 'mismatch' | 'unknown' | 'na';

interface HeadingData {
  order: number; // Index
  type: LinkType; // Link Type
  text: string; // Link name on page
  href: string; // Original href
  absUrl: string | null; // Resolved absolute URL
  destH1: string | null; // Destination (or guessed) title for col 4
  matchStatus: MatchStatus;
}

type ColumnField = 'order' | 'type' | 'text' | 'destH1' | 'matchStatus';
interface LinkReportColumn {
  field: ColumnField;
  header: string;
}

@Component({
  selector: 'ca-link-report',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule],
  templateUrl: './link-report.component.html',
  styles: [
    `
      .text-ok {
        color: #16a34a;
      } /* ✔ green */
      .text-bad {
        color: #dc2626;
      } /* ✖ red   */
      .text-unk {
        color: #64748b;
      } /* ? gray  */
      .break-all {
        word-break: break-all;
      }
      .muted {
        color: #6b7280;
        font-size: 12px;
      }
      .flex {
        display: flex;
      }
      .justify-center {
        justify-content: center;
      }
    `,
  ],
})
export class LinkReportComponent implements OnInit {
  constructor(private uploadState: UploadStateService) {}

  // table data & selection
  headings: HeadingData[] = [];
  selectedHeading!: HeadingData;

  // 5 columns exactly
  cols: LinkReportColumn[] = [
    { field: 'order', header: 'Index' },
    { field: 'type', header: 'Link Type' },
    { field: 'text', header: 'Link name on page' },
    { field: 'destH1', header: 'Destination link header (H1)' },
    { field: 'matchStatus', header: 'Match' },
  ];

  sourceVersion: 'original' | 'modified' = 'original';
  private concurrency = 4;

  // Origin of the page being analyzed (from upload state / base tag / pageUrl)
  private baseOrigin: string | null = null;

  ngOnInit(): void {
    this.extractLinks();
  }

  async extractLinks() {
    const { html, baseUrl } = this.getHtmlToAnalyze();
    if (!html) {
      this.headings = [];
      return;
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const anchors = Array.from(
      doc.querySelectorAll<HTMLAnchorElement>('body a[href]'),
    );

    // Build rows (no network here)
    this.headings = anchors.map((a, i): HeadingData => {
      const href = (a.getAttribute('href') || '').trim();
      const absUrl = this.resolveUrl(href, baseUrl);
      const text = (
        a.textContent ||
        a.getAttribute('aria-label') ||
        a.title ||
        ''
      ).trim();
      const type = this.classify(href, absUrl);

      let destH1: string | null = null;
      let matchStatus: MatchStatus = 'unknown';

      if (type === 'anchor') {
        // same page: use current doc's first H1
        const h1 = doc.querySelector('h1');
        destH1 = h1 ? (h1.textContent || '').trim() : null;
        matchStatus = this.smartMatch(text, destH1);
      } else if (type === 'mailto' || type === 'tel' || type === 'file') {
        matchStatus = 'na';
      } else if (type === 'external') {
        // NO server: guess from path segments (smart slug) + token-aware match
        const { guess, pathTokens } = this.smartSlugGuess(text, absUrl || href);
        destH1 = guess;
        matchStatus = this.smartMatch(text, destH1, pathTokens);
      }
      // internal, same-origin will be resolved below via fetch

      return {
        order: i + 1,
        type,
        text,
        href,
        absUrl,
        destH1,
        matchStatus,
      };
    });

    // For same-origin internal links, fetch and extract true H1
    const tasks = this.headings
      .filter(
        (r) =>
          r.type === 'internal' &&
          !r.destH1 &&
          r.absUrl &&
          this.isSameOrigin(r.absUrl),
      )
      .map((r) => () => this.resolveDestH1(r));

    await this.runWithConcurrency(tasks, this.concurrency);
  }

  // ---------- helpers (no server required) ----------

  private getHtmlToAnalyze(): { html: string | null; baseUrl: string | null } {
    const data = this.uploadState.getUploadData?.() as any;
    if (!data) return { html: null, baseUrl: null };

    const html: string | null =
      (this.sourceVersion === 'modified'
        ? data.modifiedHtml
        : data.originalHtml) || null;

    let baseUrl: string | null = null;
    if (html) {
      try {
        const tmp = new DOMParser().parseFromString(html, 'text/html');
        const b = tmp.querySelector('base[href]')?.getAttribute('href')?.trim();
        if (b) baseUrl = b;
      } catch {}
    }
    if (!baseUrl && data.pageUrl) baseUrl = data.pageUrl;

    // Remember origin of the analyzed page (NOT location.origin)
    this.baseOrigin = null;
    if (baseUrl) {
      try {
        this.baseOrigin = new URL(baseUrl).origin;
      } catch {}
    }

    return { html, baseUrl };
  }

  private resolveUrl(href: string, baseUrl: string | null): string | null {
    try {
      if (!href) return null;
      if (
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      )
        return href;
      if (baseUrl) return new URL(href, baseUrl).toString();
      return new URL(href).toString();
    } catch {
      return null;
    }
  }

  private classify(href: string, absUrl: string | null): LinkType {
    if (!href) return 'internal';
    if (href.startsWith('#')) return 'anchor';
    if (href.startsWith('mailto:')) return 'mailto';
    if (href.startsWith('tel:')) return 'tel';
    if (/\.(pdf|docx?|pptx?|xlsx?|zip)$/i.test(href)) return 'file';
    if (/^https?:\/\//i.test(href)) {
      if (absUrl && this.baseOrigin) {
        try {
          return new URL(absUrl).origin === this.baseOrigin
            ? 'internal'
            : 'external';
        } catch {
          return 'external';
        }
      }
      return 'external';
    }
    // relative -> treat as internal to the analyzed page
    return 'internal';
  }

  private isSameOrigin(absUrl: string): boolean {
    try {
      return this.baseOrigin
        ? new URL(absUrl).origin === this.baseOrigin
        : false;
    } catch {
      return false;
    }
  }

  // same-origin internal: fetch and compute match against real H1
  private async resolveDestH1(row: HeadingData): Promise<void> {
    if (!row.absUrl) return;
    try {
      const resp = await fetch(row.absUrl, { credentials: 'same-origin' });
      if (!resp.ok) throw new Error('fetch failed');
      const html = await resp.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const h1 = doc.querySelector('h1');
      row.destH1 = h1 ? (h1.textContent || '').trim() : null;
      row.matchStatus = this.smartMatch(row.text, row.destH1);
    } catch {
      if (!row.destH1) row.matchStatus = 'unknown';
    }
  }

  // ---------- smart slug + smart match ----------

  /** Normalize: strip accents, lowercase, treat /-_ as separators, remove punctuation */
  private normalizeText(s: string) {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[\/\-_]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Tokenize & drop light stopwords */
  private tokenize(s: string) {
    const STOP = new Set([
      'a',
      'an',
      'the',
      'for',
      'to',
      'of',
      'and',
      'or',
      'on',
      'in',
      'with',
      'your',
      'program',
      'account',
      'information',
      'returns',
      'return',
      'services',
      'service',
      'tax',
      'taxes',
      'business',
      'businesses',
      'topics',
      'en',
      'fr',
    ]);
    return this.normalizeText(s)
      .split(' ')
      .filter((w) => w && !STOP.has(w));
  }

  /** Decode path segments and strip common extensions */
  private pathSegments(urlStr?: string | null): string[] {
    if (!urlStr) return [];
    try {
      const u = new URL(urlStr);
      const raw = u.pathname.split('/').filter(Boolean);
      return raw.map((seg) =>
        decodeURIComponent(seg).replace(/\.(html?|php|aspx?)$/i, ''),
      );
    } catch {
      return [];
    }
  }

  /**
   * Smart slug guess:
   * - score each segment against link text (coverage + Jaccard)
   * - return best segment as guess, plus all path tokens for matching
   */
  private smartSlugGuess(
    linkText: string,
    absUrl?: string | null,
  ): { guess: string | null; pathTokens: Set<string> } {
    const linkTokens = this.tokenize(linkText);
    const segs = this.pathSegments(absUrl);
    let bestGuess: string | null = null;
    let bestScore = -1;

    const allTokens = new Set<string>();
    for (const seg of segs) {
      const segTokens = this.tokenize(seg);
      for (const t of segTokens) allTokens.add(t);

      if (linkTokens.length) {
        const cover =
          linkTokens.filter((t) => segTokens.includes(t)).length /
          linkTokens.length;
        const setL = new Set(linkTokens);
        const setS = new Set(segTokens);
        const inter = [...setL].filter((w) => setS.has(w)).length;
        const union = new Set([...setL, ...setS]).size || 1;
        const jacc = inter / union;
        const score = cover * 0.7 + jacc * 0.3; // weights can be tuned

        if (score > bestScore) {
          bestScore = score;
          bestGuess = segTokens.join(' ') || seg; // human readable
        }
      }
    }

    if (!bestGuess && segs.length) {
      const lastTokens = this.tokenize(segs[segs.length - 1]);
      bestGuess = lastTokens.join(' ') || segs[segs.length - 1] || null;
      for (const t of lastTokens) allTokens.add(t);
    }

    return { guess: bestGuess, pathTokens: allTokens };
  }

  /** Token-aware loose match: exact → containment (with path tokens) → Jaccard */
  private smartMatch(
    linkText: string,
    candidate: string | null,
    extraTokens?: Set<string>,
  ): MatchStatus {
    if (!candidate && (!extraTokens || extraTokens.size === 0))
      return 'unknown';

    const A = this.tokenize(linkText);
    const B = this.tokenize(candidate || '');
    if (A.length === 0) return 'unknown';

    if (this.normalizeText(linkText) === this.normalizeText(candidate || ''))
      return 'match';

    const basket = new Set(B);
    if (extraTokens) for (const t of extraTokens) basket.add(t);
    const allIn = A.every((t) => basket.has(t));
    if (allIn) return 'match';

    const setA = new Set(A);
    const setB = new Set(B);
    const inter = [...setA].filter((w) => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size || 1;
    const j = inter / union;

    return j >= 0.6 ? 'match' : 'mismatch'; // tune threshold if needed
  }

  // Concurrency runner
  private async runWithConcurrency(
    tasks: Array<() => Promise<any>>,
    limit: number,
  ) {
    const q = tasks.slice();
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(limit, q.length); i++) {
      workers.push(
        (async () => {
          while (q.length) await q.shift()!();
        })(),
      );
    }
    await Promise.all(workers);
  }

  // style hooks used by template
  getTextStyle(_row: HeadingData) {
    return {};
  }
  getTextClass(_row: HeadingData) {
    return {};
  }
}
