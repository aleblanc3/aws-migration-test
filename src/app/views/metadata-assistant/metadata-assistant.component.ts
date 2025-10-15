import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ToastModule } from 'primeng/toast';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';
import { Subject, takeUntil } from 'rxjs';
import { MetadataAssistantService, MetadataResult } from '../../services/metadata-assistant.service';
import { MetadataAssistantStateService, MetadataProcessingState } from '../../services/metadata-assistant-state.service';
import { ApiKeyService } from '../../services/api-key.service';
import { SharedModelSelectorComponent, ModelOption } from '../../components/model-selector/model-selector.component';
import { ProgressIndicatorComponent } from '../../components/progress-indicator/progress-indicator.component';
import { UrlInputComponent } from './components/url-input/url-input.component';
import { MetadataResultComponent } from './components/metadata-result/metadata-result.component';
import { CsvExportComponent } from './components/csv-export/csv-export.component';
import { DocumentUploadComponent } from './components/document-upload/document-upload.component';

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
    TabsModule,
    SharedModelSelectorComponent,
    ProgressIndicatorComponent,
    UrlInputComponent,
    MetadataResultComponent,
    CsvExportComponent,
    DocumentUploadComponent
  ],
  providers: [MessageService],
  templateUrl: './metadata-assistant.component.html',
  styleUrls: ['./metadata-assistant.component.css']
})
export class MetadataAssistantComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  private translate = inject(TranslateService);
  private metadataService = inject(MetadataAssistantService);
  private stateService = inject(MetadataAssistantStateService);
  public apiKeyService = inject(ApiKeyService);
  private messageService = inject(MessageService);
  
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
    translateToFrench: false,
    documentProcessingIndex: null
  };

  urlInput = '';
  urls: string[] = [];

  // Document tab properties
  selectedDocument: File | null = null;
  documentLanguage: 'en' | 'fr' | null = null;
  documentText = '';
  documentResults: MetadataResult[] = [];

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
    },
    {
      name: 'Tencent Hunyuan A13B',
      value: 'tencent/hunyuan-a13b-instruct:free',
      description: 'metadata.models.hunyuanDescription'
    }
  ];

  ngOnInit(): void {
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
        results.forEach(result => {
          this.stateService.addResult(result);

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

  onDocumentSelected(file: File, resultIndex: number): void {
    if (!this.apiKeyService.hasApiKey$.value) {
      this.stateService.setError(this.translate.instant('metadata.errors.noApiKey'));
      return;
    }

    const result = this.state.results[resultIndex];
    if (!result.frenchTranslatedDescription || !result.frenchTranslatedKeywords) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('metadata.document.errors.noTranslation'),
        life: 4000
      });
      return;
    }

    this.stateService.setDocumentProcessingIndex(resultIndex);
    this.stateService.updateState({
      isProcessing: true,
      currentStep: 'processing-document'
    });

    this.metadataService.processDocument(file).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (documentMetadata) => {
        this.stateService.updateResultWithDocumentMetadata(resultIndex, documentMetadata);
        this.stateService.updateState({ currentStep: 'evaluating' });
        this.evaluateMetadata(resultIndex, documentMetadata);
      },
      error: (error) => {
        console.error('Document processing error:', error);
        this.stateService.updateState({
          isProcessing: false,
          documentProcessingIndex: null,
          currentStep: 'complete'
        });
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('metadata.document.errors.processingFailed'),
          detail: error.message,
          life: 5000
        });
      }
    });
  }

  private evaluateMetadata(resultIndex: number, documentMetadata: { description: string, keywords: string }): void {
    const result = this.state.results[resultIndex];
    const translatedMetadata = {
      description: result.frenchTranslatedDescription!,
      keywords: result.frenchTranslatedKeywords!
    };

    this.metadataService.evaluateMetadata(translatedMetadata, documentMetadata).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (evaluationResult) => {
        this.stateService.updateResultWithEvaluation(resultIndex, evaluationResult);
        this.stateService.updateState({
          isProcessing: false
        });
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('metadata.document.evaluationComplete'),
          life: 4000
        });
      },
      error: (error) => {
        console.error('Evaluation error:', error);
        this.stateService.updateState({
          isProcessing: false,
          documentProcessingIndex: null,
          currentStep: 'complete'
        });
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('metadata.document.errors.evaluationFailed'),
          detail: error.message,
          life: 5000
        });
      }
    });
  }

  onDocumentFileSelected(file: File): void {
    this.selectedDocument = file;
    this.documentLanguage = null;
    this.documentText = '';
  }

  startDocumentProcessing(): void {
    if (!this.apiKeyService.hasApiKey$.value) {
      this.stateService.setError(this.translate.instant('metadata.errors.noApiKey'));
      return;
    }

    if (!this.selectedDocument) {
      this.stateService.setError(this.translate.instant('metadata.document.errors.processingFailed'));
      return;
    }

    this.stateService.updateState({
      isProcessing: true,
      currentStep: 'extracting-text',
      totalUrls: 1,
      processedUrls: 0,
      currentUrl: this.selectedDocument.name
    });

    this.metadataService.processDocumentForMetadata(
      this.selectedDocument,
      this.state.selectedModel
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (result) => {
        this.documentLanguage = result.language;
        this.documentText = result.text;
        this.documentResults = [result.metadata];

        this.stateService.updateState({
          isProcessing: false,
          currentStep: 'complete',
          processedUrls: 1
        });

        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('metadata.progress.completeTitle'),
          detail: this.translate.instant('metadata.document.languageDetected') + ': ' +
                  this.translate.instant(result.language === 'en' ? 'common.language.english' : 'common.language.french'),
          life: 4000
        });
      },
      error: (error) => {
        console.error('Document processing error:', error);
        this.stateService.updateState({
          isProcessing: false,
          currentStep: 'idle'
        });
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('metadata.document.errors.processingFailed'),
          detail: error.message,
          life: 5000
        });
      }
    });
  }

  resetDocumentTab(): void {
    this.selectedDocument = null;
    this.documentLanguage = null;
    this.documentText = '';
    this.documentResults = [];
    this.stateService.updateState({
      isProcessing: false,
      currentStep: 'idle',
      error: null
    });
  }

  canProcessDocument(): boolean {
    return this.apiKeyService.hasApiKey$.value &&
           this.selectedDocument !== null &&
           !this.state.isProcessing;
  }
}