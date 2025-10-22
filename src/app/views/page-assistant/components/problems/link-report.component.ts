import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { PopoverModule, Popover } from 'primeng/popover';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { UploadStateService } from '../../services/upload-state.service';
import { LinkAiService, AiVerdict } from '../../services/link-ai.service';
import { ContentExtractorService } from '../../services/content-extractor.service';
import type {
  ExtractResult,
  DestMeta,
} from '../../services/content-extractor.service';
import { FetchService } from '../../../../services/fetch.service';
import { Output, EventEmitter } from '@angular/core';

type LinkType =
  | 'CRA page'
  | 'Canada.ca'
  | 'external'
  | 'anchor'
  | 'mailto'
  | 'download';

type MatchStatus = 'match' | 'mismatch' | 'unknown' | 'na';

/** 4-state UI icon for the “Link text health” column */
type UiHealth = 'multi' | 'mismatch' | 'match' | 'unknown';

const CANADA_ORIGIN = 'https://www.canada.ca';

/** Treat both apex and www as Canada.ca (no other subdomains). */
function isCanadaHost(u: URL): boolean {
  const h = u.hostname.toLowerCase().replace(/^www\./, '');
  return h === 'canada.ca';
}

/** Canonicalize AEM repo paths to vanity paths/absolute URLs on canada.ca */
function canonicalizeCanadaHref(href: string): string {
  if (!href) return href;
  href = href.replace(
    /^https?:\/\/(?:www\.)?canada\.ca\/content\/canadasite/i,
    CANADA_ORIGIN,
  );
  href = href.replace(/^\/content\/canadasite/i, '');
  return href;
}

/** Drop any kind of footnote link (refs + return-to-footnote, etc.) */
function isFootnoteLink(a: HTMLAnchorElement): boolean {
  const hrefAttr = (a.getAttribute('href') || '').trim();
  const textish =
    (a.textContent || '') +
    ' ' +
    (a.getAttribute('aria-label') || '') +
    ' ' +
    (a.title || '');

  if (
    a.closest(
      '.footnote, .footnotes, #footnotes, section.footnotes, ol.footnotes, ' +
        '.ref-list, .references, [role="doc-footnote"], [role="doc-endnotes"], ' +
        '[role="doc-backlink"], nav[aria-label="Footnotes"]',
    )
  )
    return true;

  if (a.closest('sup')) return true;

  const hash = (() => {
    try {
      return new URL(hrefAttr, 'https://x').hash || hrefAttr;
    } catch {
      return hrefAttr;
    }
  })();
  if (
    /^#(?:fn|fnref|footnote)\w*/i.test(hash) ||
    /#(?:fn|footnote)\d+(?:[-:_][\w]+)*$/i.test(hash)
  )
    return true;

  if (/\b(return|back)\s+to\s+footnote\b/i.test(textish)) return true;
  if (/\breferrer\b/i.test(textish) && /footnote/i.test(textish)) return true;

  if (
    /\b(doc-noteref|noteref|fnref|fn-rtn|return-footnote|footnote-back)\b/i.test(
      a.className,
    )
  )
    return true;

  return false;
}

/** Strip visible footnote markers from link text */
function stripFootnoteText(text: string): string {
  return (text || '')
    .replace(/\[\d+\]/g, '')
    .replace(/(?:^|\s)\(\s*footnote\s*\d+\s*\)/gi, '')
    .replace(/[*†‡§¶]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type TitleSourceFromExtract = ExtractResult extends { titleSource?: infer T }
  ? T
  : never;
type IntroSourceFromExtract = ExtractResult extends { introSource?: infer T }
  ? T
  : never;
type ContentTextFromExtract = ExtractResult extends { contentText?: infer T }
  ? T
  : string | null;

type DebugExtractResult = ExtractResult & {
  titleSource?: TitleSourceFromExtract;
  introSource?: IntroSourceFromExtract;
  contentText?: ContentTextFromExtract;
  anchorMeta?: { id?: string; headingTag?: string };
};

interface HeadingData {
  order: number;
  type: LinkType;
  text: string;
  href: string;
  absUrl: string | null;
  destH1: string | null;
  matchStatus: MatchStatus;
  searchTerm: string;
  clicks: number | null;

  // Extracted fields (optional)
  extractedSource?: 'canada' | 'external' | 'anchor';
  extractedTitle?: string | null;
  extractedIntro?: string | null;
  extractedCandidate?: string | null;

  // AI verdict (optional)
  aiVerdict?: 'match' | 'mismatch' | 'uncertain';
  aiConfidence?: number; // 0..1
  aiMatchedFields?: AiVerdict['matchedFields'];
  aiRationale?: string;

  repeatCount?: number;
  textVariants?: string[];
  hasTextConflict?: boolean;

  httpStatus?: number | null;
  is404?: boolean;
  anchorMissing?: boolean;

  // derived for UI
  uiHealth?: UiHealth;
}

type ColumnField =
  | 'order'
  | 'type'
  | 'text'
  | 'destH1'
  | 'matchStatus'
  | 'explanation'
  | 'searchTerm'
  | 'clicks';

interface LinkReportColumn {
  field: ColumnField;
  header: string;
}

interface UploadDataShape {
  originalHtml?: string | null;
  modifiedHtml?: string | null;
  pageUrl?: string | null;
}

@Component({
  selector: 'ca-link-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    PopoverModule,
    CheckboxModule,
    ButtonModule,
  ],
  templateUrl: './link-report.component.html',
  styles: [
    `
      /* Center table cells vertically like the Link report */
      :host ::ng-deep th.health-col,
      :host ::ng-deep td.health-col {
        text-align: left;
        padding-left: 0.75rem; /* match your table’s default cell padding */
      }

      .health-cell {
        display: flex;
        align-items: center;
        justify-content: flex-start; /* important */
      }

      /* Pill (chip) used for Health */
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.15rem 0.55rem;
        border-radius: 9999px;
        font-size: 12px;
        line-height: 1;
        white-space: nowrap;
        border: 1px solid transparent;
      }

      /* Same color system for both tables */
      .chip-ok {
        background: #dcfce7;
        color: #166534;
        border-color: #bbf7d0;
      }
      .chip-minor {
        background: #fef3c7;
        color: #92400e;
        border-color: #fde68a;
      }
      .chip-severe {
        background: #fee2e2;
        color: #991b1b;
        border-color: #fecaca;
      }
      .chip-unk {
        background: #e5e7eb;
        color: #374151;
        border-color: #e5e7eb;
      }

      .chip .pi {
        font-size: 0.95rem;
      }
      .chip-label {
        font-weight: 600;
      }

      /* Optional: fix column width so pills line up nicely */
      th.health-col,
      td.health-col {
        width: 9.5rem;
        text-align: center;
      }

      .flex {
        display: flex;
      }
      .justify-center {
        justify-content: center;
      }

      .header-with-filter {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
      }
      .p-button-sm {
        padding: 0.15rem 0.35rem;
        height: 1.6rem;
        width: 1.6rem;
      }
      .filter-panel {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.25rem 0.25rem 0.1rem;
      }
      .filter-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        line-height: 1.2;
      }
      .divider {
        height: 1px;
        background: #e5e7eb;
        margin: 0.25rem 0;
      }
      .filter-label {
        cursor: pointer;
        user-select: none;
      }

      .exp-badge {
        display: inline-block;
        margin-left: 0.35rem;
        padding: 0.1rem 0.45rem;
        font-size: 12px;
        line-height: 1.1;
        border-radius: 9999px;
        background: #fee2e2;
        color: #991b1b;
        border: 1px solid #fecaca;
        white-space: nowrap;
      }
    `,
  ],
})
export class LinkReportComponent implements OnInit {
  @Output() hasProblemsChange = new EventEmitter<boolean>();
  @ViewChild('typePanel') typePanel!: Popover;

  // prefer-inject
  private readonly uploadState = inject(UploadStateService);
  private readonly linkAi = inject(LinkAiService);
  private readonly extractor = inject(ContentExtractorService);
  private readonly fetchService = inject(FetchService);

  // data & selection
  headings: HeadingData[] = [];
  selectedHeading!: HeadingData;

  // columns
  cols: LinkReportColumn[] = [
    { field: 'order', header: 'Index' },
    { field: 'type', header: 'Link Type' },
    { field: 'text', header: 'Link name on page' },
    { field: 'destH1', header: 'Destination link content' },
    { field: 'matchStatus', header: 'Health' }, // renders via uiHealth icon
    { field: 'explanation', header: 'Pain points' },
    { field: 'searchTerm', header: 'Search term' },
    { field: 'clicks', header: 'Clicks' },
  ];

  // --- DEBUG LOGGING HELPERS ---
  private readonly COLLAPSE_GROUPS = false;
  private readonly DEBUG_LOG = true;

  private truncate(s: string | null | undefined, n = 200): string {
    if (s == null) return '';
    const t = String(s).trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  }
  getOtherVariants(row: HeadingData): string[] {
    if (!row?.textVariants?.length) return [];
    return row.textVariants.filter((v) => v !== row.text);
  }

  getOtherVariantsPreview(row: HeadingData, take = 5): string[] {
    return this.getOtherVariants(row).slice(0, take);
  }

  getOtherVariantsExtraCount(row: HeadingData, take = 5): number {
    const total = this.getOtherVariants(row).length;
    return total > take ? total - take : 0;
  }

  private logRowExtraction(
    row: HeadingData,
    source:
      | 'canada'
      | 'external'
      | 'anchor'
      | 'mailto'
      | 'tel'
      | 'download'
      | 'none',
    result: ExtractResult | null,
    meta: DestMeta | null,
    candidate: string | null,
    heuristic: MatchStatus,
    ai: AiVerdict | null,
    finalStatus: MatchStatus,
    err?: unknown,
  ): void {
    if (!this.DEBUG_LOG) return;

    type DebugExtractResult = ExtractResult & {
      titleSource?: TitleSourceFromExtract;
      introSource?: IntroSourceFromExtract;
      contentText?: ContentTextFromExtract;
      anchorMeta?: { id?: string; headingTag?: string };
    };
    const r = (result ?? {}) as DebugExtractResult;
    const header = `[Link#${row.order}] ${row.type} — ${row.text}  →  ${row.absUrl || row.href || ''}`;

    if (this.COLLAPSE_GROUPS) console.groupCollapsed(header);
    else console.group(header);

    console.log('Type:', row.type);
    console.log('href:', row.href);
    console.log('absUrl:', row.absUrl);

    if (row.httpStatus != null) {
      console.log(
        'HTTP status (HEAD):',
        row.httpStatus,
        row.is404 ? '→ NOT FOUND' : '',
      );
    }
    if (row.anchorMissing) {
      console.log('Anchor target not found on the page.');
    }

    if (source === 'canada' && result) {
      console.log(`CANADA H1 (titleSource=${r.titleSource ?? '-'}) ::`);
      console.log(this.truncate(result.title, 1000));
      console.log(`CANADA Intro (introSource=${r.introSource ?? '-'}) ::`);
      console.log(this.truncate(result.intro, 1000));
    } else if (source === 'anchor' && result) {
      console.log('ANCHOR id:', r.anchorMeta?.id || '(none)');
      console.log('ANCHOR heading tag:', r.anchorMeta?.headingTag || '(none)');
      console.log(`Section heading (titleSource=${r.titleSource ?? '-'}) ::`);
      console.log(this.truncate(result.title, 1000));
      console.log(
        `First paragraph in section (introSource=${r.introSource ?? '-'}) ::`,
      );
      console.log(this.truncate(result.intro, 1000));
    } else if (source === 'external' && result) {
      console.log(`EXTERNAL Title (titleSource=${r.titleSource ?? '-'}) ::`);
      console.log(this.truncate(result.title, 1000));
      console.log(`EXTERNAL Intro (introSource=${r.introSource ?? '-'}) ::`);
      console.log(this.truncate(result.intro, 1000));
      if (r.contentText) {
        console.log('EXTERNAL Body preview ::');
        console.log(this.truncate(r.contentText, 1000));
      }
    } else if (row.type === 'mailto' || row.type === 'download') {
      console.log('No extract (mailto/tel/download).');
    } else {
      console.log('No extract — likely blocked host or fetch failure.');
    }

    if (meta) console.log('AI meta sent →', meta);
    console.log('Candidate (title + intro) →');
    console.log(this.truncate(candidate, 1000));

    console.log('Heuristic:', heuristic);
    console.log('AI verdict:', ai);
    console.log('Final matchStatus:', finalStatus);

    if (err) console.warn('Extract/AI error:', err);
    console.groupEnd();
  }

  private logSummaryTable(): void {
    if (!this.DEBUG_LOG) return;
    const rows = this.headings.map((r) => ({
      order: r.order,
      type: r.type,
      text: this.truncate(r.text, 80),
      url: r.absUrl || r.href,
      extractedTitle: this.truncate(r.extractedTitle, 200),
      extractedIntro: this.truncate(r.extractedIntro, 200),
      match: r.matchStatus,
      ui: r.uiHealth,
      ai: r.aiVerdict || '',
      conf: r.aiConfidence ?? '',
    }));
    console.table(rows);
  }

  sourceVersion: 'original' | 'modified' = 'original';

  // ----- Link Type filter (kept) -----
  linkTypes: LinkType[] = [
    'CRA page',
    'Canada.ca',
    'external',
    'anchor',
    'mailto',
    'download',
  ];
  allSelected = true;
  typeChecks: Record<LinkType, boolean> = {
    'CRA page': false,
    'Canada.ca': false,
    external: false,
    anchor: false,
    mailto: false,
    download: false,
  };

  onAllToggle(): void {
    // individuals remain as-is (unchecked) and ignored when ALL = true
  }
  onTypeToggle(t: LinkType): void {
    if (this.allSelected) this.allSelected = false;
    this.typeChecks[t] = !!this.typeChecks[t];
  }
  private activeTypes(): Set<LinkType> {
    if (this.allSelected) return new Set(this.linkTypes);
    const picked = this.linkTypes.filter((t) => this.typeChecks[t]);
    return new Set(picked);
  }

  /** SORT (default: multi → mismatch → match → unknown, then by index) */
  currentSort: { key: 'uiHealth' | 'order'; dir: 'asc' | 'desc' } = {
    key: 'uiHealth',
    dir: 'asc',
  };
  private uiRank: Record<UiHealth, number> = {
    multi: 0,
    mismatch: 1,
    match: 2,
    unknown: 3,
  };

  private compareRows(a: HeadingData, b: HeadingData): number {
    const { key, dir } = this.currentSort;
    const mul = dir === 'asc' ? 1 : -1;

    if (key === 'uiHealth') {
      const ra = this.uiRank[a.uiHealth ?? 'unknown'];
      const rb = this.uiRank[b.uiHealth ?? 'unknown'];
      if (ra !== rb) return (ra - rb) * mul;
      return (a.order - b.order) * 1;
    }
    return (a.order - b.order) * mul;
  }

  /** Table source = filtered (by link type) + sorted */
  get tableRows(): HeadingData[] {
    const active = this.activeTypes();
    return [...this.headings]
      .filter((r) => active.has(r.type))
      .sort((a, b) => this.compareRows(a, b));
  }

  ngOnInit(): void {
    void this.extractLinks();
  }

  private emitProblems(): void {
    const hasProblems = this.headings.some(
      (r) =>
        r.hasTextConflict ||
        r.is404 ||
        r.anchorMissing ||
        r.matchStatus === 'mismatch',
    );
    this.hasProblemsChange.emit(hasProblems);
  }

  /** Build a stable key for the "destination" (dedupe by this). */
  private destKeyForRow(
    r: Pick<HeadingData, 'type' | 'absUrl' | 'href'>,
  ): string {
    const raw = r.absUrl || r.href || '';
    if (!raw) return '';

    // anchor links are intentionally kept distinct by their hash
    if (r.type === 'anchor') {
      return raw.trim().toLowerCase();
    }

    try {
      // 1) normalize URL
      let u = new URL(raw);

      // Force https for stability
      u.protocol = 'https:';

      // Lowercase host and fold apex→www for canada.ca
      u.hostname = u.hostname
        .toLowerCase()
        .replace(/^canada\.ca$/, 'www.canada.ca');

      // Canonicalize AEM repo paths to vanity
      u = new URL(canonicalizeCanadaHref(u.toString()));

      // Drop hash and query
      u.hash = '';
      u.search = '';

      // Fold index.html
      u.pathname = u.pathname.replace(/\/index\.html?$/i, '/');

      // CRA folding (regional code before -e.html)
      if (/^\/en\/revenue-agency\//i.test(u.pathname)) {
        const PT = new Set([
          'ab',
          'bc',
          'mb',
          'nb',
          'nl',
          'ns',
          'nt',
          'nu',
          'on',
          'pe',
          'qc',
          'sk',
          'yt',
          'c',
        ]);
        u.pathname = u.pathname.replace(
          /\/([^/]+?)-([a-z]{1,3})-e\.html$/i,
          (_m, base, code) =>
            PT.has(String(code).toLowerCase()) ? `/${base}-e.html` : _m,
        );
      }

      // Trim trailing slash (but not root)
      if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
        u.pathname = u.pathname.slice(0, -1);
      }

      return u.toString();
    } catch {
      return raw.trim().toLowerCase();
    }
  }

  private dedupeByDestination(rows: HeadingData[]): HeadingData[] {
    interface Group {
      rep: HeadingData;
      names: Set<string>;
      count: number;
    }

    const map = new Map<string, Group>();

    for (const r of rows) {
      const key = this.destKeyForRow(r) || `row-${r.order}`;
      const g = map.get(key);
      if (g) {
        g.count += 1;
        g.names.add(r.text);
      } else {
        map.set(key, { rep: { ...r }, names: new Set([r.text]), count: 1 });
      }
    }

    const out: HeadingData[] = [];
    let idx = 1;
    for (const { rep, names, count } of map.values()) {
      out.push({
        ...rep,
        order: idx++,
        repeatCount: count,
        hasTextConflict: names.size > 1,
        textVariants: Array.from(names),
      });
    }
    return out;
  }

  /** Convert raw signals into the single UI icon state */
  private deriveUiHealth(r: HeadingData): UiHealth {
    const issues = [
      r.is404 ? '404' : null,
      r.anchorMissing ? 'anchor' : null,
      r.hasTextConflict ? 'conflict' : null,
      r.matchStatus === 'mismatch' ? 'mismatch' : null,
    ].filter(Boolean).length;

    if (issues >= 2) return 'multi';
    if (r.matchStatus === 'mismatch') return 'mismatch';
    if (r.matchStatus === 'match') return 'match';
    return 'unknown';
  }

  async extractLinks(): Promise<void> {
    const { html, baseUrl } = this.getHtmlToAnalyze();
    if (!html) {
      this.headings = [];
      return;
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');

    // Collect anchors, drop all footnotes/backlinks
    const anchors = Array.from(
      doc.querySelectorAll<HTMLAnchorElement>('body a[href]'),
    ).filter((a) => {
      if (isFootnoteLink(a)) return false;
      const href = (a.getAttribute('href') || '').trim().toLowerCase();
      if (href.startsWith('tel:')) return false;
      return true;
    });

    // 1) Build initial rows
    const initialRows: HeadingData[] = anchors.map((a, i): HeadingData => {
      const rawHref = (a.getAttribute('href') || '').trim();
      const absUrl = this.resolveUrl(rawHref, baseUrl);

      const visible =
        a.textContent || a.getAttribute('aria-label') || a.title || '';
      const text = stripFootnoteText(visible);

      const type = this.classify(rawHref, absUrl, a);

      let destH1: string | null = null;
      let matchStatus: MatchStatus = 'unknown';

      if (type === 'anchor') {
        const h1 = doc.querySelector('h1');
        destH1 = h1 ? (h1.textContent || '').trim() : null;
        matchStatus = this.smartMatch(text, destH1);
      } else if (type === 'mailto' || type === 'download') {
        matchStatus = 'na';
      } else {
        const { guess, pathTokens } = this.smartSlugGuess(
          text,
          absUrl || rawHref,
        );
        destH1 = guess;
        matchStatus = this.smartMatch(text, destH1, pathTokens);
      }

      return {
        order: i + 1,
        type,
        text,
        href: rawHref,
        absUrl,
        destH1,
        matchStatus,
        searchTerm: '',
        clicks: null,
      };
    });

    // 1.5) DEDUPE
    this.headings = this.dedupeByDestination(initialRows).map((r) => ({
      ...r,
      uiHealth: this.deriveUiHealth(r),
    }));

    // 2) Enrich (extract + AI)
    await this.enrichWithExtractedContent(doc);

    this.emitProblems();
  }

  /** HEAD the destination to detect 404/410/etc. */
  private async checkUrlStatus(absUrl: string): Promise<number | null> {
    try {
      const url = new URL(absUrl);
      const hostLc = url.hostname.toLowerCase().replace(/^www\./, '');
      const hostMode = hostLc === 'canada.ca' ? 'prod' : 'none';
      const resp = await this.fetchService.fetchStatus(
        absUrl,
        hostMode,
        2,
        'none',
      );
      return resp.status ?? null;
    } catch {
      return null;
    }
  }

  /** Treat 404/410 as "not found". */
  private isNotFoundStatus(code: number | null | undefined): boolean {
    return code === 404 || code === 410;
  }

  private async enrichWithExtractedContent(sourceDoc: Document): Promise<void> {
    const rows = this.headings;
    const CONCURRENCY = Math.min(4, rows.length);
    let idx = 0;

    const worker = async () => {
      for (;;) {
        const i = idx++;
        if (i >= rows.length) break;
        const row = rows[i];

        // Skip types we won't fetch, but keep uiHealth derived
        if (row.type === 'mailto' || row.type === 'download') {
          rows[i] = { ...row, uiHealth: this.deriveUiHealth(row) };
          continue;
        }

        let result: ExtractResult | null = null;
        let source: 'canada' | 'external' | 'anchor' | null = null;
        let lastError: unknown = null;

        try {
          if (row.type === 'anchor') {
            const res = this.extractor.extractAnchor(sourceDoc, row.href);
            result = res;
            source = 'anchor';
          } else if (row.absUrl) {
            let isCanada = false;
            try {
              const u = new URL(row.absUrl);
              isCanada = isCanadaHost(u);
            } catch {
              /* ignore */
            }
            if (isCanada) {
              result = await this.extractor.extractCanada(row.absUrl, {
                retries: 2,
                delay: 'none',
              });
              source = 'canada';
            } else {
              result = await this.extractor.extractExternal(row.absUrl, {
                retries: 2,
                delay: 'none',
              });
              source = 'external';
            }
          }
        } catch (err) {
          lastError = err;
        }

        if (result) {
          const candidate = this.extractor.buildCandidateText(result);

          // Build minimal DestMeta for AI
          const meta: DestMeta = {
            finalUrl: row.absUrl ?? row.href ?? null,
            h1: result.title ?? null,
            title: result.title ?? null,
            metaDescription: result.intro ?? null,
            headings: row.destH1 ? [row.destH1] : [],
            bodyPreview:
              (result as DebugExtractResult).contentText ||
              result.intro ||
              null,
          };

          // Ask AI
          let ai: AiVerdict | null = null;
          try {
            ai = await this.linkAi.judge(row.text, meta);
          } catch (err) {
            lastError = lastError || err;
          }

          // Blend AI with heuristic
          const heuristic: MatchStatus = this.smartMatch(row.text, candidate);
          const blend = (
            v: AiVerdict | null,
            fallback: MatchStatus,
          ): MatchStatus => {
            if (!v) return fallback;
            if (v.verdict === 'match' && v.confidence >= 0.7) return 'match';
            if (v.verdict === 'mismatch' && v.confidence >= 0.7)
              return 'mismatch';
            return fallback;
          };
          const base = heuristic === 'unknown' ? row.matchStatus : heuristic;
          const finalStatus = blend(ai, base);

          rows[i] = {
            ...row,
            extractedSource: source || undefined,
            extractedTitle: result.title ?? null,
            extractedIntro: result.intro ?? null,
            extractedCandidate: candidate || null,
            destH1: result.title ?? row.destH1,
            matchStatus: finalStatus,
            aiVerdict: ai?.verdict,
            aiConfidence: ai?.confidence,
            aiMatchedFields: ai?.matchedFields,
            aiRationale: ai?.rationale,
          };

          // LOG
          this.logRowExtraction(
            rows[i],
            source || 'none',
            result,
            meta,
            candidate,
            heuristic,
            ai,
            finalStatus,
            lastError,
          );

          // Re-derive UI state
          rows[i] = { ...rows[i], uiHealth: this.deriveUiHealth(rows[i]) };
        } else {
          // No extract — keep row as-is and update UI state
          rows[i] = { ...row, uiHealth: this.deriveUiHealth(row) };
          this.logRowExtraction(
            row,
            (source as unknown as 'none') || 'none',
            null,
            null,
            null,
            row.matchStatus,
            null,
            row.matchStatus,
            lastError,
          );
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    // trigger change detection
    this.headings = [...rows];

    // Final summary table
    this.logSummaryTable();
  }

  // ---------- helpers ----------

  private getHtmlToAnalyze(): { html: string | null; baseUrl: string | null } {
    const get = this.uploadState.getUploadData?.();
    const data: unknown = get;

    const shape = (d: unknown): UploadDataShape | null => {
      if (d && typeof d === 'object') {
        const o = d as Record<string, unknown>;
        return {
          originalHtml: (o['originalHtml'] as string) ?? null,
          modifiedHtml: (o['modifiedHtml'] as string) ?? null,
          pageUrl: (o['pageUrl'] as string) ?? null,
        };
      }
      return null;
    };

    const parsed = shape(data);

    if (!parsed) return { html: null, baseUrl: null };

    const html: string | null =
      (this.sourceVersion === 'modified'
        ? parsed.modifiedHtml
        : parsed.originalHtml) || null;

    let baseUrl: string | null = null;
    if (html) {
      try {
        const tmp = new DOMParser().parseFromString(html, 'text/html');
        const b = tmp.querySelector('base[href]')?.getAttribute('href')?.trim();
        if (b) baseUrl = b;
      } catch {
        /* ignore */
      }
    }
    if (!baseUrl && parsed.pageUrl) baseUrl = parsed.pageUrl;

    return { html, baseUrl };
  }

  private resolveUrl(href: string, baseUrl: string | null): string | null {
    try {
      if (!href) return null;
      if (
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:')
      ) {
        return href; // no network calls for these
      }

      // Canonicalize Canada.ca AEM repo paths & root-relative links
      if (/^\/(?:content\/canadasite|en|fr)\//i.test(href)) {
        const canon = canonicalizeCanadaHref(href);
        return new URL(canon, CANADA_ORIGIN).toString();
      }

      // Absolute canada.ca URL that still has /content/canadasite
      if (/^https?:\/\/(?:www\.)?canada\.ca\/content\/canadasite/i.test(href)) {
        return canonicalizeCanadaHref(href);
      }

      // Normal resolution
      let out: URL;
      if (baseUrl) out = new URL(href, baseUrl);
      else out = new URL(href);

      // FetchService only allows www.canada.ca (not apex)
      const hostLc = out.hostname.toLowerCase().replace(/^www\./, '');
      if (hostLc === 'canada.ca') {
        out.hostname = 'www.canada.ca';
      }

      return out.toString();
    } catch {
      return null;
    }
  }

  buildMismatchReason(row: HeadingData): string {
    if (row.aiRationale && row.aiRationale.trim()) {
      return row.aiRationale.trim();
    }
    const parts: string[] = [];
    if (row.hasTextConflict)
      parts.push('Different link names → same destination.');
    if (row.is404) parts.push('Destination not found (404/410).');
    if (row.anchorMissing) parts.push('Anchor target missing.');
    if (!parts.length) parts.push('Reason placeholder.');
    return parts.join(' ');
  }

  /** 6-type classifier; order matters. Canada.ca = apex or www only. */
  private classify(
    href: string,
    absUrl: string | null,
    anchorEl?: HTMLAnchorElement,
  ): LinkType {
    const raw = (href || '').trim();

    // 1) anchor
    if (raw.startsWith('#')) return 'anchor';

    // 2) special schemes
    if (/^mailto:/i.test(raw)) return 'mailto';

    // 3) download (pdf / <a download> / /webform path)
    const pathForTest = absUrl || raw;
    const isPdf = /\.pdf(\?|#|$)/i.test(pathForTest);
    const hasDownloadAttr = !!anchorEl?.hasAttribute('download');
    let isWebform = false;
    try {
      const u = new URL(absUrl || raw, CANADA_ORIGIN);
      isWebform = /\/webform(s)?\//i.test(u.pathname);
    } catch {
      /* ignore */
    }
    if (isPdf || hasDownloadAttr || isWebform) return 'download';

    // 4) Host-based classification
    try {
      const u = new URL(absUrl || raw, CANADA_ORIGIN);
      const hostLc = u.hostname.toLowerCase().replace(/^www\./, '');

      if (hostLc === 'canada.ca') {
        const p = u.pathname.toLowerCase();
        if (p.startsWith('/en/revenue-agency')) return 'CRA page';
        if (p.startsWith('/en/services')) return 'Canada.ca';
        return 'Canada.ca';
      }
    } catch {
      /* fall through */
    }

    // 5) everything else
    return 'external';
  }

  // ---------- smart slug + smart match ----------
  private normalizeText(s: string) {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[/\-_]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

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

  private smartSlugGuess(
    linkText: string,
    absUrl?: string | null,
  ): { guess: string | null; pathTokens: Set<string> } {
    const linkTokens = this.tokenize(linkText);
    const segs = this.pathSegments(absUrl);

    const IGNORE = new Set([
      'en',
      'fr',
      'gov',
      'content',
      'services',
      'service',
      'government',
      'governments',
      'government-id',
      'id',
      'topics',
      'programs',
      'about',
      'info',
    ]);

    const splitHard = (s: string): string[] => {
      const spaced = s
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Za-z])([0-9])/g, '$1 $2')
        .replace(/([0-9])([A-Za-z])/g, '$1 $2');
      const soft = spaced.replace(
        /(bcservice|bcservices|service|services|card|login|app)/gi,
        ' $1 ',
      );
      const tokens = this.tokenize(soft);
      return tokens.length ? tokens : this.tokenize(spaced);
    };

    const segTokensList = segs.map((raw) => {
      const lowered = raw.toLowerCase();
      if (IGNORE.has(lowered)) return [] as string[];
      const tokens = this.tokenize(raw);
      if (tokens.length <= 1 && /[a-z]{8,}/i.test(raw)) return splitHard(raw);
      return tokens;
    });

    const allTokens = new Set<string>();
    for (const toks of segTokensList) for (const t of toks) allTokens.add(t);

    let bestGuess: string | null = null;
    let bestScore = -1;
    for (let i = 0; i < segTokensList.length; i++) {
      const segTokens = segTokensList[i];
      if (!segTokens.length) continue;

      let score = 0;
      if (linkTokens.length) {
        const cover =
          linkTokens.filter((t) => segTokens.includes(t)).length /
          linkTokens.length;
        const setL = new Set(linkTokens);
        const setS = new Set(segTokens);
        const inter = [...setL].filter((w) => setS.has(w)).length;
        const union = new Set([...setL, ...setS]).size || 1;
        const jacc = inter / union;
        score = cover * 0.7 + jacc * 0.3;
      }
      // prefer later segments on ties
      score += i / 1000;

      if (score > bestScore) {
        bestScore = score;
        bestGuess = segTokens.join(' ');
      }
    }

    if (!bestGuess) {
      for (let i = segs.length - 1; i >= 0; i--) {
        const s = segs[i].toLowerCase();
        if (IGNORE.has(s)) continue;
        const toks = splitHard(segs[i]);
        bestGuess = toks.join(' ') || segs[i];
        for (const t of toks) allTokens.add(t);
        break;
      }
    }

    return { guess: bestGuess, pathTokens: allTokens };
  }

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

    return j >= 0.6 ? 'match' : 'mismatch';
  }

  getTextStyle(row: HeadingData) {
    return row.matchStatus === 'na' ? { opacity: 0.7 } : {};
  }
}
