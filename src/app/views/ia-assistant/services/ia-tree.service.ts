import { Injectable, inject } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { ThemeService } from '../../../services/theme.service';
import { FetchService } from '../../../services/fetch.service';
import { BreadcrumbNode, PageMeta, BrokenLinks, SearchMatches } from '../data/data.model';

@Injectable({
  providedIn: 'root'
})
export class IaTreeService {
  private theme = inject(ThemeService);
  private fetchService = inject(FetchService);

  //For tracking progress while building IA chart
  isChartLoading = false;
  iaProgress = 0;
  totalUrls = 0;
  processedUrls = 0;

  //Pages to skip children when building IA chart
  private readonly skipFormsAndPubs = new Set<string>([
    'https://www.canada.ca/en/revenue-agency/services/forms-publications/forms.html',
    'https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/formulaires.html',
    'https://www.canada.ca/en/revenue-agency/services/forms-publications/publications.html',
    'https://www.canada.ca/fr/agence-revenu/services/formulaires-publications/publications.html'
  ]);

  //Set background color
  get bgColors(): string[] {
    return this.theme.darkMode()
      ? this.bgColorsDark
      : this.bgColorsLight;
  }

  bgColorsLight: string[] = [
    "surface-0 hover:bg-primary-50",
    "bg-primary-50 hover:bg-primary-100",
    "bg-primary-100 hover:bg-primary-200",
    "bg-primary-200 hover:bg-primary-300",
    "bg-primary-300 hover:bg-primary-400",
    "bg-primary-400 hover:bg-primary-500",
    "bg-primary-500 hover:bg-primary-600 text-white",
    "bg-primary-600 hover:bg-primary-700 text-white",
    "bg-primary-700 hover:bg-primary-800 text-white",
    "bg-primary-800 hover:bg-primary-900 text-white",
  ];

  bgColorsDark: string[] = [
    "surface-0 hover:bg-primary-900",
    "bg-primary-900 hover:bg-primary-800",
    "bg-primary-800 hover:bg-primary-700",
    "bg-primary-700 hover:bg-primary-600",
    "bg-primary-600 hover:bg-primary-500",
    "bg-primary-500 hover:bg-primary-400",
    "bg-primary-400 hover:bg-primary-300  text-black",
    "bg-primary-300 hover:bg-primary-200 text-black",
    "bg-primary-200 hover:bg-primary-100 text-black",
    "bg-primary-100 hover:bg-primary-50 text-black",
  ];

  get contextStyles(): Record<string, string> {
    return this.theme.darkMode()
      ? this.contextStylesDark
      : this.contextStylesLight;
  }

  contextStylesLight: Record<string, string> = {
    new: 'bg-green-200 hover:bg-green-300 text-black',
    rot: 'bg-red-200 hover:bg-red-300 text-black',
    move: 'bg-yellow-200 hover:bg-yellow-300 text-black',
    template: 'surface-200 hover:surface-300 text-black'
  };

  contextStylesDark: Record<string, string> = {
    new: 'bg-green-700 hover:bg-green-600 text-white',
    rot: 'bg-red-700 hover:bg-red-600 text-white',
    move: 'bg-yellow-700 hover:bg-yellow-600 text-black',
    template: 'surface-700 hover:surface-600 text-white'
  };

  public updateNodeStyles(nodes: TreeNode[] | null, level = 0): void {
    if (!nodes) return;

    for (const node of nodes) {

      const borderStyle = node.data?.borderStyle || 'border-2 border-primary border-round shadow-2';

      const bgClass = this.bgColors[level % this.bgColors.length];
      const bgStyle = this.contextStyles[node.data?.customStyleKey] ?? bgClass;

      node.styleClass = `${borderStyle} ${bgStyle}`;

      if (node.children && node.children.length > 0) {
        //console.log('Node status', node.data.isContainer, level);
        const nextLevel = node.data.isContainer ? level : level + 1;
        this.updateNodeStyles(node.children, nextLevel);
      }
    }
  }


  //Step 2a: Get single page IA data
  async getPageMetaAndLinks(url: string, searchTerms?: string[]): Promise<{ h1?: string; breadcrumb?: string[]; links?: string[], status: number, matched?: boolean; }> {
    try {
      const doc = await this.fetchService.fetchContent(url, "prod", 5);

      //Get H1 (or double H1)
      const h1Elements = Array.from(doc.querySelectorAll('h1'));
      const h1: string = h1Elements.map(e => e.textContent?.trim()).filter(Boolean).join('<br>');

      //Get breadcrumb
      const breadcrumb = Array.from(doc.querySelectorAll('.breadcrumb li a'))
        .map(a => new URL((a as HTMLAnchorElement).getAttribute('href') || '', url).href);

      //Get unique links
      const anchors = Array.from(doc.querySelectorAll('main a[href]')) as HTMLAnchorElement[];
      const baseUrl = new URL(url).origin;
      const links = Array.from(
        new Set( //unique set
          anchors //from my array of anchors
            .map(a => {
              const u = new URL(a.getAttribute('href') || '', url); // map absolute link
              u.hash = ''; // without #id's
              return u.href;
            })
            .filter(u => u.startsWith(baseUrl) && u !== url) // on same domain but not self
        )
      );

      const result: PageMeta = { h1, breadcrumb, links, status: 200 };
      //Check search terms (optional step)      
      if (searchTerms && searchTerms.length > 0) {
        const pageText = doc.body?.textContent?.toLowerCase() ?? "";
        result.matched = searchTerms.some(term =>
          pageText.includes(term.toLowerCase())
        );
      }

      return result;
    } catch (err) {
      console.error(`Failed to fetch ${url}`, err);
      return { status: 0 };
    }
  }
  //Step 2b: Crawl all child pages for IA data
  async buildIaTree(urls: string[], depth: number, brokenLinks: BrokenLinks[], parentUrl?: string, level = 0, searchTerms: (string | RegExp)[] | null = null, searchMatches?: SearchMatches[]): Promise<TreeNode[]> {
    if (depth <= 0) return [];

    //reset progress tracker
    if (!parentUrl && level === 0) {
      this.isChartLoading = true;
      this.iaProgress = 5;
      this.processedUrls = 0;
      this.totalUrls = urls.length;
    }

    const nodes: TreeNode[] = [];

    const bgClass = this.bgColors[level % this.bgColors.length];

    for (const url of urls) {
      const meta = await this.getPageMetaAndLinks(url, ["GST", "dental"]);

      this.processedUrls++; //Increase processed URLs
      this.iaProgress = Math.round((this.processedUrls / this.totalUrls) * 100); //Update progress

      //Collect list of broken links
      if ((!meta || meta.status !== 200) && brokenLinks) {
        brokenLinks.push({
          parentUrl,
          url,
          status: meta?.status || 0
        });
        continue;
      }

      //Collect list of search term matches (todo: add label and which match was found etc.)
      if (meta?.matched && searchMatches) {
        searchMatches.push({
          url,
          h1: meta.h1 ?? "Missing H1"
        });
      }

      //Collect list of referring pages

      //Collect list of potential children (via url structure)

      //Collect TreeNodes of child pages (via breadcrumb check)
      if (!meta.breadcrumb || !meta.links) continue;

      // Check if child via breadcrumb parent
      if (parentUrl && meta.breadcrumb.at(-1) !== parentUrl) {
        continue;
      }

      //Set isCrawled to true if we will crawl this pages children
      let crawled = false;
      if (depth > 1) {
        crawled = true;
      }

      const node: TreeNode = {
        label: meta.h1,
        data: {
          h1: meta.h1,
          url: url,
          originalParent: parentUrl,
          editing: null,
          customStyle: false,
          customStyleKey: null,
          borderStyle: 'border-2 border-primary border-round shadow-2',
          isRoot: false,
          isCrawled: crawled,
          crawlDepth: 0,
          isUserAdded: false,
          notOrphan: true,
          prototype: null,
        },
        expanded: true,
        styleClass: `border-2 border-primary border-round shadow-2 ${bgClass}`,
        children: []
      };

      // Recurse into children
      if (meta.links?.length && depth > 1) {
        this.totalUrls += meta.links.length; // Increase total URLs by # of child links for progress tracker

        const total = meta.links.length; //total links (used for limiting displayed child pages)

        let limit = total; // default: no limit        
        if (this.skipFormsAndPubs.has(url)) { limit = 5; } // limit forms & pubs pages

        const links = meta.links.slice(0, limit); //trim excess links

        node.children = await this.buildIaTree(links, depth - 1, brokenLinks, url, level + 1, searchTerms, searchMatches); //get child nodes

        if (total > limit) { //add dummy node if we limited the child nodes
          node.children?.push({
            label: `+ ${total - limit} more...`,
            data: {
              h1: `+ ${total - limit} more...`,
              url: null,
              originalParent: parentUrl,
              editing: null,
              customStyle: true,
              customStyleKey: 'template',
              borderStyle: 'border-2 border-primary border-round shadow-2 border-dashed',
              isRoot: false,
              isCrawled: false,
              crawlDepth: 0,
              isUserAdded: false,
              notOrphan: true,
              prototype: null,
            },
            expanded: true,
            styleClass: `border-2 border-primary border-round shadow-2 border-dashed surface-100 hover:surface-200`,
            children: []
          });
        }
      }

      nodes.push(node);
    }

    // Finalize progress tracker
    if (!parentUrl && level === 0) {
      this.iaProgress = 100;
      setTimeout(() => {
        this.isChartLoading = false;
        this.iaProgress = 0;
      }, 1000);
    }

    //de-dupe collected data
    if (searchMatches && level === 0) {
      const uniqueMatches = new Map(searchMatches.map(m => [m.url, m]));
      searchMatches.length = 0; //clear array
      searchMatches.push(...uniqueMatches.values());
    }

    return nodes;
  }

  //NEEDS TESTING
  //Build initial context for crawl (i.e. the start of the breadcrumb)
  setTreeContext(iaTree: TreeNode[], breadcrumbs: BreadcrumbNode[][]): void {

    const findChildByUrl = (nodes: TreeNode[] | undefined, url?: string | null) => {
      if (!nodes || !url) return undefined;
      return nodes.find(n => n.data?.url === url);
    };

    for (const breadcrumb of breadcrumbs) {
      let currentLevel = iaTree;
      let parentUrl: string | null = null;
      for (const crumb of breadcrumb) {

        // check if node already exists for this crumb at the current level
        let node = findChildByUrl(currentLevel, crumb.url);

        if (!node) {
          // create a new node for this crumb if it doesn't exist
          node = {
            label: crumb.label,
            data: {
              h1: crumb.label,
              url: crumb.url ?? null,
              originalParent: parentUrl,
              editing: null,
              customStyle: false,
              customStyleKey: null,
              borderStyle: 'border-2 border-primary border-round shadow-2',
              isRoot: crumb.isRoot,
              isCrawled: false,
              crawlDepth: crumb.minDepth, //todo: double-check the depth we calculated in findRoots is being passed along
              isUserAdded: crumb.isRoot || crumb.isDescendant,
              notOrphan: crumb.valid,
              prototype: crumb.prototype ?? null,
            },
            expanded: true,
            styleClass: 'border-2 border-primary border-round shadow-2 surface-ground',
            children: []
          };
          currentLevel.push(node);
        }

        // descend to this node's children for the next crumb
        parentUrl = node.data.url ?? null;
        currentLevel = node.children!;
      }
    }

    //console.log('Built IA tree context:', this.iaTree);

  }

  //Find the root pages we need to crawl
  private findCrawlRoots(nodes: TreeNode[]): TreeNode[] {
    const roots: TreeNode[] = [];

    const walk = (list: TreeNode[]) => {
      for (const n of list) {
        if (n.data?.isRoot) {
          roots.push(n);
        }
        if (n.children?.length) {
          walk(n.children);
        }
      }
    };

    walk(nodes);
    return roots;
  }

  //Crawl from pages marked as data.isRoot
  async crawlFromRoots(node: TreeNode[], brokenLinks: BrokenLinks[], searchTerms: (string | RegExp)[] | null = null, searchMatches?: SearchMatches[]): Promise<void> {
    const roots = this.findCrawlRoots(node);

    let index = 1;
    const numRoots = roots.length;
    for (const root of roots) {
      if (!root.data?.url) continue;

      console.log(`Crawling from root: ${root.data.url}`);
      console.log(`Min Depth: ${root.data.crawlDepth}`);

      const depth = Math.max((root.data.crawlDepth ?? 0), 2); // 2 will crawl 1st level of children only.
      console.log(`Depth: ${depth}`);
      const children = await this.buildIaTree([root.data.url], depth, brokenLinks, undefined, 0, searchTerms, searchMatches);

      if (children.length > 0) {
        const builtRoot = children[0];
        root.children = this.mergeChildren(root.children ?? [], builtRoot.children ?? []);
        root.data.isCrawled = true;
      }
      console.log(`Crawl ${index} of ${numRoots} complete`);
      index++;
      root.data.isRoot = false; //flip status so we don't recrawl
    }
  }

  //Merges discovered children with existing user add-added or breadcrumb children
  private mergeChildren(current: TreeNode[], crawled: TreeNode[]): TreeNode[] {
    const map = new Map<string, TreeNode>();

    // Start with current children since they may have additional data attached
    for (const child of current) {
      if (child.data?.url) {
        map.set(child.data.url, child);
      }
    }

    // Add crawled children if not already in the map
    for (const child of crawled) {
      const url = child.data?.url;
      if (!url) continue;

      if (!map.has(url)) {
        map.set(url, child);
      } else {
        const existingNode = map.get(url)!;
        // Merge children of child into existing node
        if (child.children?.length) {
          if (existingNode.children?.length) {
            existingNode.children = this.mergeChildren(existingNode.children ?? [], child.children ?? []);
          }
          else { existingNode.children = child.children; }
        }
        //Preserve crawled status
        existingNode.data.isCrawled = existingNode.data.isCrawled || child.data.isCrawled;
      }
    }
    return Array.from(map.values());
  }
}
