import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { MetadataResult } from './metadata-assistant.service';

export interface MetadataProcessingState {
  isProcessing: boolean;
  currentUrl: string;
  currentStep: 'idle' | 'scraping' | 'generating' | 'translating' | 'processing-document' | 'evaluating' | 'complete';
  progress: number;
  totalUrls: number;
  processedUrls: number;
  results: MetadataResult[];
  error: string | null;
  selectedModel: string;
  translateToFrench: boolean;
  documentProcessingIndex: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class MetadataAssistantStateService {
  private readonly initialState: MetadataProcessingState = {
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

  private stateSubject = new BehaviorSubject<MetadataProcessingState>(this.initialState);
  public state$: Observable<MetadataProcessingState> = this.stateSubject.asObservable();

  getState(): MetadataProcessingState {
    return this.stateSubject.value;
  }

  updateState(updates: Partial<MetadataProcessingState>): void {
    const currentState = this.getState();
    this.stateSubject.next({ ...currentState, ...updates });
  }

  startProcessing(urls: string[], model: string, translateToFrench: boolean): void {
    this.updateState({
      isProcessing: true,
      currentStep: 'scraping',
      progress: 0,
      totalUrls: urls.length,
      processedUrls: 0,
      results: [],
      error: null,
      selectedModel: model,
      translateToFrench: translateToFrench
    });
  }

  updateProgress(currentUrl: string, step: 'scraping' | 'generating' | 'translating'): void {
    const state = this.getState();
    const stepProgress = step === 'scraping' ? 0.3 : step === 'generating' ? 0.6 : 0.9;
    const urlProgress = state.processedUrls / Math.max(state.totalUrls, 1);
    const currentUrlProgress = stepProgress / Math.max(state.totalUrls, 1);
    
    this.updateState({
      currentUrl,
      currentStep: step,
      progress: Math.min((urlProgress + currentUrlProgress) * 100, 100)
    });
  }

  addResult(result: MetadataResult): void {
    const state = this.getState();
    this.updateState({
      results: [...state.results, result],
      processedUrls: state.processedUrls + 1,
      progress: ((state.processedUrls + 1) / Math.max(state.totalUrls, 1)) * 100
    });
  }

  completeProcessing(): void {
    this.updateState({
      isProcessing: false,
      currentStep: 'complete',
      progress: 100,
      currentUrl: ''
    });
  }

  setError(error: string): void {
    this.updateState({
      isProcessing: false,
      currentStep: 'idle',
      error
    });
  }

  reset(): void {
    this.stateSubject.next(this.initialState);
  }

  setSelectedModel(model: string): void {
    this.updateState({ selectedModel: model });
  }

  setTranslateToFrench(translate: boolean): void {
    this.updateState({ translateToFrench: translate });
  }

  clearResults(): void {
    this.updateState({
      results: [],
      progress: 0,
      processedUrls: 0,
      totalUrls: 0,
      currentStep: 'idle',
      error: null
    });
  }

  // Document processing methods
  updateResultWithDocumentMetadata(index: number, documentMetadata: { description: string, keywords: string }): void {
    const state = this.getState();
    const updatedResults = [...state.results];
    if (updatedResults[index]) {
      updatedResults[index] = {
        ...updatedResults[index],
        documentMetadata
      };
      this.updateState({ results: updatedResults });
    }
  }

  updateResultWithEvaluation(index: number, evaluationResult: { suggestedDescription: string, suggestedKeywords: string, rationale: string }): void {
    const state = this.getState();
    const updatedResults = [...state.results];
    if (updatedResults[index]) {
      updatedResults[index] = {
        ...updatedResults[index],
        evaluationResult
      };
      this.updateState({
        results: updatedResults,
        documentProcessingIndex: null,
        currentStep: 'complete'
      });
    }
  }

  setDocumentProcessingIndex(index: number | null): void {
    this.updateState({ documentProcessingIndex: index });
  }
}