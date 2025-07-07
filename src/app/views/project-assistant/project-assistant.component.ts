import { Component } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'ca-project-assistant',
  standalone: true,
  imports: [TranslateModule, FormsModule, CommonModule],
  templateUrl: './project-assistant.component.html',
  styleUrls: ['./project-assistant.component.css']
})
export class ProjectAssistantComponent {
  urlsInput = '';
  results: MetadataResult[] = [];
  loading = false;

  constructor(private http: HttpClient) { }

  fetchMetadata() {
    const urls = this.urlsInput
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    this.results = [];
    this.loading = true;

    const tempResults: (MetadataResult | null)[] = new Array(urls.length).fill(null);

    urls.forEach((url, index) => {
      if (this.isValidUrl(url)) {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        this.http.get(proxyUrl).subscribe({
          next: (res: any) => {
            const html = res.contents;
            const metadata = this.extractMetadata(html, url);
            tempResults[index] = metadata;
            this.updateResults(tempResults);
          },
          error: () => {
            tempResults[index] = {
              url,
              title: url,
              description: 'Could not fetch metadata',
              keywords: '',
            };
            this.updateResults(tempResults);
          }
        });
      } else {
        tempResults[index] = {
          url,
          title: 'Invalid URL',
          description: 'N/A',
          keywords: 'N/A',
        };
        this.updateResults(tempResults);
      }
    });
  }

  updateResults(arr: (MetadataResult | null)[]) {
    if (arr.every(item => item !== null)) {
      this.results = arr as MetadataResult[];
      this.loading = false;
    }
  }

  extractMetadata(html: string, url: string): MetadataResult {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    let title = doc.querySelector('title')?.innerText || url;
    let description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || 'No Description';
    let keywords = doc.querySelector('meta[name="keywords"]')?.getAttribute('content') || 'No Keywords';

    title = title.replace(' - Canada.ca', '');

    return { url, title, description, keywords };
  }

  isValidUrl(str: string): boolean {
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
}
