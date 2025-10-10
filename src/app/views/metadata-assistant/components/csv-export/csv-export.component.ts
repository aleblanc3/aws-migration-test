import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { MetadataResult } from '../../../../services/metadata-assistant.service';

@Component({
  selector: 'ca-metadata-csv-export',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    CardModule,
    TooltipModule
  ],
  templateUrl: './csv-export.component.html',
  styleUrls: ['./csv-export.component.css']
})
export class CsvExportComponent {
  @Input() results: MetadataResult[] = [];
  @Input() includeTranslations = false;

  private translate = inject(TranslateService);

  getTranslatedResultsCount(): number {
    return this.results.filter(r => r.frenchTranslatedDescription).length;
  }

  exportToCsv(): void {
    if (!this.results || this.results.length === 0) {
      return;
    }

    const csvContent = this.generateCsvContent();
    this.downloadCsv(csvContent);
  }

  private generateCsvContent(): string {
    const headers = this.getHeaders();
    const rows = this.results.map(result => this.resultToRow(result));
    
    // Combine headers and rows
    const allRows = [headers, ...rows];
    
    // Convert to CSV format
    return allRows.map(row => 
      row.map(cell => this.escapeCsvCell(cell)).join(',')
    ).join('\n');
  }

  private getHeaders(): string[] {
    const baseHeaders = [
      this.translate.instant('metadata.csv.url'),
      this.translate.instant('metadata.csv.language'),
      this.translate.instant('metadata.csv.scrapedContent'),
      this.translate.instant('metadata.csv.metaDescription'),
      this.translate.instant('metadata.csv.metaKeywords')
    ];

    if (this.includeTranslations) {
      baseHeaders.push(
        this.translate.instant('metadata.csv.frenchDescription'),
        this.translate.instant('metadata.csv.frenchKeywords')
      );
    }

    return baseHeaders;
  }

  private resultToRow(result: MetadataResult): string[] {
    const row = [
      result.url,
      result.language,
      result.scrapedContent,
      result.metaDescription,
      result.metaKeywords
    ];

    if (this.includeTranslations && result.frenchTranslatedDescription) {
      row.push(
        result.frenchTranslatedDescription,
        result.frenchTranslatedKeywords || ''
      );
    } else if (this.includeTranslations) {
      row.push('', '');
    }

    return row;
  }

  private escapeCsvCell(cell: string): string {
    if (cell == null) {
      return '';
    }
    
    // Convert to string and handle special characters
    const cellStr = String(cell);
    
    // If cell contains comma, newline, or quotes, wrap in quotes
    if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
      // Escape quotes by doubling them
      const escaped = cellStr.replace(/"/g, '""');
      return `"${escaped}"`;
    }
    
    return cellStr;
  }

  private downloadCsv(content: string): void {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = this.includeTranslations 
      ? `metadata-with-translations-${timestamp}.csv`
      : `metadata-results-${timestamp}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  getExportButtonLabel(): string {
    const count = this.results.length;
    return this.translate.instant('metadata.csv.exportButton', { count });
  }
}