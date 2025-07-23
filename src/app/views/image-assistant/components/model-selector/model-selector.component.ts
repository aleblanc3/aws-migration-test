import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DropdownModule } from 'primeng/dropdown';

interface VisionModel {
  name: string;
  value: string;
}

@Component({
  selector: 'ca-model-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, DropdownModule],
  templateUrl: './model-selector.component.html',
  styles: [`
    .model-selector-container {
      margin-bottom: 1.5rem;
      margin-top: 1.5rem;
    }
    
    :host ::ng-deep .p-dropdown {
      min-width: 300px;
    }
    
    label {
      font-weight: bold;
      margin-right: 0.5rem;
    }
  `]
})
export class ModelSelectorComponent implements OnInit {
  @Input() selectedModel = 'qwen/qwen2.5-vl-32b-instruct:free';
  @Output() modelChange = new EventEmitter<string>();
  
  visionModels: VisionModel[] = [];

  constructor(private translate: TranslateService) {}

  ngOnInit(): void {
    this.visionModels = [
      { name: this.translate.instant('image.model.qwen'), value: 'qwen/qwen2.5-vl-32b-instruct:free' },
      { name: this.translate.instant('image.model.gemma'), value: 'google/gemma-3-27b-it:free' }
    ];
  }

  onModelChange(event: any): void {
    this.modelChange.emit(event.value);
  }
}