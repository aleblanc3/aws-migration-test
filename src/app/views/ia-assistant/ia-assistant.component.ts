import { Component } from '@angular/core';
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

import { UrlItem } from './data/data.model'
import { LinkListComponent } from './components/link-list.component';

@Component({
  selector: 'ca-ia-assistant',
  imports: [CommonModule, FormsModule, TranslateModule,
    TextareaModule, InputTextModule, IftaLabelModule, ProgressBarModule, ButtonModule, ButtonGroupModule, InputGroupModule, InputGroupAddonModule, ChipModule, StepperModule, ConfirmPopupModule,
    LinkListComponent],
  templateUrl: './ia-assistant.component.html',
  styles: ``
})
export class IaAssistantComponent {

  constructor(private confirmationService: ConfirmationService) { }

  //Step
  activeStep: number = 1;

  //SEARCH TERMS
  rawTerms: string = '';
  terms: (string | RegExp)[] = []

  searchTerms() {
    this.terms = this.rawTerms
      .split(/[,\n;\t]+/) // split on commas, semicolons, newlines, tabs
      .map(term => term.trim()) // trim whitespace
      .filter(Boolean) // filter out empties
      .map(term => {
        if (term.startsWith('regex:')) {
          const pattern = term.slice(6);
          return new RegExp(pattern, 'smi');
        }
        else return term.toLowerCase();
      });

    this.terms = Array.from(new Set(this.terms)); // unique set
  }

  isRegex(term: string | RegExp): boolean {
    return term instanceof RegExp;
  }

  //URLS
  rawUrls: string = '';
  urls: UrlItem[] = [];

  //Block unknown hosts
  private allowedHosts = new Set([
    "cra-design.github.io",
    "cra-proto.github.io",
    "gc-proto.github.io",
    "test.canada.ca",
    "www.canada.ca"
  ]);

  //for progress bar
  urlTotal = 0;
  urlChecked = 0;
  urlPercent = 0;

  async validateUrls() {
    const rawLinks = this.rawUrls
      .split(/\r?\n/)
      .map(url => url.trim().toLowerCase())
      .filter(Boolean)

    //Remove duplicates
    const uniqueLinks = Array.from(new Set(rawLinks));

    //Map to object w/ href & status
    this.urls = uniqueLinks.map(url => ({ href: url, status: 'checking' }));

    // reset progress bar
    this.urlTotal = this.urls.length;
    this.urlChecked = 0;
    this.urlPercent = 0;

    //Set up initial check
    const urlsToCheck = this.urls.map(url =>
      this.checkStatus(url).finally(() => {
        this.urlChecked++;
        this.urlPercent = (this.urlChecked / this.urlTotal) * 100;
      })
    );

    //Wait 1 second after initial check
    await Promise.all(urlsToCheck);
    await new Promise(resolve => setTimeout(resolve, 1000));

    //Recheck bad URLs
    this.urlChecked -= this.badUrls.length;
    for (const badUrl of this.badUrls) {
      badUrl.status = 'checking';
      this.checkStatus(badUrl).finally(() => {
        this.urlChecked++;
        this.urlPercent = (this.urlChecked / this.urlTotal) * 100;
      })
    }

    //Proceed if no bad URLs
    this.goToStep3();

  }

  private goToStep3() {
    console.log(`Checking: ${this.checkingUrls.length}\nBad: ${this.badUrls.length}\nRedirect: ${this.redirectedUrls.length}\nBlocked: ${this.blockedUrls.length}\n`)
    if (this.checkingUrls.length === 0 && this.badUrls.length === 0 && this.redirectedUrls.length === 0 && this.blockedUrls.length === 0) {
      this.activeStep = 3;
    }
  }
  private async checkStatus(link: UrlItem) {
    try {
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000)); //for testing only, sets delay so we can see progress bar do its thing

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
      link.status = 'bad';
    }
  }

  //Filter based on status
  get checkingUrls() { return this.urls.filter(u => u.status === 'checking'); }
  get blockedUrls() { return this.urls.filter(u => u.status === 'blocked'); }
  get badUrls() { return this.urls.filter(u => u.status === 'bad'); }
  get redirectedUrls() { return this.urls.filter(u => u.status === 'redirect'); }
  get okUrls() { return this.urls.filter(u => u.status === 'ok'); }

  remove(link: UrlItem) {
    this.urls = this.urls.filter(url => url !== link);
    this.urlChecked -= 1;
    this.urlTotal -= 1;
    this.urlPercent = (this.urlChecked / this.urlTotal) * 100;
    this.goToStep3();
  }

  approve(link: UrlItem, $event: Event) {
    link.href = link.href.trim().toLowerCase(); //clean input

    //Skip duplicate URLs <-- Add visible warning for user
    const duplicate = this.urls.some(url => url !== link && url.href === link.href);
    if (duplicate) {
      this.confirmDuplicate($event, link);
      return;
    }

    //Re-check link
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
        label: 'Yes'
      },
      accept: () => {
        this.remove(link);
      },
      reject: () => {
        console.log("Cancel adding duplicate link");
      }
    });
  }
}

