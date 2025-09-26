import { Injectable, inject } from '@angular/core';
import { FetchService } from '../../../services/fetch.service';

export type SourceKind = 'canada' | 'anchor' | 'external';
export type DevDelay = 'none' | 'random' | number;

export interface ExtractResult {
  source: SourceKind;
  title: string | null; // H1 (or section heading) or <title>
  intro: string | null; // “lead” / first meaningful paragraph / meta description
  contentText?: string | null; // optional fuller text (externals)
  titleSource?:
    | 'main>h1'
    | 'document h1'
    | 'h1'
    | 'title'
    | 'anchorHeading'
    | 'anchorText';
  introSource?:
    | 'gc-lead'
    | 'lead'
    | 'pagetagline'
    | 'p.lead'
    | 'firstMeaningfulPBeforeH2'
    | 'firstMeaningfulP'
    | 'metaDescription'
    | 'firstParas'
    | 'anchorSectionP'
    | null;

  // NEW: anchor specifics
  anchorMeta?: { id?: string; headingTag?: string };
}

export interface ExtractOpts {
  retries?: number;
  delay?: DevDelay;
}
export interface DestMeta {
  finalUrl: string | null;
  h1?: string | null;
  title?: string | null;
  ogTitle?: string | null;
  metaDescription?: string | null;
  headings?: string[]; // H2/H3 etc.
  bodyPreview?: string | null; // short paragraph blob
}

@Injectable({ providedIn: 'root' })
export class ContentExtractorService {
  private readonly CANADA_ORIGIN = 'https://www.canada.ca';

  // prefer-inject over constructor DI
  private readonly fetchService = inject(FetchService);

  // ========== PUBLIC API ==========

  /** Fetch & extract from a Canada.ca page (H1 + intro) */
  async extractCanada(
    absUrl: string,
    opts?: ExtractOpts,
  ): Promise<ExtractResult | null> {
    const retries = opts?.retries ?? 3;
    const delay = opts?.delay ?? 'none';
    try {
      const doc = await this.fetchService.fetchContent(
        absUrl,
        'prod',
        retries,
        delay,
      );
      return this.fromCanadaDoc(doc);
    } catch {
      return null;
    }
  }

  /** Fetch & extract from an external page allowed by your fetchService */
  async extractExternal(
    absUrl: string,
    opts?: ExtractOpts,
  ): Promise<ExtractResult | null> {
    const retries = opts?.retries ?? 3;
    const delay = opts?.delay ?? 'none';
    try {
      // allow any host (still subject to browser CORS)
      const doc = await this.fetchService.fetchContent(
        absUrl,
        'none',
        retries,
        delay,
      );
      return this.fromExternalDoc(doc);
    } catch (e) {
      // You’ll hit this on CORS-blocked sites
      console.warn('extractExternal CORS/Fetch error for', absUrl, e);
      return null;
    }
  }

  /** Extract from a same-page #anchor using the already-uploaded page Document (no network). */
  extractAnchor(sourceDoc: Document, hashHref: string): ExtractResult {
    const id = (hashHref || '').replace(/^#/, '').trim();
    const target = this.findAnchorTarget(sourceDoc, id);
    if (!target) {
      return { source: 'anchor', title: null, intro: null };
    }

    // Prefer H2/H3/H4 right at/near the target
    const heading = this.closestHeading(target);
    const title = this.cleanText(
      heading?.textContent || target.textContent || null,
    );
    const intro = this.cleanText(
      this.firstParagraphInSection(heading || target),
    );

    return { source: 'anchor', title, intro };
  }

  /** Combine title + intro into a single candidate string you can feed your smartMatch() */
  buildCandidateText(res: ExtractResult | null): string {
    if (!res) return '';
    return [res.title || '', res.intro || ''].filter(Boolean).join(' ').trim();
  }

  // ========== CANADA.CA RULES ==========

  private fromCanadaDoc(doc: Document): ExtractResult {
    const main = doc.querySelector('main') || doc.body;

    // H1 with source tag
    let titleSource: ExtractResult['titleSource'] = undefined;
    const h1Text: string | null =
      main.querySelector('h1')?.textContent?.trim() ||
      doc.querySelector('h1')?.textContent?.trim() ||
      null;

    if (main.querySelector('h1')) titleSource = 'main>h1';
    else if (doc.querySelector('h1')) titleSource = 'document h1';

    // Intro paragraph heuristics with source tag
    let introEl: Element | null =
      main.querySelector('.gc-lead, .lead, .pagetagline, p.lead') || null;
    let introSource: ExtractResult['introSource'] = null;

    if (introEl) {
      const cls = introEl.classList;
      if (cls.contains('gc-lead')) introSource = 'gc-lead';
      else if (cls.contains('pagetagline')) introSource = 'pagetagline';
      else if (cls.contains('lead') && introEl.tagName === 'P')
        introSource = 'p.lead';
      else introSource = 'lead'; // generic match from the selector list
    } else {
      const beforeH2 = this.firstMeaningfulPBeforeHeading(main, /^H2$/i);
      if (beforeH2) {
        introEl = beforeH2;
        introSource = 'firstMeaningfulPBeforeH2';
      } else {
        const firstP = this.firstMeaningfulP(main);
        introEl = firstP;
        introSource = firstP ? 'firstMeaningfulP' : null;
      }
    }

    const title = this.cleanText(h1Text);
    const intro = this.cleanText(introEl?.textContent || null);

    return {
      source: 'canada',
      title,
      intro,
      titleSource,
      introSource,
    };
  }

  // ========== EXTERNAL RULES ==========

  private fromExternalDoc(doc: Document): ExtractResult {
    let titleSource: ExtractResult['titleSource'] = undefined;

    const h1El = doc.querySelector('h1');
    const h1 = h1El?.textContent?.trim() || null;
    const ogTitle =
      doc
        .querySelector('meta[property="og:title"]')
        ?.getAttribute('content')
        ?.trim() || null;
    const titleTag = doc.querySelector('title')?.textContent?.trim() || null;

    const title = this.cleanText(h1 || ogTitle || titleTag) || null;
    titleSource = h1 ? 'h1' : 'title'; // we reuse 'title' for og:title to keep the union happy

    const metaDesc =
      doc
        .querySelector('meta[name="description"]')
        ?.getAttribute('content')
        ?.trim() || null;
    const ogDesc =
      doc
        .querySelector('meta[property="og:description"]')
        ?.getAttribute('content')
        ?.trim() || null;

    const paras = Array.from(doc.querySelectorAll('p'))
      .map((p) => (p.textContent || '').trim())
      .filter((t) => this.isMeaningful(t))
      .slice(0, 2);

    const introRaw =
      metaDesc || ogDesc || (paras.length ? paras.join('  ') : null);
    const intro = this.cleanText(introRaw) || null;

    const introSource: ExtractResult['introSource'] = metaDesc
      ? 'metaDescription'
      : paras.length
        ? 'firstParas'
        : null;

    return {
      source: 'external',
      title,
      intro,
      contentText: this.cleanText(paras.join('  ')) || null,
      titleSource,
      introSource,
    };
  }

  buildDestMetaFromDoc(doc: Document, finalUrl: string | null): DestMeta {
    const h1 = doc.querySelector('h1')?.textContent?.trim() || null;
    const title = doc.querySelector('title')?.textContent?.trim() || null;
    const ogTitle =
      doc
        .querySelector('meta[property="og:title"]')
        ?.getAttribute('content')
        ?.trim() || null;
    const metaDescription =
      doc
        .querySelector('meta[name="description"]')
        ?.getAttribute('content')
        ?.trim() || null;

    const headings = Array.from(doc.querySelectorAll('h2, h3'))
      .map((h) => (h.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 10)
      .map((t) => this.cleanText(t) || '')
      .filter(Boolean);

    const paras = Array.from(doc.querySelectorAll('p'))
      .map((p) => (p.textContent || '').trim())
      .filter((t) => this.isMeaningful(t))
      .slice(0, 2)
      .join('  ');

    return {
      finalUrl,
      h1: this.cleanText(h1),
      title: this.cleanText(title),
      ogTitle: this.cleanText(ogTitle),
      metaDescription: this.cleanText(metaDescription),
      headings,
      bodyPreview: this.cleanText(paras) || null,
    };
  }

  /** Build a DestMeta from a same-page #anchor (no network). */
  buildDestMetaFromAnchor(sourceDoc: Document, hashHref: string): DestMeta {
    const res = this.extractAnchor(sourceDoc, hashHref);
    return {
      finalUrl: hashHref || null,
      h1: res.title,
      title: res.title,
      metaDescription: res.intro,
      headings: res.title ? [res.title] : [],
      bodyPreview: res.intro || null,
    };
  }

  // ========== ANCHOR HELPERS ==========

  private findAnchorTarget(doc: Document, id: string): Element | null {
    if (!id) return null;
    // support both id= and name= anchors (no explicit any)
    const cssNs = (globalThis as { CSS?: { escape?: (s: string) => string } })
      .CSS;
    const safe = cssNs?.escape
      ? cssNs.escape(id)
      : id.replace(/["\\]/g, '\\$&');
    return doc.getElementById(id) || doc.querySelector(`[name="${safe}"]`);
  }

  private closestHeading(start: Element): Element | null {
    // If the target is a heading itself
    if (/^H[2-4]$/i.test(start.tagName)) return start;

    // Look within the same container for direct child heading
    const direct = start.querySelector(':scope > h2, :scope > h3, :scope > h4');
    if (direct) return direct;

    // Walk back to previous siblings to find a heading
    let sib: Element | null = start;
    while ((sib = sib.previousElementSibling || null)) {
      if (/^H[2-4]$/i.test(sib.tagName)) return sib;
      const inner = sib.querySelector('h2, h3, h4');
      if (inner) return inner;
    }

    // Bubble up towards main/article/body
    let el: Element | null = start.parentElement;
    while (el && !/^MAIN|ARTICLE|BODY$/i.test(el.tagName)) {
      const h = el.querySelector(':scope > h2, :scope > h3, :scope > h4');
      if (h) return h;
      el = el.parentElement;
    }

    return null;
  }

  private firstParagraphInSection(sectionRoot: Element): string | null {
    // First meaningful <p> until next H2/H3 as sibling
    let el: Element | null = sectionRoot.nextElementSibling;
    while (el) {
      if (/^H[2-4]$/i.test(el.tagName)) break;
      if (el.tagName === 'P' && this.isMeaningful(el.textContent || '')) {
        return el.textContent?.trim() || null;
      }
      el = el.nextElementSibling;
    }
    return null;
  }

  // ========== GENERIC HELPERS ==========

  private cleanText(s: string | null | undefined): string | null {
    if (!s) return null;
    return s
      .replace(/\[\d+\]/g, '') // [1]
      .replace(/(?:^|\s)\(\s*footnote\s*\d+\s*\)/gi, '') // (footnote 3)
      .replace(/[*†‡§¶]+/g, '') // symbols
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isMeaningful(t: string | null | undefined): boolean {
    if (!t) return false;
    const s = t.replace(/\s+/g, ' ').trim();
    return s.length >= 40; // tweak threshold if needed
  }

  private firstMeaningfulP(root: Element | Document): Element | null {
    return (
      Array.from(root.querySelectorAll('p')).find((p) =>
        this.isMeaningful(p.textContent || ''),
      ) || null
    );
  }

  private firstMeaningfulPBeforeHeading(
    root: Element | Document,
    stopAt: RegExp,
  ): Element | null {
    // Walk DOM order; stop when we hit a heading like H2
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    while (walker.nextNode()) {
      const el = walker.currentNode as Element;
      if (stopAt.test(el.tagName)) break;
      if (el.tagName === 'P' && this.isMeaningful(el.textContent || ''))
        return el;
    }
    return null;
  }
}
