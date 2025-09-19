import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { StepperModule } from 'primeng/stepper';
import { ProgressBarModule } from 'primeng/progressbar';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService, TreeNode } from 'primeng/api';
import { TextareaModule } from 'primeng/textarea';
import { InputTextModule } from 'primeng/inputtext';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { ChipModule } from 'primeng/chip';
import { TableModule } from 'primeng/table';
import { BadgeModule } from 'primeng/badge';
import { OrganizationChart } from 'primeng/organizationchart';

import { UrlItem, UrlPair, PageData, BreadcrumbNode } from './data/data.model'
import { LinkListComponent } from './components/link-list.component';
import { IaRelationshipService } from './services/ia-relationship.service';
import { IaTreeService } from './services/ia-tree.service';
import { FetchService } from '../../services/fetch.service';
import { ThemeService } from '../../services/theme.service';


@Component({
  selector: 'ca-ia-assistant',
  imports: [CommonModule, FormsModule, TranslateModule,
    TextareaModule, InputTextModule, IftaLabelModule, InputGroupModule, InputGroupAddonModule, ButtonModule,
    ProgressBarModule, ChipModule, StepperModule, ConfirmPopupModule, TableModule, BadgeModule, TooltipModule,
    OrganizationChart,
    LinkListComponent,],
  templateUrl: './ia-assistant.component.html',
  styles: ``
})
export class IaAssistantComponent {
  private confirmationService = inject(ConfirmationService);
  private iaService = inject(IaRelationshipService);
  private fetchService = inject(FetchService);
  private theme = inject(ThemeService);
  private iaTreeService = inject(IaTreeService);

  //Step
  activeStep = 1;

  /*** Advance to step 3 if all URLs are good ***/
  private goToStep3() {
    if (this.urlsOk.length + this.urlsProtoOk.length === this.urlTotal) {
      this.activeStep = 3;
      this.checkBreadcrumbs();
    }
  }

  /*** Advance to step 4 if all breadcrumbs are good ***/
  private goToStep4() {
    if (!this.hasBreakAfterRoot && !this.hasBreakBeforeRoot) {
      this.activeStep = 4;
      //add function to build IA tree
    }
  }

  /*****************
   * SEARCH TERMS  *
   *****************/
  rawTerms = '';
  terms: (string | RegExp)[] = []

  updateTerms() {
    this.terms = this.rawTerms
      .split(/[\n;\t]+/) // split on semicolons, newlines, tabs
      .map(term => term.trim()) // trim whitespace
      .filter(Boolean) // filter out empties
      .map(term => {
        try {
          if (term.startsWith('regex:')) {
            const pattern = term.slice(6);
            return new RegExp(pattern, 'smi');
          }
          else return term.toLowerCase();
        }
        catch (error) { console.log(error); return `invalid ${term}`; }
      });

    this.terms = Array.from(new Set(this.terms)); // unique set
  }

  updateRawTerms() {
    this.rawTerms = this.terms.map(term => {
      if (term instanceof RegExp) {
        return `regex:${term.source}`;
      } else {
        return term;
      }
    })
      .join('; ');
  }

  onKeydownTerm(event: KeyboardEvent) {
    if (event.key === ';' || event.key === 'Enter' || event.key === 'Tab') {
      this.updateTerms();
    }
  }

  onPasteTerm() {
    setTimeout(() => this.updateTerms(), 0);
  }

  removeTerm(term: string | RegExp) {
    this.terms = this.terms.filter(t => t !== term);
    console.log(this.terms);
    this.updateRawTerms()
  }

  isRegex(term: string | RegExp): boolean {
    return term instanceof RegExp;
  }

  getTermColor(term: string | RegExp): string {
    if (this.isRegex(term)) return 'bg-blue-100';
    else if (typeof term === 'string' && term.startsWith('invalid regex')) return 'bg-red-100';
    else return 'bg-green-100';
  }

  /*****************
   * VALIDATE URLS *
   *****************/
  rawUrls = '';
  urlPairs: UrlPair[] = [];
  includePrototypeLinks = false;

  //for progress bar
  urlTotal = 0;
  urlChecked = 0;
  urlPercent = 0;

  private resetProgress() {
    this.urlTotal =
      this.urlPairs.length +
      this.urlPairs.filter(p => p.prototype).length;
    this.urlChecked = 0;
    this.urlPercent = 0;
  }

  /*** Set URL pairs from user input & set boolean if any prototypes were included ***/
  setUrlPairs() {
    this.urlPairs = this.rawUrls
      .split(/\r?\n/) // split on new lines
      .map(line => line.trim().toLowerCase())
      .filter(Boolean)
      .map(line => {
        const [prod, proto] = line.split(/[\t,; ]+/); // split on tab, space, comma, or semicolon (copying from excel will use tab)
        const production: UrlItem = {
          href: prod?.trim() || '',
          status: 'checking'
        };
        const prototype: UrlItem | undefined = proto
          ? { href: proto.trim(), status: 'checking' }
          : undefined;
        return { production, prototype };
      });

    //remove duplicate production urls
    this.urlPairs = Array.from(
      new Map(this.urlPairs.map(p => [p.production.href, p])).values()
    );

    //check for any prototype links
    this.includePrototypeLinks = this.urlPairs.some(p => p.prototype && p.prototype.href !== '')

    //reset breadcrumb validation
    this.breadcrumbs = [];
    this.rootPages = [];

    //reset IA tree
    this.iaTree = [];
  }

  onPasteUrls() {
    setTimeout(() => this.setUrlPairs(), 0);
  }

  /*** Validate a single URL item ***/
  private async checkStatus(link: UrlItem) {
    try {
      const response = await this.fetchService.fetchStatus(link.href, "prod", 5, "random");

      if (!response.ok || response.url.includes('404.html')) {
        link.status = 'bad';
      }
      else if (response.url !== link.href) {
        link.status = 'redirect';
        link.originalHref = link.href
        link.href = response.url;
      }
      else {
        link.status = 'ok';
      }
    }
    catch (error) {
      console.log(error);
      if ((error as Error).message.startsWith("Blocked host")) {
        link.status = "blocked";
      }
      else link.status = "bad";
    }
  }

  /*** Validate a URL item array (half of the URL pair) ***/
  private async validateUrlItems(urls: UrlItem[]) {
    //Check all URLs
    const urlsToCheck = urls.map(url =>
      this.checkStatus(url).finally(() => {
        this.urlChecked++;
        this.urlPercent = (this.urlChecked / this.urlTotal) * 100;
      })
    );
    await Promise.all(urlsToCheck);

    //Recheck bad URLs
    const badUrls = urls.filter(url => url.status === 'bad');
    badUrls.forEach(badUrl => (badUrl.status = 'checking'));
    this.urlChecked -= badUrls.length;
    const urlsToRecheck = badUrls.map(badUrl =>
      this.checkStatus(badUrl).finally(() => {
        this.urlChecked++;
        this.urlPercent = (this.urlChecked / this.urlTotal) * 100;
      })
    );
    await Promise.all(urlsToRecheck);
  }

  /*** Validate URL pairs ***/
  async validateUrlPairs() {
    if (!this.urlPairs?.length) return;

    this.resetProgress();

    // Validate production URLs
    await this.validateUrlItems(this.urlPairs.map(p => p.production));

    // Validate prototype URLs if they exist
    if (this.includePrototypeLinks) {
      await this.validateUrlItems(this.urlPairs.map(p => p.prototype).filter((p): p is UrlItem => !!p));
    }

    //Advance to next step if all URLs are ok
    this.goToStep3();

  }

  /*** Filter based on status***/
  get urlsChecking() { return this.urlPairs.map(p => p.production).filter(u => u.status === 'checking'); }
  get urlsBlocked() { return this.urlPairs.map(p => p.production).filter(u => u.status === 'blocked'); }
  get urlsBad() { return this.urlPairs.map(p => p.production).filter(u => u.status === 'bad'); }
  get urlsRedirected() { return this.urlPairs.map(p => p.production).filter(u => u.status === 'redirect'); }
  get urlsOk() { return this.urlPairs.map(p => p.production).filter(u => u.status === 'ok'); }

  get urlsProtoChecking() { return this.urlPairs.map(p => p.prototype).filter((u): u is UrlItem => !!u && u.status === 'checking'); }
  get urlsProtoBlocked() { return this.urlPairs.map(p => p.prototype).filter((u): u is UrlItem => !!u && u.status === 'blocked'); }
  get urlsProtoBad() { return this.urlPairs.map(p => p.prototype).filter((u): u is UrlItem => !!u && u.status === 'bad'); }
  get urlsProtoRedirected() { return this.urlPairs.map(p => p.prototype).filter((u): u is UrlItem => !!u && u.status === 'redirect'); }
  get urlsProtoOk() { return this.urlPairs.map(p => p.prototype).filter((u): u is UrlItem => !!u && u.status === 'ok'); }

  /*** Remove a bad link pair or just the link for prototypes ***/
  remove(link: UrlItem, type: 'prod' | 'proto') {
    let decrement = 1;
    if (type === 'prod') {
      const pair = this.urlPairs.find(p => p.production === link);
      if (pair?.prototype) decrement += 1;
      this.urlPairs = this.urlPairs.filter(p => p.production !== link);
    }
    else {
      const pair = this.urlPairs.find(p => p.prototype === link);
      if (pair) { pair.prototype = undefined; }
    }
    this.urlChecked -= decrement;
    this.urlTotal -= decrement;
    this.urlPercent = (this.urlChecked / this.urlTotal) * 100;
    this.goToStep3();
  }

  /*** Approve an edited link for revalidation ***/
  approve(link: UrlItem, $event: Event, type: 'prod' | 'proto') {
    link.href = link.href.trim().toLowerCase(); //clean input

    //Skip duplicate URLs - Note: keeping these lists separate so we can handle duplicates differently for prototypes (1 prototype may replace several Canada.ca pages for example)
    const urlsToCheck = type === 'prod'
      ? this.urlPairs.map(p => p.production)
      : this.urlPairs.map(p => p.prototype).filter((p): p is UrlItem => !!p);

    if (urlsToCheck.some(u => u !== link && u.href === link.href)) {
      if (type === 'prod') { this.confirmDuplicate($event, link); return; }
      else { this.confirmProtoDuplicate($event, link); return; }
    }

    //Re-check link
    this.revalidate(link);
  }

  /*** Revalidates a single link rather than the whole array ***/
  private revalidate(link: UrlItem) {
    link.status = 'checking';
    this.urlChecked -= 1;
    this.urlPercent = (this.urlChecked / this.urlTotal) * 100;
    this.checkStatus(link).finally(() => {
      this.urlChecked++;
      this.urlPercent = (this.urlChecked / this.urlTotal) * 100;
      this.goToStep3();
    });
  }

  /*** Popup message for duplicate production links ***/
  confirmDuplicate(event: Event, link: UrlItem) {
    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message: 'This URL is already included. Do you want to remove the duplicate link?',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true
      },
      acceptButtonProps: {
        label: 'Yes',
        severity: 'danger'
      },
      accept: () => {
        this.remove(link, 'prod');
      },
      reject: () => {
        console.log("Cancel adding duplicate link");
      }
    });
  }

  /*** Popup message for duplicate prototype links ***/
  confirmProtoDuplicate(event: Event, link: UrlItem) {
    this.confirmationService.confirm({
      target: event.currentTarget as EventTarget,
      message: 'This prototype URL was already included for another page. Do you want to keep it anyway?',
      icon: 'pi pi-exclamation-triangle',
      rejectButtonProps: {
        label: 'Cancel',
        severity: 'secondary',
        outlined: true
      },
      acceptButtonProps: {
        label: 'Yes',
        severity: 'success'
      },
      accept: () => {
        this.revalidate(link);
      },
      reject: () => {
        console.log("Cancel adding duplicate link");
      }
    });
  }

  /******************************************
   * GET ROOT URLS AND VALIDATE BREADCRUMBS *
   ******************************************/
  breadcrumbs: BreadcrumbNode[][] = [];
  rootPages: PageData[] = [];
  breadcrumbProgress = 0;
  breadcrumbStep = '';
  hasBreakBeforeRoot = false;
  hasBreakAfterRoot = false;

  async checkBreadcrumbs() {
    this.breadcrumbProgress = 0;
    this.breadcrumbStep = ""
    this.breadcrumbProgress = 20;
    this.breadcrumbStep = "Getting all breadcrumbs"

    const allPages = await this.iaService.getAllBreadcrumbs(this.urlPairs);

    this.breadcrumbProgress = 40;
    this.breadcrumbStep = "Finding root pages"

    await this.fetchService.simulateDelay(2000);
    this.rootPages = this.iaService.getRoots(allPages);

    this.breadcrumbProgress = 50;
    this.breadcrumbStep = "Filtering breadcrumbs"

    await this.fetchService.simulateDelay(2000);
    this.breadcrumbs = this.iaService.filterBreadcrumbs(allPages);

    this.breadcrumbProgress = 60;
    this.breadcrumbStep = "Validating breadcrumbs"

    this.breadcrumbs = await this.iaService.validateBreadcrumbs(this.breadcrumbs);

    this.breadcrumbProgress = 90;
    this.breadcrumbStep = "Highlighting breadcrumbs"

    await this.fetchService.simulateDelay(2000);
    ({ breadcrumbs: this.breadcrumbs, hasBreakAfterRoot: this.hasBreakAfterRoot, hasBreakBeforeRoot: this.hasBreakBeforeRoot } = this.iaService.highlightBreadcrumbs(this.breadcrumbs, this.rootPages));

    this.breadcrumbProgress = 100;
    this.breadcrumbStep = "Complete"

    console.log(`Breadcrumb branches: `, this.breadcrumbs);
    console.log(`Root pages: `, this.rootPages);

    this.goToStep4();
  }

  /**********************
  *  BUILD THE IA TREE  *
  ***********************/
  iaTree: TreeNode[] = [];
  async buildIaTree(): Promise<void> {
    this.setTreeContext();
    this.crawlFromRoots(3);
    /*const roots = this.iaTree.filter(n => n.data?.isRoot);
    for (const root of roots) {
      const depth = root.data?.crawlDepth ?? 3;
      await this.iaTreeService.crawlFromNode(root, depth);
    }*/
  }

  //Build initial context for crawl (i.e. the start of the breadcrumb)
  setTreeContext(): void {

    const findChildByUrl = (nodes: TreeNode[] | undefined, url?: string | null) => {
      if (!nodes || !url) return undefined;
      return nodes.find(n => n.data?.url === url);
    };

    for (const breadcrumb of this.breadcrumbs) {
      let currentLevel = this.iaTree;
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
              crawlDepth: 3, //note: use the depth we calculated in findRoots to get this number
              isUserAdded: crumb.isDescendant,
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

    console.log('Built IA tree context:', this.iaTree);

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
  async crawlFromRoots(depth: number): Promise<void> {
    const roots = this.findCrawlRoots(this.iaTree);

    let index = 1;
    const numRoots = roots.length;
    for (const root of roots) {
      if (!root.data?.url) continue;

      console.log(`Crawling from root: ${root.data.url}`);

      const children = await this.iaTreeService.buildIaTree([root.data.url], depth, undefined, 0);

      if (children.length > 0) {
        const builtRoot = children[0];
        root.children = builtRoot.children; // attach discovered children
        root.data.isCrawled = true;
      }
      console.log(`Crawl ${index} of ${numRoots} complete`);
      index++;
    }

  }

}

