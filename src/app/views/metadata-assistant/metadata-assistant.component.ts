import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { Subject, takeUntil } from 'rxjs';
import { MetadataAssistantService } from '../../services/metadata-assistant.service';
import { MetadataAssistantStateService, MetadataProcessingState } from '../../services/metadata-assistant-state.service';
import { ApiKeyService } from '../../services/api-key.service';
import { SharedModelSelectorComponent, ModelOption } from '../../components/model-selector/model-selector.component';
import { ProgressIndicatorComponent } from '../../components/progress-indicator/progress-indicator.component';
import { UrlInputComponent } from './components/url-input/url-input.component';
import { MetadataResultComponent } from './components/metadata-result/metadata-result.component';
import { CsvExportComponent } from './components/csv-export/csv-export.component';

@Component({
  selector: 'ca-metadata-assistant',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    FormsModule,
    ButtonModule,
    CardModule,
    MessageModule,
    SharedModelSelectorComponent,
    ProgressIndicatorComponent,
    UrlInputComponent,
    MetadataResultComponent,
    CsvExportComponent
  ],
  templateUrl: './metadata-assistant.component.html',
  styleUrls: ['./metadata-assistant.component.css']
})
export class MetadataAssistantComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  state: MetadataProcessingState = {
    isProcessing: false,
    currentUrl: '',
    currentStep: 'idle',
    progress: 0,
    totalUrls: 0,
    processedUrls: 0,
    results: [],
    error: null,
    selectedModel: 'mistralai/mistral-small-3.2-24b-instruct:free',
    translateToFrench: false
  };

  urlInput = '';
  urls: string[] = [];
  
  models: ModelOption[] = [
    { 
      name: 'Mistral Small 3.2 24B', 
      value: 'mistralai/mistral-small-3.2-24b-instruct:free',
      description: 'metadata.models.mistralDescription'
    },
    { 
      name: 'Qwen 3 30B', 
      value: 'qwen/qwen3-30b-a3b:free',
      description: 'metadata.models.qwenDescription'
    },
    { 
      name: 'Google Gemma 3 27B', 
      value: 'google/gemma-3-27b-it:free',
      description: 'metadata.models.gemmaDescription'
    }
  ];

  constructor(
    private translate: TranslateService,
    private metadataService: MetadataAssistantService,
    private stateService: MetadataAssistantStateService,
    public apiKeyService: ApiKeyService
  ) {}

  ngOnInit(): void {
    // Subscribe to state changes
    this.stateService.state$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.state = state;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onUrlsChange(urls: string[]): void {
    this.urls = urls;
  }

  onUrlInputChange(input: string): void {
    this.urlInput = input;
  }

  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  onModelChange(model: string): void {
    this.stateService.setSelectedModel(model);
  }

  onTranslateToggle(translate: boolean): void {
    this.stateService.setTranslateToFrench(translate);
  }

  startProcessing(): void {
    if (!this.apiKeyService.hasApiKey$.value) {
      this.stateService.setError(this.translate.instant('metadata.errors.noApiKey'));
      return;
    }

    if (this.urls.length === 0) {
      this.stateService.setError(this.translate.instant('metadata.errors.noUrls'));
      return;
    }

    this.stateService.startProcessing(
      this.urls,
      this.state.selectedModel,
      this.state.translateToFrench
    );

    // Process URLs
    this.metadataService.processUrls({
      urls: this.urls,
      model: this.state.selectedModel,
      translateToFrench: this.state.translateToFrench
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (results) => {
        // Results are accumulated in the state service
        results.forEach(result => {
          this.stateService.addResult(result);
        });
      },
      error: (error) => {
        console.error('Processing error:', error);
        this.stateService.setError(
          error.message || this.translate.instant('metadata.errors.processingFailed')
        );
      },
      complete: () => {
        this.stateService.completeProcessing();
      }
    });
  }

  reset(): void {
    this.stateService.reset();
    this.urlInput = '';
    this.urls = [];
  }

  canProcess(): boolean {
    return this.apiKeyService.hasApiKey$.value && this.urls.length > 0 && !this.state.isProcessing;
  }

  getProgressText(): string {
    if (this.state.currentStep === 'scraping') {
      return this.translate.instant('metadata.progress.scrapingContent');
    } else if (this.state.currentStep === 'generating') {
      return this.translate.instant('metadata.progress.generatingMetadata');
    } else if (this.state.currentStep === 'translating') {
      return this.translate.instant('metadata.progress.translatingContent');
    } else if (this.state.currentStep === 'complete') {
      return this.translate.instant('metadata.progress.completeTitle');
    }
    return '';
  }
}