import { Component, Injectable, inject } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// PrimeNG (primeflex) UI modules
import { Textarea } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

// Interface for metadata extraction results
interface MetadataResult {
  url: string;
  title: string;
  description: string;
  keywords: string;
  source: string;
}

@Injectable({
  providedIn: 'root'
})

@Component({
  selector: 'ca-inventory-assistant',
  imports: [TranslateModule, ButtonModule, FormsModule, CommonModule, Textarea, TableModule],
  templateUrl: './inventory-assistant.component.html',
  styleUrl: './inventory-assistant.component.css'
})

export class InventoryAssistantComponent {
  // Component state
  results: MetadataResult[] = [];
  loading = false;
  errorMessage = '';
  urlsInput = '';

  /**
   * Main method for processing multiple URLs from input.
   * Populates the `results` array with extracted metadata.
   */
  async fetchMetadata(urlsInput: string): Promise<void> {
    const urls = this.getCleanUrls(urlsInput);
    if (!urls.length) return;

    this.loading = true;
    this.results.length = 0; // Clear the existing results

    const resultsBuffer: (MetadataResult | null)[] = Array(urls.length).fill(null);

    // Fetch and process all URLs concurrently
    const promises = urls.map((url, index) => this.processUrl(url, index, resultsBuffer));
    await Promise.all(promises);

    // Filter out any null entries and update results
    const validResults = resultsBuffer.filter((r): r is MetadataResult => r !== null);
    this.results.splice(0, this.results.length, ...validResults);

    this.loading = false;
  }

  /**
   * Splits a multi-line string into a clean array of trimmed, non-empty URLs.
   */
  private getCleanUrls(input: string): string[] {
    return input
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
  }

  /**
   * Processes a single URL, extracting metadata and updating the results buffer.
   */
  private async processUrl(url: string, index: number, buffer: (MetadataResult | null)[]): Promise<void> {
    if (!this.isValidUrl(url)) {
      buffer[index] = this.buildErrorResult(url, 'Invalid URL', 'N/A', 'N/A');
      this.updateResults(buffer);
      return;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Fetch failed: HTTP ${response.status}`);
      }

      const html = await response.text();
      buffer[index] = this.extractMetadata(html, url);

      console.log('Success', buffer[index]);
    } catch {
      buffer[index] = this.buildErrorResult(url, url, 'Could not fetch metadata', '');
      console.log('Error', buffer[index]);
    }

    this.updateResults(buffer);
  }

  /**
   * Updates the displayed results once all URLs are processed.
   */
  private updateResults(buffer: (MetadataResult | null)[]): void {
    if (buffer.every(item => item !== null)) {
      this.results = buffer as MetadataResult[];
      this.loading = false;
    }
  }

  /**
   * Extracts metadata fields from the raw HTML string.
   */
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

  /**
   * Returns a fallback metadata object in case of error.
   */
  private buildErrorResult(url: string, title: string, description: string, keywords: string): MetadataResult {
    return {
      url,
      title,
      description,
      keywords,
      source: this.detectSource(url)
    };
  }

  /**
   * Attempts to detect the source type from a given URL.
   */
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

  /**
   * Validates whether a string is a properly formatted URL.
   */
  private isValidUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }
}
