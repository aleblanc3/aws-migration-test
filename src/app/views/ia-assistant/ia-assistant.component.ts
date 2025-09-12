import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { TextareaModule } from 'primeng/textarea';
import { IftaLabelModule } from 'primeng/iftalabel';
import { ProgressBarModule } from 'primeng/progressbar';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { ButtonGroupModule } from 'primeng/buttongroup';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ChipModule } from 'primeng/chip';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService } from 'primeng/api';
import { StepperModule } from 'primeng/stepper';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TableModule } from 'primeng/table';
import { BadgeModule } from 'primeng/badge';

import { UrlItem, UrlPair } from './data/data.model'
import { LinkListComponent } from './components/link-list.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'ca-ia-assistant',
  imports: [CommonModule, FormsModule, TranslateModule,
    TextareaModule, InputTextModule, IftaLabelModule, ProgressBarModule, ButtonModule, ButtonGroupModule, InputGroupModule, InputGroupAddonModule, ChipModule, StepperModule, ConfirmPopupModule, ToggleSwitchModule, TableModule,
    BadgeModule,
    LinkListComponent,],
  templateUrl: './ia-assistant.component.html',
  styles: ``
})
export class IaAssistantComponent {
  private confirmationService = inject(ConfirmationService);

  //Step
  activeStep = 1;

  /****************
   * SEARCH TERMS *
   ****************/
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


  /****************
   *     URLS     *
   ****************/
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

  //Block unknown hosts <-- will probably separate canada.ca from GitHub repos so that only Canada.ca is crawled for the IA tree
  private allowedHosts = new Set([
    "cra-design.github.io",
    "cra-proto.github.io",
    "gc-proto.github.io",
    "test.canada.ca",
    "www.canada.ca"
  ]);

  /*** Set URL pairs from user input & boolean if any prototypes were included ***/
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
  }

  onPasteUrls() {
    setTimeout(() => this.setUrlPairs(), 0);
  }

  /*** Validate a single URL item ***/
  private async checkStatus(link: UrlItem) {
    try {
      if (!environment.production) {
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000)); //sets delay in dev build so we can see progress bar do its thing
      }

      //Blocked by our whitelist
      const url = new URL(link.href);
      if (!this.allowedHosts.has(url.host)) {
        link.status = 'blocked';
        return;
      }

      //Get & set status
      const response = await fetch(link.href, { method: 'HEAD', cache: 'no-store' });

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
      link.status = 'bad';
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
    await new Promise(resolve => setTimeout(resolve, 100)); //100ms delay before recheck
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

  /*** Advance to step 3 if all URLs are good ***/
  private goToStep3() {
    if (this.urlsOk.length + this.urlsProtoOk.length === this.urlTotal) {
      this.activeStep = 3;
    }
  }

  //Filter based on status
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
}

