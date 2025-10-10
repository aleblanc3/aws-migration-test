import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DropdownModule } from 'primeng/dropdown';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { Subject, takeUntil } from 'rxjs';

export interface ModelOption {
  name: string;
  value: string;
  description?: string;
}

@Component({
  selector: 'ca-shared-model-selector',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    TranslateModule, 
    DropdownModule,
    CardModule,
    CheckboxModule
  ],
  templateUrl: './model-selector.component.html',
  styleUrls: ['./model-selector.component.css']
})
export class SharedModelSelectorComponent implements OnInit, OnDestroy {
  @Input() selectedModel = '';
  @Input() models: ModelOption[] = [];
  @Input() label = 'common.modelSelector.label';
  @Input() showCard = true;
  @Input() cardTitle = 'common.modelSelector.title';
  @Input() disabled = false;

  // For metadata assistant translation option
  @Input() showTranslateOption = false;
  @Input() translateToFrench = false;
  @Output() translateChange = new EventEmitter<boolean>();

  @Output() modelChange = new EventEmitter<string>();

  localModels: ModelOption[] = [];
  private destroy$ = new Subject<void>();

  constructor(private translate: TranslateService) {}

  ngOnInit(): void {
    // Initialize models with translations
    this.initializeModels();

    // Re-initialize when language changes
    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.initializeModels();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  private initializeModels(): void {
    // If models are provided as input, translate their names
    if (this.models && this.models.length > 0) {
      this.localModels = this.models.map(model => ({
        ...model,
        name: this.translate.instant(model.name)
      }));
    }
  }

  onModelChange(event: any): void {
    const value = event.value || event;
    this.selectedModel = value;
    this.modelChange.emit(value);
  }

  onTranslateChange(value: boolean): void {
    this.translateToFrench = value;
    this.translateChange.emit(value);
  }

  getModelDescription(): string {
    const selected = this.localModels.find(m => m.value === this.selectedModel);
    return selected?.description ? this.translate.instant(selected.description) : '';
  }
}