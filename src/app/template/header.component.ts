import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from "@ngx-translate/core";

import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { ToggleButtonModule } from 'primeng/togglebutton';

import { ApiResetComponent } from '../common/api-reset.component';
import { LocalStorageService } from '../services/local-storage.service';

@Component({
  selector: 'ca-header',
  imports: [CommonModule, TranslateModule, ToolbarModule, ButtonModule, ToggleButtonModule, ApiResetComponent],
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
    <div class="flex align-items-end gap-3">
      <ca-api-reset
        *ngIf="this.localStore.getData('apiKey') != null">
      </ca-api-reset>

      <p-togglebutton
        offIcon="pi pi-moon"
        offLabel=""
        onIcon="pi pi-sun"
        onLabel=""
        class="p-button-rounded p-button-secondary p-button-outlined p-button-sm pr-0"
        (click)="toggleDarkMode()">
      </p-togglebutton>

      <a
        class="cursor-pointer underline font-medium text-blue-600 hover:text-blue-800"
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
      border-bottom-color: #c4c4c4;
      border-width: 1px;
      margin-top: -4rem;
    }
    `
})
export class HeaderComponent {
  @Output() darkModeToggled = new EventEmitter<void>();
  @Input() darkMode = false;
  get logoSrc() {
    return this.darkMode ? 'cra-logo-dark.png' : 'cra-logo.png';
  }

  // constructor(public langToggle: LangToggleService){} //putting the code below into a service works but we aren't calling it anywhere else
  constructor(private translate: TranslateService, public localStore: LocalStorageService) {
    this.translate.addLangs(['en', 'fr']);
    this.translate.setDefaultLang('en');
    this.translate.use(this.translate.getBrowserLang() || "en");
  }

  selectLanguage(): void {
    var oppLang = ""
    if (this.translate.currentLang == "en") { oppLang = "fr" }
    else { oppLang = "en" }
    this.translate.use(oppLang);
  }

  toggleDarkMode() {
    this.darkModeToggled.emit();
    const element = document.querySelector('html');
    if (element) { element.classList.toggle('dark-mode'); }
  }
}