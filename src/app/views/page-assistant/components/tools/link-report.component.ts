import { Component, OnInit, ViewChild } from '@angular/core';
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

type LinkType =
  | 'Canada.ca'
  | 'external'
  | 'anchor'
  | 'tel'
  | 'mailto'
  | 'download';
type MatchStatus = 'match' | 'mismatch' | 'unknown' | 'na';

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

/** Drop any kind of footnote link (refs + “return to footnote … referrer”, etc.) */
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

/** Strip visible footnote markers like “[1]”, “†”, “(footnote 3)” from link text */
function stripFootnoteText(text: string): string {
  return (text || '')
    .replace(/\[\d+\]/g, '')
    .replace(/(?:^|\s)\(\s*footnote\s*\d+\s*\)/gi, '')
    .replace(/[*†‡§¶]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface HeadingData {
  order: number; // Index
  type: LinkType; // Link Type
  text: string; // Link name on page
  href: string; // Original href
  absUrl: string | null; // Resolved absolute URL
  destH1: string | null; // Destination title (guessed/extracted)
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
}

type ColumnField =
  | 'order'
  | 'type'
  | 'text'
  | 'destH1'
  | 'matchStatus'
  | 'searchTerm'
  | 'clicks';

interface LinkReportColumn {
  field: ColumnField;
  header: string;
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
      .text-ok {
        color: #16a34a;
      }
      .text-bad {
        color: #dc2626;
      }
      .text-unk {
        color: #64748b;
      }
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
      .filter-muted {
        color: #6b7280;
        font-size: 12px;
      }
    `,
  ],
})
export class LinkReportComponent implements OnInit {
  constructor(
    private uploadState: UploadStateService,
    private linkAi: LinkAiService,
    private extractor: ContentExtractorService,
  ) {}

  @ViewChild('typePanel') typePanel!: Popover;

  // data & selection
  headings: HeadingData[] = [];
  selectedHeading!: HeadingData;

  // columns (with placeholders at the end)
  cols: LinkReportColumn[] = [
    { field: 'order', header: 'Index' },
    { field: 'type', header: 'Link Type' },
    { field: 'text', header: 'Link name on page' },
    { field: 'destH1', header: 'Destination link header (H1)' },
    { field: 'matchStatus', header: 'Match' },
    { field: 'searchTerm', header: 'Search term' },
    { field: 'clicks', header: 'Clicks' },
  ];

  // --- DEBUG LOGGING HELPERS ---
  private readonly COLLAPSE_GROUPS = false;
  // Turn logging on/off
  private readonly DEBUG_LOG = true;

  // Helper to keep logs readable
  private truncate(s: string | null | undefined, n = 200): string {
    if (s == null) return '';
    const t = String(s).trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
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

    const r: any = result as any; // ok even if your ExtractResult doesn’t have debug fields
    const header = `[Link#${row.order}] ${row.type} — ${row.text}  →  ${row.absUrl || row.href || ''}`;

    if (this.COLLAPSE_GROUPS) console.groupCollapsed(header);
    else console.group(header);

    console.log('Type:', row.type);
    console.log('href:', row.href);
    console.log('absUrl:', row.absUrl);

    if (source === 'canada' && result) {
      console.log(`CANADA H1 (titleSource=${r?.titleSource ?? '-'}) ::`);
      console.log(this.truncate(result.title, 1000)); // <-- exact text
      console.log(`CANADA Intro (introSource=${r?.introSource ?? '-'}) ::`);
      console.log(this.truncate(result.intro, 1000)); // <-- exact text
    } else if (source === 'anchor' && result) {
      console.log('ANCHOR id:', r?.anchorMeta?.id || '(none)');
      console.log('ANCHOR heading tag:', r?.anchorMeta?.headingTag || '(none)');
      console.log(`Section heading (titleSource=${r?.titleSource ?? '-'}) ::`);
      console.log(this.truncate(result.title, 1000)); // <-- exact text (H2/H3/H4 or target text)
      console.log(
        `First paragraph in section (introSource=${r?.introSource ?? '-'}) ::`,
      );
      console.log(this.truncate(result.intro, 1000)); // <-- exact text
    } else if (source === 'external' && result) {
      console.log(`EXTERNAL Title (titleSource=${r?.titleSource ?? '-'}) ::`);
      console.log(this.truncate(result.title, 1000)); // <-- exact text
      console.log(`EXTERNAL Intro (introSource=${r?.introSource ?? '-'}) ::`);
      console.log(this.truncate(result.intro, 1000)); // <-- exact text
      if (r?.contentText) {
        console.log('EXTERNAL Body preview ::');
        console.log(this.truncate(r.contentText, 1000)); // <-- exact text
      }
    } else if (
      row.type === 'mailto' ||
      row.type === 'tel' ||
      row.type === 'download'
    ) {
      console.log('No extract (mailto/tel/download).');
    } else {
      console.log('No extract — likely blocked host or fetch failure.');
    }

    if (meta) {
      console.log('AI meta sent →', meta);
    }

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
      // show the exact extracted strings in the summary too
      extractedTitle: this.truncate(r.extractedTitle, 200),
      extractedIntro: this.truncate(r.extractedIntro, 200),
      match: r.matchStatus,
      ai: r.aiVerdict || '',
      conf: r.aiConfidence ?? '',
    }));
    console.table(rows);
  }

  sourceVersion: 'original' | 'modified' = 'original';

  // ----- Filter state (dropdown with ALL + 6 types) -----
  linkTypes: LinkType[] = [
    'Canada.ca',
    'external',
    'anchor',
    'tel',
    'mailto',
    'download',
  ];

  /** ALL is checked by default (means: include all types). */
  allSelected = true;

  /** Individual type checkboxes are listed, initially unchecked. */
  typeChecks: Record<LinkType, boolean> = {
    'Canada.ca': false,
    external: false,
    anchor: false,
    tel: false,
    mailto: false,
    download: false,
  };

  onAllToggle(): void {
    // nothing else needed; individuals remain as-is (unchecked) and ignored when ALL = true
  }

  onTypeToggle(_t: LinkType): void {
    if (this.allSelected) this.allSelected = false;
  }

  toggleType(t: LinkType): void {
    if (this.allSelected) this.allSelected = false;
    this.typeChecks[t] = !this.typeChecks[t];
  }

  private activeTypes(): Set<LinkType> {
    if (this.allSelected) return new Set(this.linkTypes);
    const picked = this.linkTypes.filter((t) => this.typeChecks[t]);
    return new Set(picked);
  }

  get filteredHeadings(): HeadingData[] {
    const active = this.activeTypes();
    return this.headings.filter((r) => active.has(r.type));
  }

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

    // Collect anchors, drop all footnotes/backlinks
    const anchors = Array.from(
      doc.querySelectorAll<HTMLAnchorElement>('body a[href]'),
    ).filter((a) => !isFootnoteLink(a));

    // 1) Build initial rows using current logic
    this.headings = anchors.map((a, i): HeadingData => {
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
      } else if (type === 'mailto' || type === 'tel' || type === 'download') {
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

    // 2) Enrich with extracted destination content and recompute matchStatus
    await this.enrichWithExtractedContent(doc);
  }

  /**
   * For each row, use ContentExtractorService to fetch a better "candidate text"
   * (title + intro), ask AI, and re-evaluate matchStatus. Logs the exact content used.
   */
  private async enrichWithExtractedContent(sourceDoc: Document): Promise<void> {
    const rows = this.headings;

    const CONCURRENCY = Math.min(4, rows.length);
    let idx = 0;

    const worker = async () => {
      while (true) {
        const i = idx++;
        if (i >= rows.length) break;
        const row = rows[i];

        // Skip types we won't fetch, but LOG it as N/A
        if (
          row.type === 'mailto' ||
          row.type === 'tel' ||
          row.type === 'download'
        ) {
          this.logRowExtraction(
            row,
            row.type,
            null,
            null,
            null,
            row.matchStatus,
            null,
            row.matchStatus,
          );
          continue; // already 'na'
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
            // Decide canada vs external by host
            let isCanada = false;
            try {
              const u = new URL(row.absUrl);
              isCanada = isCanadaHost(u);
            } catch {}
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
            bodyPreview: (result as any).contentText || result.intro || null,
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
            return fallback; // uncertain/low-confidence → keep heuristic
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

          // LOG success case with exact content
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
        } else {
          // No result (blocked/failed/no absUrl) — keep row as-is and LOG it
          this.logRowExtraction(
            row,
            (source as any) || 'none',
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

    // trigger change detection by reassigning
    this.headings = [...rows];

    // Final summary table
    this.logSummaryTable();
  }

  // ---------- helpers ----------

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
    if (!baseUrl && (data as any).pageUrl) baseUrl = (data as any).pageUrl;

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
    if (/^tel:/i.test(raw)) return 'tel';

    // 3) download (pdf / <a download> / /webform path)
    const pathForTest = absUrl || raw;
    const isPdf = /\.pdf(\?|#|$)/i.test(pathForTest);
    const hasDownloadAttr = !!anchorEl?.hasAttribute('download');
    let isWebform = false;
    try {
      const u = new URL(absUrl || raw, CANADA_ORIGIN);
      isWebform = /\/webform(s)?\//i.test(u.pathname);
    } catch {}
    if (isPdf || hasDownloadAttr || isWebform) return 'download';

    // 4) Canada.ca host (apex or www)
    try {
      const u = new URL(absUrl || raw, CANADA_ORIGIN);
      if (isCanadaHost(u)) return 'Canada.ca';
    } catch {
      // fall through
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
      .replace(/[\/\-_]+/g, ' ')
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
        const score = cover * 0.7 + jacc * 0.3;

        if (score > bestScore) {
          bestScore = score;
          bestGuess = segTokens.join(' ') || seg;
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

  // style hooks used by template
  getTextStyle(_row: HeadingData) {
    return {};
  }
  getTextClass(_row: HeadingData) {
    return {};
  }
}
