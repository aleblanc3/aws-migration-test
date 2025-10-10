import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InputTextarea } from 'primeng/inputtextarea';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'ca-url-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    InputTextarea,
    ButtonModule,
    CardModule,
    ChipModule,
    MessageModule
  ],
  templateUrl: './url-input.component.html',
  styleUrls: ['./url-input.component.css']
})
export class UrlInputComponent {
  @Input() disabled = false;
  @Output() urlsChange = new EventEmitter<string[]>();
  @Output() urlInputChange = new EventEmitter<string>();

  private translate = inject(TranslateService);

  urlText = '';
  validUrls: string[] = [];
  invalidUrls: string[] = [];

  // Allowed hosts - same as metadata service
  private allowedHosts = new Set([
    'cra-design.github.io',
    'cra-proto.github.io',
    'gc-proto.github.io',
    'test.canada.ca',
    'www.canada.ca'
  ]);

  onTextChange(): void {
    this.parseUrls();
    this.urlInputChange.emit(this.urlText);
  }

  parseUrls(): void {
    const lines = this.urlText.split('\n').filter(line => line.trim());
    this.validUrls = [];
    this.invalidUrls = [];

    lines.forEach(line => {
      const url = line.trim();
      if (url) {
        if (this.isValidUrl(url)) {
          this.validUrls.push(url);
        } else {
          this.invalidUrls.push(url);
        }
      }
    });

    this.urlsChange.emit(this.validUrls);
  }

  isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      // Check protocol and host
      const validProtocol = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
      const validHost = this.allowedHosts.has(urlObj.host);
      return validProtocol && validHost;
    } catch {
      return false;
    }
  }
  
  getInvalidReason(url: string): string {
    try {
      const urlObj = new URL(url);
      if (!this.allowedHosts.has(urlObj.host)) {
        return this.translate.instant('metadata.urlInput.errors.domainNotSupported', { host: urlObj.host });
      }
      return this.translate.instant('metadata.urlInput.errors.invalidFormat');
    } catch {
      return this.translate.instant('metadata.urlInput.errors.invalidFormat');
    }
  }

  clearInput(): void {
    this.urlText = '';
    this.validUrls = [];
    this.invalidUrls = [];
    this.urlsChange.emit([]);
    this.urlInputChange.emit('');
  }

  loadSampleUrls(): void {
    this.urlText = 'https://www.canada.ca/en/revenue-agency.html\nhttps://www.canada.ca/fr/agence-revenu.html\nhttps://www.canada.ca/en/revenue-agency/services/tax/businesses.html';
    this.parseUrls();
  }
  
  getAllowedDomainsText(): string {
    return Array.from(this.allowedHosts).join(', ');
  }
}