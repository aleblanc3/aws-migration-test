import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from "@ngx-translate/core";

import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { ToggleButtonModule } from 'primeng/togglebutton';

import { ApiResetComponent } from './api-reset.component';
import { LocalStorageService } from '../services/local-storage.service';
import { ThemeService } from '../services/theme.service';

@Component({
  selector: 'ca-header',
  imports: [CommonModule, FormsModule, TranslateModule, ToolbarModule, ButtonModule, ToggleButtonModule, ApiResetComponent],
  template: `
  <header id="header" class="pb-2">
  <p-toolbar>
    <div class="flex align-items-center hidden md:block">
      <img
        id="cra-logo"
        class="img-fluid fip-colour w-28rem"
        [src]="logoSrc"
        [alt]="'CRA' | translate"
        priority="true"
      />
    </div>
    <div class="flex align-items-center gap-3">
      <ca-api-reset
        *ngIf="this.localStore.getData('apiKey') !== null">
      </ca-api-reset>

      <p-togglebutton
        offIcon="pi pi-moon"
        offLabel=""
        onIcon="pi pi-sun"
        onLabel=""
        class="p-button-rounded p-button-secondary p-button-outlined p-button-sm surface-border pr-0 darkmode-toggle"
        [ngModel] = "theme.darkMode()"
        (click)="theme.toggle()"
        ariaLabel="Toggle between dark and light mode">
      </p-togglebutton>

      <a
        class="cursor-pointer underline font-medium text-blue-600 hover:text-blue-700"
        tabindex="0"
        (click)="selectLanguage()">
        {{ 'opp.lang' | translate }}
      </a>
    </div>
  </p-toolbar>
</header>
  `,
  styles: `
  ::ng-deep .p-toolbar {
      background-color: transparent !important;
      border: none !important;
       
    }
    header {
      border-bottom-style: solid;
      border-bottom-color: var(--p-gray-400);
      border-width: 1px;
      margin-top: -4rem;
    }
    
  ::ng-deep .darkmode-toggle:hover .p-togglebutton-icon {
    color: var(--p-cyan-400) !important;
  }

  ::ng-deep html.dark-mode .darkmode-toggle:hover .p-togglebutton-icon {
    color: var(--p-amber-400) !important;
  }
    `
})
export class HeaderComponent {
  private translate = inject(TranslateService);
  public localStore = inject(LocalStorageService);
  public theme = inject(ThemeService);

  get logoSrc() {
    return this.theme.darkMode() ? 'cra-logo-dark.png' : 'cra-logo.png';
  }

  // constructor(public langToggle: LangToggleService){} //putting the code below into a service works but we aren't calling it anywhere else
  constructor() {
    let curLang = this.localStore.getData('lang') || this.translate.getBrowserLang() || 'en';
    console.log(this.translate.getBrowserLang());
    this.translate.addLangs(['en', 'fr']);
    this.translate.setDefaultLang('en');
    this.translate.use(curLang);
  }

  selectLanguage(): void {
    let oppLang = ""
    if (this.translate.currentLang == "en") { oppLang = "fr" }
    else { oppLang = "en" }
    this.translate.use(oppLang);
    this.localStore.saveData('lang', oppLang);
  }

}