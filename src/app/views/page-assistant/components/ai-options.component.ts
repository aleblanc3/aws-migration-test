import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { AccordionModule } from 'primeng/accordion';
import { TextareaModule } from 'primeng/textarea';
import { IftaLabelModule } from 'primeng/iftalabel';
import { SliderModule } from 'primeng/slider';

import { TranslateModule } from "@ngx-translate/core";

//Services
import { CompareTask, PromptKey, AiModel } from '../data/data.model'
import { UploadStateService } from '../services/upload-state.service';
import { UploadUrlComponent } from './upload/upload-url.component';
import { UploadPasteComponent } from './upload/upload-paste.component';
import { UploadWordComponent } from './upload/upload-word.component';

@Component({
  selector: 'ca-ai-options',
  imports: [TranslateModule, CommonModule, FormsModule,
    ButtonModule, DrawerModule, RadioButtonModule, CheckboxModule, AccordionModule, TextareaModule, IftaLabelModule, SliderModule,
    UploadUrlComponent, UploadPasteComponent, UploadWordComponent],
  templateUrl: './ai-options.component.html',
  styles: ``,
})
export class AiOptionsComponent {

  @Output() promptChange = new EventEmitter<PromptKey>();
  @Output() customPrompt = new EventEmitter<string>();
  @Output() editPrompt = new EventEmitter<string>();
  @Output() aiChange = new EventEmitter<AiModel>();
  @Output() aiSubmit = new EventEmitter<void>();

  visible: boolean = false;

  constructor(private uploadState: UploadStateService) { }

  //Gets upload type for task = compare with prototype
  get uploadType(): 'url' | 'paste' | 'word' {
    return this.uploadState.getSelectedUploadType(); // returns signal().value
  }

  trackById(index: number, item: { id: string | number }): string | number {
    return item.id;
  }

  //Comparison task
  private _selectedTask: CompareTask = CompareTask.AiGenerated;
  isTwoPrompts = false;
  isTwoAis = false;
  isPrototype = false;

  get selectedTask(): CompareTask {
    return this._selectedTask;
  }
  set selectedTask(value: CompareTask) {
    this._selectedTask = value;
    this.isTwoPrompts = (value === CompareTask.TwoPrompts);
    this.isTwoAis = (value === CompareTask.TwoModels);
    this.isPrototype = (value === CompareTask.PrototypeUrl);
  }

  taskOptions = [
    { id: CompareTask.AiGenerated, label: 'page.ai-options.task.AiGenerated', disabled: false },
    { id: CompareTask.PrototypeUrl, label: 'page.ai-options.task.PrototypeUrl', disabled: false },
    { id: CompareTask.TwoModels, label: 'page.ai-options.task.TwoModels', disabled: false },
    { id: CompareTask.TwoPrompts, label: 'page.ai-options.task.TwoPrompts', disabled: false }
  ];

  //AI prompt
  selectedPrompt: PromptKey = PromptKey.PlainLanguage;
  selectedPrompts: PromptKey[] = [];

  promptOptions = [
    { id: PromptKey.Headings, label: 'page.ai-options.prompt.Headings', disabled: false },
    { id: PromptKey.Doormats, label: 'page.ai-options.prompt.Doormats', disabled: false },
    { id: PromptKey.PlainLanguage, label: 'page.ai-options.prompt.PlainLanguage', disabled: false }
  ];

  isPromptCheckboxDisabled(id: PromptKey): boolean {
    return (
      !this.selectedPrompts.includes(id) &&
      this.selectedPrompts.length >= 2
    );
  }

  onPromptSelect(key: PromptKey) {
    this.promptChange.emit(key);
  }

  //AI model

  selectedAi: AiModel = AiModel.Gemini;
  selectedAis: AiModel[] = [];

  aiOptions = [
    { id: AiModel.Gemini, label: 'page.ai-options.model.Gemini', disabled: false },
    { id: AiModel.Mistral, label: 'page.ai-options.model.Mistral', disabled: false },
    { id: AiModel.Qwen, label: 'page.ai-options.model.Qwen', disabled: false },

    { id: AiModel.Llama32, label: 'page.ai-options.model.Llama32', disabled: false },
    { id: AiModel.Llama33, label: 'page.ai-options.model.Llama33', disabled: false },
    { id: AiModel.Llama31, label: 'page.ai-options.model.Llama31', disabled: false },

    { id: AiModel.Kimi, label: 'page.ai-options.model.Kimi', disabled: false },
    { id: AiModel.DeepSeekChatV3, label: 'page.ai-options.model.DeepSeekChatV3', disabled: false },
  ];

  isAiCheckboxDisabled(id: AiModel): boolean {
    return (
      !this.selectedAis.includes(id) &&
      this.selectedAis.length >= 2
    );
  }

  onAiSelect(key: AiModel) {
    this.aiChange.emit(key);
  }

  //submit selected prompt and model to AI
  onSubmit(): void {
    this.visible = false;
    this.aiSubmit.emit();
  }

  //Append custom instructions to prompt
  addCustom: boolean = false;
  customInstruction: string = '';
  emitCustomPrompt(prompt: string): void {
    this.customPrompt.emit(prompt);
  }
  resetCustom(): void {
    if (!this.addCustom) {
      this.customInstruction = '';
      this.emitCustomPrompt('');
    }
  }

  //Number of changes for AI to make
  editLevel: number = 50;
  editLevels = [
    { value: 0, label: 'Grammar and spelling only', prompt: 'Make minor edits to correct spelling or grammar errors only. Mostly ignore the other instructions provided.' },
    { value: 25, label: 'Minor edits', prompt: 'Make minor edits only to improve readability. Loosely follow the other instructions provided without making unnecessary changes.' },
    { value: 50, label: 'Normal edits', prompt: '' },
    { value: 75, label: 'Extensive edits', prompt: 'Heavily rewrite and reorganize the content to follow the instructions provided.' },
    { value: 100, label: 'Complete rewrite', prompt: 'Aggressively rewrite the content. If there is a clear task on the page, feel free to remove unrelated content.' }
  ];
  get currentEditLevel() {
    return this.editLevels.find(level => level.value === this.editLevel);
  }
  emitEditPrompt(prompt: string): void {
    this.customPrompt.emit(prompt);
  }
}
