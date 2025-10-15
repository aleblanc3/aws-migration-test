import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { Toast } from 'primeng/toast';
import { MessageService } from 'primeng/api';

// Services
import { ApiKeyService } from '../../services/api-key.service';
import { ImageProcessorService, VisionAnalysisResult } from '../../services/image-processor';
import { ImageAssistantStateService, FileProcessingResult, ProcessingState } from '../../services/image-assistant-state.service';
import { PdfConverterService } from '../../services/pdf-converter.service';

// Components
import { FileUploadComponent } from './components/file-upload/file-upload.component';
import { SharedModelSelectorComponent, ModelOption } from '../../components/model-selector/model-selector.component';
import { ProgressIndicatorComponent } from '../../components/progress-indicator/progress-indicator.component';
import { ImageResultComponent } from './components/image-result/image-result.component';
import { CsvDownloadComponent } from './components/csv-download/csv-download.component';

@Component({
  selector: 'ca-image-assistant',
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    TooltipModule,
    Toast,
    FileUploadComponent,
    SharedModelSelectorComponent,
    ProgressIndicatorComponent,
    ImageResultComponent,
    CsvDownloadComponent
  ],
  providers: [MessageService],
  templateUrl: './image-assistant.component.html',
  styles: [`
    .results-section {
      margin-top: 2rem;
    }
  `]
})
export class ImageAssistantComponent implements OnInit, OnDestroy {
  // Processing State
  selectedVisionModel = 'qwen/qwen2.5-vl-32b-instruct:free';
  filesToProcess: {file: File, displayName: string}[] = [];
  state$!: Observable<ProcessingState>;
  
  // Timing tracking
  private processingStartTime = 0;
  
  // Model options for the shared selector
  visionModels: ModelOption[] = [
    {
      name: 'image.model.qwen32',
      value: 'qwen/qwen2.5-vl-32b-instruct:free',
      description: 'image.model.qwen32Description'
    },
    {
      name: 'image.model.qwen72',
      value: 'qwen/qwen2.5-vl-72b-instruct:free',
      description: 'image.model.qwen72Description'
    },
    {
      name: 'image.model.gemma',
      value: 'google/gemma-3-27b-it:free',
      description: 'image.model.gemmaDescription'
    },
    {
      name: 'image.model.llama',
      value: 'meta-llama/llama-3.2-11b-vision-instruct',
      description: 'image.model.llamaDescription'
    }
  ];
  
  private subscriptions: Subscription[] = [];

  public readonly apiKeyService = inject(ApiKeyService);
  private readonly imageProcessorService = inject(ImageProcessorService);
  private readonly stateService = inject(ImageAssistantStateService);
  private readonly translate = inject(TranslateService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pdfConverterService = inject(PdfConverterService);
  private readonly messageService = inject(MessageService);

  constructor() {
    this.state$ = this.stateService.state$;
  }

  ngOnInit(): void {
    // check for API key in URL parameters
    this.route.queryParams.subscribe(params => {
      const apiKey = params['key'];
      if (apiKey) {
        // set the API key from URL parameter
        this.apiKeyService.setKey(apiKey);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onFilesSelected(files: FileList): void {
    console.log('Files selected:', files);
    console.time("Image processing time");
    
    // Start timing
    this.processingStartTime = performance.now();
    
    // Convert FileList to Array and count non-PDF files
    this.filesToProcess = [];
    let actualFileCount = 0;
    
    for (const file of files) {
      this.filesToProcess.push({
        file: file,
        displayName: file.name
      });
      
      // Only count non-PDF files for the progress indicator
      if (file.type !== 'application/pdf') {
        actualFileCount++;
      }
    }
    
    // Reset state and start processing. i need to look aty this it's a bit funky
    this.stateService.resetState();
    this.stateService.updateState({
      filesInProgress: actualFileCount, 
      processedCount: 0,
      showProgressArea: true,
      progressText: this.translate.instant('image.progress.starting', { count: actualFileCount })
    });
    
    this.processNextFile();
  }

  onModelChange(model: string): void {
    this.selectedVisionModel = model;
    alert(this.translate.instant('image.model.changeAlert'));
    this.stateService.resetState();
  }

  private async processNextFile(): Promise<void> {
    if (this.filesToProcess.length === 0) {
      this.finalizeProcessing();
      return;
    }

    const fileInfo = this.filesToProcess.shift()!;
    const file = fileInfo.file;
    const displayName = fileInfo.displayName;
    const isPdfPage = displayName.includes(' - Page ');
    
    // Only initialize result for non-PDF files
    if (file.type !== 'application/pdf') {
      const result: FileProcessingResult = {
        fileName: displayName,
        type: 'image',
        status: 'processing',
        data: { imageBase64: null, english: null, french: null, error: null },
        showFullText: false
      };
      
      this.stateService.addResult(displayName, result);
    }
    
    // Update progress
    const state = this.stateService.getCurrentState();
    this.stateService.updateState({
      progressText: this.translate.instant('image.progress.processing', {
        fileName: displayName,
        current: state.processedCount + 1,
        total: state.filesInProgress
      })
    });
    
    try {
      // Handle PDFs by converting to images first
      if (file.type === 'application/pdf') {
        console.log('Converting PDF to images:', displayName);
        const images = await this.pdfConverterService.convertPdfToImages(file);
        
        if (images.length > 0) {
          console.log(`PDF has ${images.length} pages. Processing all pages...`);
          
          // Add each page as a separate file to process
          images.forEach((imageDataUrl, index) => {
            const pageFileName = `${displayName} - Page ${index + 1}`;
            const imageFile = this.pdfConverterService.dataUrlToFile(imageDataUrl, `${displayName}_page${index + 1}.png`);
            
            // Add to processing queue with custom display name
            this.filesToProcess.push({
              file: imageFile,
              displayName: pageFileName
            });
            
            // Update total files count
            const currentState = this.stateService.getCurrentState();
            this.stateService.updateState({
              filesInProgress: currentState.filesInProgress + 1
            });
          });
          
          // Don't add the PDF filename as a result and don't increment count (PDFs aren't counted)
          this.processNextFile();
        } else {
          throw new Error(this.translate.instant('image.error.pdfNoPages'));
        }
      } else if (file.type.startsWith('image/')) {
        // Process regular images (including PDF pages)
        // Prepare fallback models (all models except the selected one)
        const fallbackModels = this.visionModels
          .map(m => m.value)
          .filter(m => m !== this.selectedVisionModel);

        this.imageProcessorService.analyzeImage(file, this.selectedVisionModel, displayName, isPdfPage, fallbackModels).subscribe({
          next: (result: VisionAnalysisResult) => {
            // Check for specific error types and translate them
            let errorMessage = result.error;
            if (errorMessage === 'KEY_LIMIT_EXCEEDED') {
              errorMessage = this.translate.instant('image.error.paidModel');
            }
            
            this.stateService.updateResult(displayName, {
              status: result.error ? 'error' : 'completed',
              data: {
                imageBase64: result.imageBase64 || null,
                english: result.english,
                french: result.french,
                error: errorMessage
              }
            });
            
            this.stateService.incrementProcessedCount();
            this.processNextFile();
          },
          error: (err: Error) => {
            console.error(`Error analyzing image ${displayName}:`, err);
            
            // Check for specific error types
            let errorMessage = err.message || this.translate.instant('image.error.unknown');
            if (err.message === 'KEY_LIMIT_EXCEEDED' || (err.message && err.message.includes('KEY_LIMIT_EXCEEDED'))) {
              errorMessage = this.translate.instant('image.error.paidModel');
            }
            
            this.stateService.updateResult(displayName, {
              status: 'error',
              data: {
                imageBase64: null,
                english: null,
                french: null,
                error: errorMessage
              }
            });
            
            this.stateService.incrementProcessedCount();
            this.processNextFile();
          }
        });
      } else {
        // Handle unsupported files
        this.stateService.updateResult(displayName, {
          status: 'error',
          data: {
            imageBase64: null,
            english: null,
            french: null,
            error: this.translate.instant('image.error.unsupportedFileType')
          }
        });
        this.stateService.incrementProcessedCount();
        this.processNextFile();
      }
    } catch (error: unknown) {
      console.error(`Error processing file ${displayName}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : this.translate.instant('image.error.failedToProcess');
      
      // Only update result if it's not a PDF (PDFs don't have result entries)
      if (file.type !== 'application/pdf') {
        this.stateService.updateResult(displayName, {
          status: 'error',
          data: {
            imageBase64: null,
            english: null,
            french: null,
            error: errorMessage
          }
        });
        this.stateService.incrementProcessedCount();
      }
      this.processNextFile();
    }
  }

  private finalizeProcessing(): void {
    const state = this.stateService.getCurrentState();
    this.stateService.updateState({
      progressText: this.translate.instant('image.progress.complete', { count: state.processedCount })
    });
    
    // Calculate and show processing time
    console.timeEnd("Image processing time");
    const endTime = performance.now();
    const durationInSeconds = ((endTime - this.processingStartTime) / 1000).toFixed(2);
    
    // Show toast with processing time
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('common.requestComplete'),
      detail: this.translate.instant('common.totalTime', { time: durationInSeconds }),
      life: 10000
    });
    
    setTimeout(() => {
      this.stateService.updateState({ showProgressArea: false });
    }, 3000);
  }

  // Helper method for template to convert object to array
  getResultsArray(results: Record<string, FileProcessingResult>): FileProcessingResult[] {
    return Object.values(results);
  }
  
  // Reset the tool to process new images
  resetTool(): void {
    this.stateService.resetState();
    this.filesToProcess = [];
    // Clear any remaining progress text
    this.stateService.updateState({
      showProgressArea: false,
      progressText: ''
    });
  }
}