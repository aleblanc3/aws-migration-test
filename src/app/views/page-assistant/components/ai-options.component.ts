import { Component, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DrawerModule, Drawer } from 'primeng/drawer';
import { RadioButtonModule } from 'primeng/radiobutton';
import { CheckboxModule } from 'primeng/checkbox';
import { AccordionModule } from 'primeng/accordion';

import { TranslateModule } from "@ngx-translate/core";

//Services
import { OpenRouterService, OpenRouterMessage } from '../services/openrouter.service';
import { UploadData, ModifiedData, CompareTask, PromptKey, AiModel } from '../../../common/data.types'
import { LocalStorageService } from '../../../services/local-storage.service'; //Delete if you aren't using anything from local storage
import { UrlDataService } from '../services/url-data.service';
import { UploadStateService } from '../services/upload-state.service';
import { UploadUrlComponent } from './upload/upload-url.component';
import { UploadPasteComponent } from './upload/upload-paste.component';
import { UploadWordComponent } from './upload/upload-word.component';

@Component({
  selector: 'ca-ai-options',
  imports: [TranslateModule, CommonModule, FormsModule, ButtonModule, DrawerModule, RadioButtonModule, CheckboxModule, AccordionModule, UploadUrlComponent, UploadPasteComponent, UploadWordComponent],
  templateUrl: './ai-options.component.html',
  styles: ``,
})
export class AiOptionsComponent {



  @Input() uploadData: UploadData | null = null;
  public handleUpload(modified: ModifiedData): void {
    this.uploadData = {
      originalUrl: this.uploadData?.originalUrl ?? '',         // retain originalUrl and originalHtml
      originalHtml: this.uploadData?.originalHtml ?? '',
      ...modified                   // update modifiedUrl and modifiedHtml
    };
    console.log(this.uploadData);
  }

  constructor(public localStore: LocalStorageService, private openRouterService: OpenRouterService, private urlDataService: UrlDataService, private uploadState: UploadStateService) { }

  get uploadType(): 'url' | 'paste' | 'word' {
    return this.uploadState.getSelectedUploadType(); // returns signal().value
  }

  ngOnChanges(): void {
    if (this.uploadData) {
      // use this.uploadData.originalHtml, etc. for my AI call
    }
  }

  //test 3
  @ViewChild('drawerRef') drawerRef!: Drawer;

  closeDrawer(e: any): void {
    this.drawerRef.close(e);
  }

  visible: boolean = false;
  //END TEST


  //isSelected(option: any): boolean {
  //   return this.selectedAIs.includes(option);
  // }

  //toggleSelection(option: any): void {
  //   const index = this.selectedAIs.indexOf(option);
  //   if (index > -1) {
  // Deselect
  //     this.selectedAIs.splice(index, 1);
  //   } else if (this.selectedAIs.length < 2) {
  // Add only if under the limit
  //    this.selectedAIs.push(option);
  //   }
  // }

  // trackById(index: number, item: { id: string }) {
  //   return item.id;
  // }

  aiResponse: string = '';
  isLoading = false;

  sendToAI(): void {
    const html = this.uploadData?.originalHtml;
    const prompt = "You are an expert web content writer with 10 years of experience in the public service. Your primary function is to help web publishers rewrite technical content to be easy to understand for the general public. Please review the included HTML code and update only the words. Return only the updated HTML code with no explanations. "

    if (!html) return;
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: html }
    ];

    this.isLoading = true;
    setTimeout(() => {
      this.openRouterService.sendChat('deepseek/deepseek-chat-v3-0324:free', messages).subscribe({
        next: (response) => {
          this.aiResponse = response;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error getting AI response:', err);
          this.aiResponse = 'An error occurred while contacting the AI.';
          this.isLoading = false;
        }
      });
    }, 1000); // 1 second delay
  }

  get modifiedHtml(): string {
    return this.aiResponse || this.uploadData?.modifiedHtml || '';
  }

  //NEW RADIO BUTTON CODE

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
    { id: PromptKey.PlainLanguage, label: 'page.ai-options.prompt.PlainLanguage', disabled: false },
    { id: PromptKey.Banana, label: 'page.ai-options.prompt.Banana', disabled: false }
  ];

  isPromptCheckboxDisabled(id: PromptKey): boolean {
    return (
      !this.selectedPrompts.includes(id) &&
      this.selectedPrompts.length >= 2
    );
  }
  //AI model

  selectedAi: AiModel = AiModel.DeepSeek;
  selectedAis: AiModel[] = [];


  aiOptions = [
    { id: AiModel.DeepHermes, label: 'page.ai-options.ai.DeepHermes', disabled: false },
    { id: AiModel.DeepSeek, label: 'page.ai-options.ai.DeepSeek', disabled: false },
    { id: AiModel.DeepSeekChatV3, label: 'page.ai-options.ai.DeepSeekChatV3', disabled: false },
    { id: AiModel.DeepSeekR1, label: 'page.ai-options.ai.DeepSeekR1', disabled: false },
    { id: AiModel.DeepSeekR1May, label: 'page.ai-options.ai.DeepSeekR1May', disabled: false },
    { id: AiModel.DeepSeekR1T, label: 'page.ai-options.ai.DeepSeekR1T', disabled: false },
    { id: AiModel.DeepSeekR1T2, label: 'page.ai-options.ai.DeepSeekR1T2', disabled: false },
    { id: AiModel.DeepSeekV3, label: 'page.ai-options.ai.DeepSeekV3', disabled: false },
    { id: AiModel.Gemini, label: 'page.ai-options.ai.Gemini', disabled: false },
    { id: AiModel.GeminiPro, label: 'page.ai-options.ai.GeminiPro', disabled: false },
    { id: AiModel.KimiDev, label: 'page.ai-options.ai.KimiDev', disabled: false },
    { id: AiModel.KimiVL, label: 'page.ai-options.ai.KimiVL', disabled: false },
    { id: AiModel.Llama11B, label: 'page.ai-options.ai.Llama11B', disabled: false },
    { id: AiModel.Llama353B, label: 'page.ai-options.ai.Llama353B', disabled: false },
    { id: AiModel.Llama3B, label: 'page.ai-options.ai.Llama3B', disabled: false },
    { id: AiModel.Mai, label: 'page.ai-options.ai.Mai', disabled: false },
    { id: AiModel.MistralNemo, label: 'page.ai-options.ai.MistralNemo', disabled: false },
    { id: AiModel.MistralSmall, label: 'page.ai-options.ai.MistralSmall', disabled: false },
    { id: AiModel.Qwen, label: 'page.ai-options.ai.Qwen', disabled: false },
  ];

  isAiCheckboxDisabled(id: AiModel): boolean {
    return (
      !this.selectedAis.includes(id) &&
      this.selectedAis.length >= 2
    );
  }



  //FROM UPLOAD URL COMPONENT - REFACTOR COMPONENT FOR BOTH USE CASES

  //Export data to parent component
  //@Output() uploadData = new EventEmitter<UploadData>();

  //Initialize stuff
  userInput: string = '';
  error: string = '';
  loading = false;

  async getHtmlContent() {
    this.loading = true;
    this.error = '';

    try {
      const mainHTML = await this.urlDataService.fetchAndProcess(this.userInput);
      console.log(mainHTML);
      //Emit original data & set modified to same (no changes)
      //this.uploadData.emit({
      //  originalUrl: this.userInput,
      //  originalHtml: mainHTML,
      //  modifiedUrl: this.userInput,
      //  modifiedHtml: mainHTML
      // });

    } catch (err: any) {
      this.error = `Failed to fetch page: ${err.message || err || 'Unknown error'}`;
    } finally {
      this.loading = false;
    }
  }

  //END OF CONTENT FROM URL COMPONENT

}
