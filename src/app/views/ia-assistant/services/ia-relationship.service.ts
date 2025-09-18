import { Injectable, inject } from '@angular/core';
import { UrlPair } from '../data/data.model';
import { FetchService } from '../../../services/fetch.service';

export interface PageData {
  href: string;                 // the page URL
  h1: string;                   // the page H1
  breadcrumb: BreadcrumbNode[]; // array of breadcrumbs
  descendants: string[];        // flat list of child pages urls
  minDepth: number;             // how deep we need to crawl to reach furthest child page
  prototype?: string;           // carry forward the prototype link
}

export interface BreadcrumbNode {
  label: string;            // link text
  url: string;              // link
  isRoot?: boolean;         // marks if it's one of the detected root pages (from user input)
  isDescendant?: boolean;   // mark if it's a child page (from user input)
  valid?: boolean;          // true = link found on parent, false = IA orphan
  styleClass?: string;      // for the label (used to set color and/or bold)
  icon?: string;            // represents status of link from parent to child
  iconTooltip?: string;     // explanation for icon
  linkTooltip?: string;     // explanation for color/boldness of label
}

@Injectable({
  providedIn: 'root'
})
export class IaRelationshipService {
  private fetchService = inject(FetchService);

  //Get breadcrumb
  private getBreadcrumb(doc: Document, baseUrl: string): BreadcrumbNode[] {
    const breadcrumbItems = doc.querySelectorAll('.breadcrumb li a');
    const breadcrumbArray: BreadcrumbNode[] = [];
    breadcrumbItems.forEach((el) => {
      const rawHref = el.getAttribute('href') || '';
      let absoluteUrl = '';
      try {
        absoluteUrl = new URL(rawHref, baseUrl).href; // handles both relative + absolute
      } catch {
        console.warn(`Invalid breadcrumb href: ${rawHref}`);
      }
      breadcrumbArray.push({
        label: el.textContent?.trim() || '',
        url: absoluteUrl
      });
    });
    return breadcrumbArray;
  }

  //Add breadcrumb trail & H1 to user input urls (keep prototype url for later use)
  public async getAllBreadcrumbs(urlPairs: UrlPair[]): Promise<PageData[]> {
    const results: PageData[] = [];

    for (const pair of urlPairs) {
      const prodUrl = pair.production.href;
      if (!prodUrl) continue;

      try {
        const doc = await this.fetchService.fetchContent(prodUrl, "prod", 5, "random");

        //Get breadcrumb
        const breadcrumb = this.getBreadcrumb(doc, "https://www.canada.ca");

        //Get H1 (or double H1)
        const h1Elements = Array.from(doc.querySelectorAll('h1'));
        const h1: string = h1Elements.map(e => e.textContent?.trim()).filter(Boolean).join('<br>');

        results.push({
          href: prodUrl,
          h1: h1,
          breadcrumb: breadcrumb,
          descendants: [],
          minDepth: 0,
          prototype: pair.prototype?.href
        });
      } catch (error) {
        console.error(`Error fetching ${prodUrl}:`, error);
      }
    }
    return results;
  }

  //Gets root URLs by checking to see if each page is in the breadcrumb of another page
  public getRoots(pages: PageData[]): PageData[] {
    const byHref = new Map(pages.map(p => [p.href, p])); //map so we can lookup pages by href

    for (const page of pages) {
      for (const crumb of page.breadcrumb) {
        const ancestor = byHref.get(crumb.url!); //check if page is in breadcrumb of another page (if so, it's an ancestor and potential root)
        if (!ancestor || ancestor.href === page.href) continue; //skip if not found or if breadcrumb erroneously contained a self reference
        if (!ancestor.descendants.includes(page.href)) { ancestor.descendants.push(page.href); } //add page with matching breadcrumb as decendent if not already there
      }
    }
    const descendantSet = new Set(pages.flatMap(p => p.descendants)); //get a unique set of descendant pages
    const roots = pages.filter(p => !descendantSet.has(p.href)); //get all pages that aren't a descendant of anything (the roots!)

    //calculate minimum depth to crawl to include all child pages
    for (const root of roots) {
      let minDepth = 2; //set minimum crawl depth to 2 so we always crawl at least root plus 1 level of children

      for (const childHref of root.descendants) {
        const childPage = byHref.get(childHref);
        if (!childPage) continue;
        const index = childPage.breadcrumb.findIndex(bc => bc.url === root.href); // get the position of the root in the child page's breadcrumb
        if (index !== -1) {
          const depth = (childPage.breadcrumb.length + 1) - index; // relative depth = number of breadcrumb items after the root (plus 1 since child page is not in breadcrumb)
          minDepth = Math.max(minDepth, depth);
        }
      }

      root.minDepth = minDepth;
    }
    return roots;
  }

  //Colors and styles for breadcrumbs
  readonly Icons = {
    pending: 'pi pi-question-circle',
    valid: 'pi pi-arrow-circle-right',
    orphan: 'pi pi-times-circle',
    error: 'pi pi-times',
  };

  readonly Colors = {
    gray: 'text-gray-400 hover:text-gray-600',
    green: 'text-green-500 hover:text-green-600',
    red: 'text-red-500 hover:text-red-600',
    blue: 'text-blue-500 hover:text-blue-600'
  };

  readonly Modifiers = {
    bold: 'font-bold',
    errorBorder: 'border-dotted',
  };

  //Filter out redundant breadcrumb trails (so we can do least number of fetches in validation step)
  public filterBreadcrumbs(pages: PageData[]): BreadcrumbNode[][] {
    const trails = pages.map(p => [
      ...(p.breadcrumb[0] // No icon for first item in breadcrumb
        ? [{
          ...p.breadcrumb[0],
          styleClass: this.Colors.green,
          linkTooltip: 'Breadcrumb root'
        }]
        : []),
      ...p.breadcrumb.slice(1).map(crumb => ({
        ...crumb,
        icon: `${this.Icons.pending} ${this.Colors.gray}`,
        iconTooltip: 'Validation pending',
        styleClass: this.Colors.gray,
        linkTooltip: 'Validation pending',
      })),
      { //include actual page in breadcrumb
        label: p.h1,
        url: p.href,
        icon: `${this.Icons.pending} ${this.Colors.gray}`,
        iconTooltip: 'Validation pending',
        styleClass: this.Colors.gray,
        linkTooltip: 'Validation pending',
      } as BreadcrumbNode
    ].filter(Boolean)); //removes undefined (can happen when adding homepage or any page missing a breadcrumb)

    //filter out redundant (i.e. shorter) breadcrumb trails
    const filtered = trails.filter(trail =>
      !trails.some(other =>
        other !== trail &&
        other.length > trail.length &&
        trail.every((crumb, i) => other[i]?.url === crumb.url)
      )
    );

    //sort remaining breadcrumb trails
    filtered.sort((a, b) => {
      const minLength = Math.min(a.length, b.length);
      for (let i = 0; i < minLength; i++) {
        if (a[i].url !== b[i].url) {
          return a[i].url!.localeCompare(b[i].url!);
        }
      }
      // If all compared items are equal, shorter chain comes first
      return a.length - b.length;
    });

    return filtered;
  }

  //Check if breadcrumb parent pages link to their children
  public async validateBreadcrumbs(breadcrumbs: BreadcrumbNode[][]): Promise<BreadcrumbNode[][]> {
    for (const breadcrumb of breadcrumbs) {
      for (let i = 1; i < breadcrumb.length; i++) {
        const parent = breadcrumb[i - 1];
        const child = breadcrumb[i];

        if (!parent.url || !child.url) { // fallback if breadcrumbs are missing links (unlikely but could happen on freestyle pages)
          child.icon = `${this.Icons.error} ${this.Colors.red}`;
          child.iconTooltip = 'Link missing from breadcrumb'
          child.valid = false;
          continue;
        }

        try {

          const doc = await this.fetchService.fetchContent(parent.url, "prod", 5, "random");

          const links = Array.from(doc.querySelectorAll('a'))
            .map(a => a.getAttribute('href'))
            .filter((href): href is string => !!href)
            .map(href => {
              try {
                return new URL(href, parent.url).href;
              } catch {
                return href;
              }
            });

          if (links.includes(child.url)) {
            child.icon = `${this.Icons.valid} ${this.Colors.green}`;
            child.iconTooltip = 'Valid connection'
            child.valid = true;
            child.styleClass = this.Colors.green;
            child.linkTooltip = 'Valid child page';
          } else {
            child.icon = `${this.Icons.orphan} ${this.Colors.red}`;
            child.iconTooltip = 'No link from parent'
            child.valid = false;
            child.styleClass = this.Colors.red;
            child.linkTooltip = 'IA Orphan';
          }
        } catch (error) { //this will happen if fetch fails (breadcrumb link may be broken for example since we only validate the urls from the user input)
          console.error(`Error validating breadcrumb link from ${parent.url} to ${child.url}:`, error);
          child.icon = `${this.Icons.error} ${this.Colors.red}`;
          child.iconTooltip = 'Error validating link'
          child.valid = false;
          child.styleClass = `${this.Colors.red} ${this.Modifiers.errorBorder}`;
          child.linkTooltip = 'Error validating link';
        }
      }
    }

    return breadcrumbs;
  }

  public highlightBreadcrumbs(
    breadcrumbs: BreadcrumbNode[][],
    rootPages: PageData[]
  ): { breadcrumbs: BreadcrumbNode[][]; hasBreakAfterRoot: boolean; hasBreakBeforeRoot: boolean } {
    const rootSet = new Set(rootPages.map(r => r.href));
    const descendantSet = new Set(rootPages.flatMap(r => r.descendants || []));

    let hasBreakAfterRoot = false;
    let hasBreakBeforeRoot = false;

    const highlighted = breadcrumbs.map(chain => {
      let isAfterRoot = false;
      let broken = false;

      return chain.map((crumb) => {
        const isRoot = rootSet.has(crumb.url!);
        const isDescendant = descendantSet.has(crumb.url!);
        crumb.isRoot = isRoot;
        crumb.isDescendant = isDescendant;

        if (isRoot) {
          // Root page
          isAfterRoot = true;
          broken = false;
          crumb.styleClass = `${this.Colors.blue} ${this.Modifiers.bold}`;
          crumb.linkTooltip = 'Starting point for IA crawl (user-added page)';
        } else if (isAfterRoot) {
          if (broken) { // If there is an invalid link after the root, the remainder of the trail turns red            
            crumb.styleClass = this.Colors.red;
            crumb.linkTooltip = 'Descendant of IA orphan';
          } else if (crumb.icon?.includes('pi-times')) { // First orphan after root            
            broken = true;
            hasBreakAfterRoot = true;
          }
        } else { // Before root, keep neutral
          if (crumb.icon?.includes('pi-times')) { hasBreakBeforeRoot = true; }
          crumb.styleClass = this.Colors.gray;
          crumb.linkTooltip = 'Page will be shown in IA map for context but no links will be crawled';
        }

        // Bold descendants without changing their validity color
        if (isDescendant) {
          crumb.styleClass += ` ${this.Modifiers.bold}`;
          crumb.linkTooltip += ' (user-added page)';
        }

        return crumb;
      });
    });
    return { breadcrumbs: highlighted, hasBreakAfterRoot, hasBreakBeforeRoot };
  }

}
