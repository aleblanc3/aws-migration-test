import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AccordionModule } from 'primeng/accordion';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { MetadataResult } from '../../../../services/metadata-assistant.service';

@Component({
  selector: 'ca-metadata-result',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    AccordionModule,
    CardModule,
    ChipModule,
    ButtonModule,
    TagModule,
    TooltipModule
  ],
  templateUrl: './metadata-result.component.html',
  styleUrls: ['./metadata-result.component.css']
})
export class MetadataResultComponent {
  @Input() results: MetadataResult[] = [];
  @Input() showTranslations = false;

  expandedStates: { [key: number]: boolean } = {};

  toggleExpanded(index: number): void {
    this.expandedStates[index] = !this.expandedStates[index];
  }

  isExpanded(index: number): boolean {
    return this.expandedStates[index] || false;
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    });
  }

  getKeywordsArray(keywords: string): string[] {
    return keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
  }

  getDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  truncateContent(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }
}