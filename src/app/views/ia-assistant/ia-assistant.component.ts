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

import { UrlItem, UrlPair, PageData, BreadcrumbNode, BrokenLinks, SearchMatches } from './data/data.model'
import { LinkListComponent } from './components/link-list.component';
import { IaRelationshipService } from './services/ia-relationship.service';
import { IaTreeService } from './services/ia-tree.service';
import { FetchService } from '../../services/fetch.service';
import { ThemeService } from '../../services/theme.service';

import { IaTreeComponent } from './components/ia-tree.component';
import { SearchCriteriaComponent } from './components/search-criteria.component';

import { environment } from '../../../environments/environment';


@Component({
  selector: 'ca-ia-assistant',
  imports: [CommonModule, FormsModule, TranslateModule,
    TextareaModule, InputTextModule, IftaLabelModule, InputGroupModule, InputGroupAddonModule, ButtonModule,
    ProgressBarModule, ChipModule, StepperModule, ConfirmPopupModule, TableModule, BadgeModule, TooltipModule,
    LinkListComponent, SearchCriteriaComponent, IaTreeComponent],
  templateUrl: './ia-assistant.component.html',
  styles: ``
})
export class IaAssistantComponent {
  private confirmationService = inject(ConfirmationService);
  private iaService = inject(IaRelationshipService);
  private fetchService = inject(FetchService);
  private theme = inject(ThemeService);
  private iaTreeService = inject(IaTreeService);

  production = environment.production;

  //Step
  activeStep = 1;

  /*** Advance to step 2 if all URLs are good ***/
  private goToStep2() {
    if (this.urlsOk.length + this.urlsProtoOk.length === this.urlTotal) {
      this.activeStep = 2;
      this.checkBreadcrumbs();
    }
  }

  //Reset everything
  reset(mode: "all" | "form" = "all") {
    this.activeStep = 1;

    //URLs
    this.resetProgress();
    if (mode === "all") { this.rawUrls = '' }
    this.urlPairs = [];
    this.includePrototypeLinks = false;
    this.isValidated = false;
    this.isValidating = false;

    //Breadcrumbs
    this.breadcrumbs = [];
    this.rootPages = [];
    this.breadcrumbProgress = 0;
    this.breadcrumbStep = '';
    this.hasBreakBeforeRoot = false;
    this.hasBreakAfterRoot = false;

    //Search terms
    this.rawTerms = '';
    this.terms = [];

    //IA tree
    this.iaTree = [];
    this.brokenLinks = [];
    this.searchMatches = [];

    //Debug log
    if (!this.production) {
      console.group('Reset state');
      console.table({
        activeStep: this.activeStep,

        rawUrls: this.rawUrls,
        urlPairs: this.urlPairs,
        includePrototypeLinks: this.includePrototypeLinks,
        isValidated: this.isValidated,
        isValidating: this.isValidating,

        breadcrumbs: this.breadcrumbs,
        rootPages: this.rootPages,
        breadcrumbProgress: this.breadcrumbProgress,
        breadcrumbStep: this.breadcrumbStep,
        hasBreakBeforeRoot: this.hasBreakBeforeRoot,
        hasBreakAfterRoot: this.hasBreakAfterRoot,

        terms: this.terms,
        rawTerms: this.rawTerms,

        iaTree: this.iaTree,
        brokenLinks: this.brokenLinks,
        searchMatches: this.searchMatches
      });
      console.groupEnd();
    }
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
  isValidating = false;
  isValidated = false;

  private resetProgress() {
    this.urlTotal =
      this.urlPairs.length +
      this.urlPairs.filter(p => p.prototype).length;
    this.urlChecked = 0;
    this.urlPercent = 0;
  }

  /*** Set URL pairs from user input & set boolean if any prototypes were included ***/
  setUrlPairs() {
    this.reset("form");
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

    //Update progress
    this.resetProgress();
    this.isValidating = true;

    // Validate production URLs
    await this.validateUrlItems(this.urlPairs.map(p => p.production));

    // Validate prototype URLs if they exist
    if (this.includePrototypeLinks) {
      await this.validateUrlItems(this.urlPairs.map(p => p.prototype).filter((p): p is UrlItem => !!p));
    }

    //Update progress
    this.isValidating = false;
    this.isValidated = true;

    //Advance to next step if all URLs are ok
    this.goToStep2();

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
    this.goToStep2();
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
      this.goToStep2();
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

  }

  /*****************
   * SEARCH TERMS  *
   *****************/
  rawTerms = ''
  terms: string[] = [];
  /**********************
  *  BUILD THE IA TREE  *
  ***********************/
  iaTree: TreeNode[] = [];
  brokenLinks: BrokenLinks[] = []
  searchMatches: SearchMatches[] = []

  async buildIaTree(): Promise<void> {
    this.iaTreeService.setTreeContext(this.iaTree, this.breadcrumbs);
    await this.iaTreeService.crawlFromRoots(this.iaTree, this.brokenLinks, this.terms, this.searchMatches);
    this.iaTreeService.updateNodeStyles(this.iaTree, 0);
    console.log("Search matches:")
    console.log(this.searchMatches);
  }



}

