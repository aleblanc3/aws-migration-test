import { Component } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

//primeNG
import { Textarea } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

@Component({
  selector: 'ca-inventory-assistant',
  imports: [TranslateModule, ButtonModule, FormsModule, CommonModule, Textarea, TableModule],
  templateUrl: './inventory-assistant.component.html',
  styleUrl: './inventory-assistant.component.css'
})

export class InventoryAssistantComponent {
  urlsInput = '';
  results: MetadataResult[] = [];
  loading = false;

  constructor(private http: HttpClient) { }

  fetchMetadata(): void {
    const urls = this.getCleanUrls(this.urlsInput);
    if (!urls.length) return;

    this.loading = true;
    this.results = [];

    const resultsBuffer: (MetadataResult | null)[] = Array(urls.length).fill(null);

    urls.forEach((url, index) => {
      this.processUrl(url, index, resultsBuffer);
    });
  }

  private getCleanUrls(input: string): string[] {
    return input
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
  }

  private processUrl(url: string, index: number, buffer: (MetadataResult | null)[]): void {
    if (!this.isValidUrl(url)) {
      buffer[index] = this.buildErrorResult(url, 'Invalid URL', 'N/A', 'N/A');
      this.updateResults(buffer);
      return;
    }

    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;

    this.http.get(proxyUrl, { responseType: 'text' }).subscribe({
      next: html => {
        buffer[index] = this.extractMetadata(html, url);
        this.updateResults(buffer);
      },
      error: () => {
        buffer[index] = this.buildErrorResult(url, url, 'Could not fetch metadata', '');
        this.updateResults(buffer);
      }
    });
  }

  //Checks if processing is complete
  //Turns buffer array of MetadataResults or nulls that no longer has nulls into an array of MetadataResult only.
  private updateResults(buffer: (MetadataResult | null)[]): void {
    if (buffer.every(item => item !== null)) {
      this.results = buffer as MetadataResult[];
      this.loading = false;
    }
  }

  private extractMetadata(html: string, url: string): MetadataResult {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const h1 = doc.querySelector('h1')?.innerText.trim();
    const titleTag = doc.querySelector('title')?.innerText.trim();
    const title = h1 || titleTag || url;

    const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || 'No Description';
    const keywords = doc.querySelector('meta[name="keywords"]')?.getAttribute('content') || 'No Keywords';
    const source = this.detectSource(url);

    return { url, title, description, keywords, source };
  }

  private buildErrorResult(url: string, title: string, description: string, keywords: string): MetadataResult {
    return {
      url,
      title,
      description,
      keywords,
      source: this.detectSource(url)
    };
  }

  private detectSource(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      if (hostname.includes('canada.ca')) return 'CA';
      if (hostname.includes('github.io') || hostname.includes('github.com')) return 'GH';
      return '';
    } catch {
      return '';
    }
  }

  private isValidUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }
}

interface MetadataResult {
  url: string;
  title: string;
  description: string;
  keywords: string;
  source: string;
}
