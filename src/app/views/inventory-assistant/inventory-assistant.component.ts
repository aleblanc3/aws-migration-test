import { Component, Injectable } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

// PrimeNG (primeflex) UI modules
import { Textarea } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { RadioButtonModule } from 'primeng/radiobutton';

// Interface for metadata extraction results
interface MetadataResult {
  url: string;
  title: string;
  description: string;
  keywords: string;
  source: string;
}

// Global cache for loaded CSV data
let csvCache: Record<string, any[]> = {};

@Injectable({
  providedIn: 'root'
})

@Component({
  selector: 'ca-inventory-assistant',
  imports: [TranslateModule, ButtonModule, FormsModule, CommonModule, Textarea, TableModule, RadioButtonModule],
  templateUrl: './inventory-assistant.component.html',
  styleUrl: './inventory-assistant.component.css'
})

export class InventoryAssistantComponent {

  // Component state variables
  results: MetadataResult[] = [];
  loading = false;
  errorMessage = '';
  urlsInput = '';
  selectedSourceOption: string = 'canadaOrGithub'; // Default radio button selection
  previewInput: string = '';


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

  /**
   * Extract metadata for preview URLs using local CSV data.
   */
  async fetchPreviewMetadata(input: string): Promise<void> {
    const urls = this.getCleanUrls(input);
    if (!urls.length) return;

    this.loading = true;
    this.results = [];

    // Load both CSVs if not already cached
    if (!csvCache['en'] || !csvCache['fr']) {
      [csvCache['en'], csvCache['fr']] = await Promise.all([
        this.loadCsv('gcPage-report/sanitized_cra_gcPageReport_en.csv'),
        this.loadCsv('gcPage-report/sanitized_cra_gcPageReport_fr.csv'),
      ]);
    }

    const metadataResults: MetadataResult[] = [];

    for (const url of urls) {
      let result: MetadataResult;

      if (!this.isValidUrl(url)) {
        result = this.buildErrorResult(url, 'Invalid URL', 'N/A', 'N/A');
      } else if (!url.includes('canada-preview.adobecqms.net')) {
        result = this.buildErrorResult(url, 'Not a preview URL', 'N/A', 'N/A');
      } else {
        const path = this.extractPreviewPath(url);
        console.log('Normalized preview path:', path);

        // Try matching against English then French report
        const found = this.searchCsvForPath(path, csvCache['en']) || this.searchCsvForPath(path, csvCache['fr']);

        if (found) {
          console.log('Found:', found);

          result = {
            url,
            title: found['H1'] || found['Page title'] || 'Untitled',
            description: found['Description'] || 'No Description',
            keywords: found['Keywords'] || 'No Keywords',
            source: 'AEM Preview'
          };
        } else {
          result = this.buildErrorResult(url, 'Not found in the report', 'N/A', 'N/A');
        }
      }

      metadataResults.push(result);
    }

    this.results = metadataResults;
    this.loading = false;
  }

  /**
   * Load and parse CSV file from a path.
   */
  private async loadCsv(path: string): Promise<any[]> {
    const response = await fetch(path);
    const text = await response.text();
    return this.parseCsv(text);
  }

  /**
   * Parse CSV string into an array of objects (rows).
   */
  private parseCsv(csvText: string): any[] {
    const rows: any[] = [];
    const lines = csvText.split('\n').filter(line => line.trim().length > 0);
    const headers = this.splitCsvLine(lines[0]);

    for (const line of lines.slice(1)) {
      const values = this.splitCsvLine(line);
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      rows.push(row);
    }

    return rows;
  }

  /**
   * Split a CSV line into values, handling quoted commas.
   */
  private splitCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map(v => v.trim());
  }

  /**
   * Extract the path (and search params) from a preview URL.
   */
  private extractPreviewPath(url: string): string {
    try {
      const parsed = new URL(url);
      return (parsed.pathname + parsed.search).toLowerCase().replace(/\/$/, '');
    } catch {
      return '';
    }
  }

  /**
   * Search CSV array for a row matching the normalized preview path.
   */
  private searchCsvForPath(previewPath: string, data: any[]): any | undefined {
    const normalizedPreviewPath = previewPath.toLowerCase().replace(/\/$/, '');

    return data.find(row => {
      const publicPath = row['Public path'];
      if (!publicPath) return false;

      try {
        const normalizedCsvPath = new URL(publicPath).pathname.toLowerCase().replace(/\/$/, '');
        return normalizedCsvPath === normalizedPreviewPath;
      } catch {
        return false;
      }
    });
  }

  /**
   * Clear inputs and results when radio option changes.
   */
  onSourceChange(): void {
    this.results = [];
    this.loading = false;
    this.urlsInput = '';
    this.previewInput = '';
  }
}
