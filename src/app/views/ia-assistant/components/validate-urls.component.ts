import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

import { ProgressBarModule } from 'primeng/progressbar';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService } from 'primeng/api';
import { TextareaModule } from 'primeng/textarea';
import { InputTextModule } from 'primeng/inputtext';
import { IftaLabelModule } from 'primeng/iftalabel';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { ChipModule } from 'primeng/chip';

import { UrlItem, UrlPair } from '../data/data.model'

import { LinkListComponent } from '../components/link-list.component';
import { FetchService } from '../../../services/fetch.service';
import { ThemeService } from '../../../services/theme.service';

import { IaStateService } from '../services/ia-state.service';

@Component({
  selector: 'ca-validate-urls',
  imports: [CommonModule, FormsModule, TranslateModule,
    ProgressBarModule, ConfirmPopupModule, TextareaModule, InputTextModule, IftaLabelModule, InputGroupModule, InputGroupAddonModule, ButtonModule, TooltipModule, TableModule, ChipModule,
    LinkListComponent
  ],
  templateUrl: './validate-urls.component.html',
  styles: ``
})
export class ValidateUrlsComponent implements OnInit {
  iaState = inject(IaStateService);
  fetchService = inject(FetchService);
  confirmationService = inject(ConfirmationService);

  ngOnInit(): void {
    this.iaState.loadFromLocalStorage();
  }

  private resetProgress() {
    const { urlPairs } = this.iaState.getUrlData();
    const urlTotal = urlPairs.length + urlPairs.filter(p => p.prototype).length;
    this.iaState.setUrlData({
      urlTotal,
      urlChecked: 0,
      urlPercent: 0,
    });
  }

  /*** Advance to step 2 if all URLs are good ***/
  private goToStep2() {
    if ((this.urlsOk.length + this.urlsProtoOk.length === this.iaState.getUrlData().urlTotal) && this.urlsOk.length > 0) {
      this.iaState.saveToLocalStorage();
      this.iaState.setActiveStep(2);
      //this.checkBreadcrumbs();
    }
  }

  /*** Set URL pairs from user input & set boolean if any prototypes were included ***/
  setUrlPairs() {
    this.iaState.resetIaFlow("form");
    const rawUrls = this.iaState.getUrlData().rawUrls;
    let urlPairs: UrlPair[] = rawUrls
      .split(/\r?\n/) // split on new lines
      .map(line => line.trim().toLowerCase())
      .filter(Boolean)
      .map(line => {
        const [prod, proto] = line.split(/[\t,; ]+/); // split on tab, space, comma, or semicolon (copying from excel will use tab)
        const production: UrlItem = { href: prod?.trim() || '', status: 'checking' };
        const prototype: UrlItem | undefined = proto ? { href: proto.trim(), status: 'checking' } : undefined;
        return { production, prototype };
      });

    //remove duplicate production urls
    urlPairs = Array.from(new Map(urlPairs.map(p => [p.production.href, p])).values());

    this.iaState.setUrlData({
      urlPairs,
      includePrototypeLinks: urlPairs.some(p => p.prototype && p.prototype.href !== '') //check for any prototype links
    });
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
      console.error(error);
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
        const { urlChecked, urlTotal } = this.iaState.getUrlData();
        this.iaState.setUrlData({
          urlChecked: urlChecked + 1,
          urlPercent: ((urlChecked + 1) / urlTotal) * 100,
        });
      })
    );
    await Promise.all(urlsToCheck);

    //Recheck bad URLs
    const badUrls = urls.filter(url => url.status === 'bad');
    badUrls.forEach(badUrl => (badUrl.status = 'checking'));
    const { urlChecked } = this.iaState.getUrlData();
    this.iaState.setUrlData({ urlChecked: urlChecked - badUrls.length });
    const urlsToRecheck = badUrls.map(badUrl =>
      this.checkStatus(badUrl).finally(() => {
        const { urlChecked, urlTotal } = this.iaState.getUrlData();
        this.iaState.setUrlData({
          urlChecked: urlChecked + 1,
          urlPercent: ((urlChecked + 1) / urlTotal) * 100,
        });
      })
    );
    await Promise.all(urlsToRecheck);
  }

  /*** Validate URL pairs ***/
  async validateUrlPairs() {
    this.setUrlPairs();
    const { urlPairs, includePrototypeLinks } = this.iaState.getUrlData();
    if (!urlPairs?.length) return;

    //Update progress
    this.resetProgress();
    this.iaState.setUrlData({ isValidating: true });

    // Validate production URLs
    await this.validateUrlItems(urlPairs.map(p => p.production));

    // Validate prototype URLs if they exist
    if (includePrototypeLinks) {
      await this.validateUrlItems(urlPairs.map(p => p.prototype).filter((p): p is UrlItem => !!p));
    }

    //Update progress
    this.iaState.setUrlData({
      isValidating: false,
      isValidated: true,
      isOk: this.iaState.getUrlData().urlPairs.every(p => p.production.status === 'ok'),
    });

    //Advance to next step if all URLs are ok
    this.goToStep2();

  }

  /*** Filter based on status***/
  get urlsChecking() { return this.iaState.getUrlData().urlPairs.map(p => p.production).filter(u => u.status === 'checking'); }
  get urlsBlocked() { return this.iaState.getUrlData().urlPairs.map(p => p.production).filter(u => u.status === 'blocked'); }
  get urlsBad() { return this.iaState.getUrlData().urlPairs.map(p => p.production).filter(u => u.status === 'bad'); }
  get urlsRedirected() { return this.iaState.getUrlData().urlPairs.map(p => p.production).filter(u => u.status === 'redirect'); }
  get urlsOk() { return this.iaState.getUrlData().urlPairs.map(p => p.production).filter(u => u.status === 'ok'); }

  get urlsProtoChecking() { return this.iaState.getUrlData().urlPairs.map(p => p.prototype).filter((u): u is UrlItem => !!u && u.status === 'checking'); }
  get urlsProtoBlocked() { return this.iaState.getUrlData().urlPairs.map(p => p.prototype).filter((u): u is UrlItem => !!u && u.status === 'blocked'); }
  get urlsProtoBad() { return this.iaState.getUrlData().urlPairs.map(p => p.prototype).filter((u): u is UrlItem => !!u && u.status === 'bad'); }
  get urlsProtoRedirected() { return this.iaState.getUrlData().urlPairs.map(p => p.prototype).filter((u): u is UrlItem => !!u && u.status === 'redirect'); }
  get urlsProtoOk() { return this.iaState.getUrlData().urlPairs.map(p => p.prototype).filter((u): u is UrlItem => !!u && u.status === 'ok'); }

  /*** Remove a bad link pair or just the link for prototypes ***/
  remove(link: UrlItem, type: 'prod' | 'proto') {
    let { urlPairs, urlChecked, urlTotal } = this.iaState.getUrlData();
    let decrement = 1;
    if (type === 'prod') {
      const pair = urlPairs.find(p => p.production === link);
      if (pair?.prototype) decrement += 1;
      urlPairs = urlPairs.filter(p => p.production !== link);
    }
    else {
      const pair = urlPairs.find(p => p.prototype === link);
      if (pair) { pair.prototype = undefined; }
    }
    this.iaState.setUrlData({
      urlPairs,
      urlChecked: urlChecked - decrement,
      urlTotal: urlTotal - decrement,
      urlPercent: urlTotal - decrement > 0
        ? (urlChecked - decrement) / (urlTotal - decrement) * 100
        : 0,
      isOk: urlPairs.every(p => p.production.status === 'ok'),
    });
    this.goToStep2();
  }

  /*** Approve an edited link for revalidation ***/
  approve(link: UrlItem, $event: Event, type: 'prod' | 'proto') {
    link.href = link.href.trim().toLowerCase(); //clean input

    //Skip duplicate URLs - Note: keeping these lists separate so we can handle duplicates differently for prototypes (1 prototype may replace several Canada.ca pages for example)
    const { urlPairs } = this.iaState.getUrlData();
    const urlsToCheck = type === 'prod'
      ? urlPairs.map(p => p.production)
      : urlPairs.map(p => p.prototype).filter((p): p is UrlItem => !!p);

    if (urlsToCheck.some(u => u !== link && u.href === link.href)) {
      if (type === 'prod') { this.confirmDuplicate($event, link); return; }
      else { this.confirmProtoDuplicate($event, link); return; }
    }

    //Re-check link
    this.revalidate(link);
  }

  /*** Revalidates a single link rather than the whole array ***/
  private revalidate(link: UrlItem) {
    const { urlChecked, urlTotal } = this.iaState.getUrlData();
    link.status = 'checking';
    //const { urlPairs } = this.iaState.getUrlData();
    //this.iaState.setUrlData({ urlPairs: [...urlPairs] }); //double-check that this still works!
    this.iaState.setUrlData({
      urlChecked: urlChecked - 1,
      urlPercent: ((urlChecked - 1) / urlTotal) * 100,
    });
    this.checkStatus(link).finally(() => {
      const { urlChecked, urlTotal } = this.iaState.getUrlData();
      this.iaState.setUrlData({
        urlChecked: urlChecked + 1,
        urlPercent: ((urlChecked + 1) / urlTotal) * 100,
        isOk: this.iaState.getUrlData().urlPairs.every(p => p.production.status === 'ok'),
      });
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

}
