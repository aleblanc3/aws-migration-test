import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { FileProcessingResult } from '../../../../services/image-assistant-state.service';

@Component({
  selector: 'ca-csv-download',
  standalone: true,
  imports: [CommonModule, TranslateModule, ButtonModule],
  templateUrl: './csv-download.component.html',
  styles: [`
    .csv-download-container {
      margin-top: 2rem;
      padding: 1rem;
      background-color: var(--surface-100);
      border-radius: 8px;
    }
  `]
})
export class CsvDownloadComponent {
  @Input() results: Record<string, FileProcessingResult> = {};
  
  private readonly translate = inject(TranslateService);
  
  hasResults(): boolean {
    return Object.keys(this.results).length > 0;
  }
  
  hasCompletedResults(): boolean {
    return Object.values(this.results).some(result => result.status === 'completed');
  }

  isProcessingFinished(): boolean {
    // Processing is finished when there are results and none are in 'pending' or 'processing' state
    const allResults = Object.values(this.results);
    return allResults.length > 0 &&
           !allResults.some(result => result.status === 'pending' || result.status === 'processing');
  }

  shouldShowNoDataMessage(): boolean {
    // Only show "no data" message if processing is finished and no results completed successfully
    return this.isProcessingFinished() && !this.hasCompletedResults();
  }

  downloadCsv(): void {
    let csvContent = this.translate.instant('image.csv.header') + "\n";
    
    // Get sorted keys for consistent CSV output
    const sortedFileNames = Object.keys(this.results).sort();
    
    sortedFileNames.forEach(fileName => {
      const result = this.results[fileName];
      if (result.status === 'completed') {
        const identifier = result.fileName;
        const english = result.data.english || '';
        const french = result.data.french || '';
        
        const escapeCsv = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
        csvContent += `${escapeCsv(identifier)},${escapeCsv(english)},${escapeCsv(french)}\n`;
      }
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.translate.instant('image.csv.fileName');
    link.click();
    URL.revokeObjectURL(url);
  }
}