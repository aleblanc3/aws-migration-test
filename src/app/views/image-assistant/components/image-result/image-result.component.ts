import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FileProcessingResult } from '../../../../services/image-assistant-state.service';
import { ImageProcessorService } from '../../../../services/image-processor';

@Component({
  selector: 'ca-image-result',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    CardModule,
    DividerModule,
    MessageModule,
    ProgressSpinnerModule
  ],
  templateUrl: './image-result.component.html',
  styleUrls: ['./image-result.component.css']
})
export class ImageResultComponent {
  @Input() result!: FileProcessingResult;
  
  private readonly translate = inject(TranslateService);
  private readonly imageProcessor = inject(ImageProcessorService);

  toggleFullText(): void {
    this.result.showFullText = !this.result.showFullText;
  }

  async copyText(text: string | null, event: MouseEvent): Promise<void> {
    if (!text) return;
    
    const button = event.target as HTMLButtonElement;
    const originalText = button.textContent;
    
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = this.translate.instant('image.result.copied');
      setTimeout(() => button.textContent = originalText, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      button.textContent = this.translate.instant('image.result.copyFailed');
      setTimeout(() => button.textContent = originalText, 2000);
    }
  }

  formatDescription(text: string | null): string {
    return this.imageProcessor.formatDescription(text);
  }

  getTruncatedText(text: string | null, maxLength = 150): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) : text;
  }

  shouldShowToggle(text: string | null): boolean {
    return (text || '').length > 150;
  }
}