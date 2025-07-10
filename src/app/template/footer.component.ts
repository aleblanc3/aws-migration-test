import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from "@ngx-translate/core";
import { ToolbarModule } from 'primeng/toolbar';

@Component({
  selector: 'ca-footer',
  imports: [CommonModule, TranslateModule, ToolbarModule],
  template: `
<footer class="container">
  <p-toolbar>
    <div class="flex align-items-end">
      <p class="text-color-secondary text-sm pt-5">{{'app.version'|translate}}</p>
    </div>
    <div class="flex align-items-end">
      <img
          class="img-fluid fip-colour"
          [src]="logoSrc"
          [alt]="'GoC' | translate"
        />
    </div>
  </p-toolbar>
</footer>
  `,
  styles: `
    :host {
      display: block;
    }
  `
})
export class FooterComponent {
  @Input() darkMode = false;
  get logoSrc() {
    return this.darkMode ? 'canada-logo-dark.png' : 'canada-logo.png';
  }
}
