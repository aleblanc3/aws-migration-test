import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DropdownModule } from 'primeng/dropdown';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';

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
export class SharedModelSelectorComponent implements OnInit {
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

  constructor(private translate: TranslateService) {}

  ngOnInit(): void {
    // Initialize models with translations
    this.initializeModels();
    
    // Re-initialize when language changes
    this.translate.onLangChange.subscribe(() => {
      this.initializeModels();
    });
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