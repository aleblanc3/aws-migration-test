import { Injectable, inject } from '@angular/core';
import { TreeNode } from 'primeng/api';
import { ThemeService } from '../../../services/theme.service';
import { FetchService } from '../../../services/fetch.service';
import { BreadcrumbNode, PageMeta } from '../data/data.model';
import { IaStateService } from './ia-state.service';

@Injectable({
  providedIn: 'root'
})
export class IaTreeService {
  private theme = inject(ThemeService);
  private fetchService = inject(FetchService);
  private iaState = inject(IaStateService);

  //For tracking progress while building IA chart
  iaData = this.iaState.getIaData;
  searchData = this.iaState.getSearchData;

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
    template: 'surface-200 hover:surface-300 text-white'
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
        const nextLevel = node.data.customStyleKey === 'template' ? level : level + 1;
        this.updateNodeStyles(node.children, nextLevel);
      }
    }
  }


  //Step 2a: Get single page IA data
  async getPageMetaAndLinks(url: string): Promise<PageMeta> {
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
      if (this.searchData().terms && this.searchData().terms.length > 0) {
        const pageText = doc.body?.textContent?.toLowerCase() ?? "";
        const matched = this.searchData().terms.some(term => {
          if (typeof term === 'string') {
            return pageText.includes(term);
          } else {  // term is a RegExp
            return term.test(pageText);
          }
        });
        //Collect list of search term matches
        if (matched) {
          this.iaData().searchMatches.push({
            url,
            h1: h1 ?? "Missing H1"
          });
        }
      }
      return result;
    } catch (err) {
      console.error(`Failed to fetch ${url}`, err);
      return { status: 0 };
    }
  }
  //Step 2b: Crawl all child pages for IA data
  async buildIaTree(urls: string[], depth: number, parentUrl?: string, level = 0): Promise<TreeNode[]> {
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
      const meta = await this.getPageMetaAndLinks(url);

      this.processedUrls++; //Increase processed URLs
      this.iaProgress = Math.round((this.processedUrls / this.totalUrls) * 100); //Update progress

      //Collect list of broken links
      if ((!meta || meta.status !== 200) && this.iaData().brokenLinks) {
        this.iaData().brokenLinks.push({
          parentUrl,
          url,
          status: meta?.status || 0
        });
        continue;
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
        console.log(`Crawling ${total} links from ${url}, depth ${depth}, limit ${limit}`);

        const links = meta.links.slice(0, limit); //trim excess links

        node.children = await this.buildIaTree(links, depth - 1, url, level + 1); //get child nodes

        if (total > limit) { //add dummy node if we limited the child nodes
          console.log(`... adding dummy node for ${total - limit} additional links`);
          node.children?.push({
            label: `+ ${total - limit} more...`,
            data: {
              h1: `+ ${total - limit} more...`,
              url: url,
              originalParent: url,
              editing: null,
              customStyle: true,
              customStyleKey: 'template',
              borderStyle: 'border-2 border-primary border-round shadow-2 border-dashed',
              isRoot: false,
              isCrawled: true,
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
    if (this.iaData().searchMatches && level === 0) {
      const uniqueMatches = new Map(this.iaData().searchMatches.map(m => [m.url, m]));
      this.iaData().searchMatches.length = 0; //clear array
      this.iaData().searchMatches.push(...uniqueMatches.values());
    }

    return nodes;
  }

  //NEEDS TESTING
  //Build initial context for crawl (i.e. the start of the breadcrumb)
  async setTreeContext(iaTree: TreeNode[], breadcrumbs: BreadcrumbNode[][]): Promise<void> {

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
              customStyle: crumb.isBeforeRoot ?? false,
              customStyleKey: crumb.isBeforeRoot ? 'template' : null,
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
  async crawlFromRoots(node: TreeNode[]): Promise<void> {
    const roots = this.findCrawlRoots(node);

    let index = 1;
    const numRoots = roots.length;
    for (const root of roots) {
      if (!root.data?.url) continue;

      console.log(`Crawling from root: ${root.data.url}`);
      console.log(`Min Depth: ${root.data.crawlDepth}`);

      const depth = Math.max((root.data.crawlDepth ?? 0), 2); // 2 will crawl 1st level of children only.
      console.log(`Depth: ${depth}`);
      const children = await this.buildIaTree([root.data.url], depth, undefined, 0); //doesn't matter that this parent is undefined, we're only grabbing the children

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
