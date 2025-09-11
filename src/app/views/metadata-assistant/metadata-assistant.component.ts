import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
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
    ToastModule,
    SharedModelSelectorComponent,
    ProgressIndicatorComponent,
    UrlInputComponent,
    MetadataResultComponent,
    CsvExportComponent
  ],
  providers: [MessageService],
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
      name: 'Meta Llama 3.3 70B', 
      value: 'meta-llama/llama-3.3-70b-instruct:free',
      description: 'metadata.models.llamaDescription'
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
    public apiKeyService: ApiKeyService,
    private messageService: MessageService
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

    // Process URLs with fallback models
    const fallbackModels = this.models
      .map(m => m.value)
      .filter(m => m !== this.state.selectedModel);

    this.metadataService.processUrls({
      urls: this.urls,
      model: this.state.selectedModel,
      translateToFrench: this.state.translateToFrench,
      fallbackModels: fallbackModels
    }).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (results) => {
        // Results are accumulated in the state service
        results.forEach(result => {
          this.stateService.addResult(result);
          
          // Show fallback notification if fallback was used
          if (result.fallbackUsed && result.modelUsed) {
            this.messageService.add({
              severity: 'info',
              summary: this.translate.instant('metadata.fallback.usingModel', { model: this.getModelDisplayName(result.modelUsed) }),
              life: 4000
            });
          }
        });
      },
      error: (error) => {
        console.error('Processing error:', error);
        let errorMessage = error.message || this.translate.instant('metadata.errors.processingFailed');
        
        // Handle specific error for when all models fail
        if (error.message?.includes('All models failed')) {
          errorMessage = this.translate.instant('metadata.errors.allModelsFailed');
        }
        
        this.stateService.setError(errorMessage);
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

  private getModelDisplayName(modelValue: string): string {
    const model = this.models.find(m => m.value === modelValue);
    return model ? model.name : modelValue;
  }
}