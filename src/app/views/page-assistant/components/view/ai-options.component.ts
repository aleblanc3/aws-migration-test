import { Component, ViewChild, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { DrawerModule, Drawer } from 'primeng/drawer';

import { RadioButtonModule } from 'primeng/radiobutton';

import { AccordionModule } from 'primeng/accordion';

import { TranslateModule } from "@ngx-translate/core";

//Services
import { OpenRouterService, OpenRouterMessage } from '../../components/openrouter.service';
import { UploadData } from '../../../../common/data.types'
import { LocalStorageService } from '../../../../services/local-storage.service'; //Delete if you aren't using anything from local storage

@Component({
  selector: 'ca-ai-options',
  imports: [TranslateModule, CommonModule, FormsModule, ButtonModule, DrawerModule, RadioButtonModule, AccordionModule],
  templateUrl: './ai-options.component.html',
  styles: `
  ::ng-deep .custom-drawer2 {
  height: auto !important;
  min-height: 10vh;
  max-height: calc(80vh - 4rem); /* adjust based on header height */
  top: 0rem !important; /* offset to start below header */
  background-color: var(--surface-ground);
  border: 4px solid var(--primary-color, #007ad9); /* Use your theme color or fallback */
  border-top-left-radius: 2rem;
  border-bottom-left-radius: 2rem;
}`,
})
export class AiOptionsComponent {

  @Input() uploadData: UploadData | null = null;

  constructor(public localStore: LocalStorageService, private openRouterService: OpenRouterService) { }

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

  //Selected task
  selectedTask: any = 1;

  //Step 3 checkboxes for AI prompt
  selectedPrompts: any[] = [];

  prompts: any[] = [
    { name: 'Suggest an SEOed title', key: 'promptSEOTitle', unavailable: 'false' },
    { name: 'Suggest a metadata description', key: 'promptMetaDesc', unavailable: 'false' },
    { name: '...', key: 'promptEtc', unavailable: 'true' },
    { name: 'Propose a better heading structure', key: 'promptHeadingStructure', unavailable: 'false' }
  ];

  //Step 3 radio buttons or checkboxes for AI model
  selectedAI: any = null;

  selectedAIs: any[] = [];

  ais: any[] = [
    { name: 'Gemini 2.0 Flash', key: 'aiGenini', unavailable: 'false' },
    { name: 'Llama 3.3 70B', key: 'aiLlama', unavailable: 'false' },
    { name: 'Phi-3 Medium', key: 'aiPhi', unavailable: 'true' },
    { name: 'Mistral Nemo', key: 'aiMistral', unavailable: 'false' },
    { name: 'Dolphin3.0 R1', key: 'aiDolphin', unavailable: 'false' }
  ];

  isSelected(option: any): boolean {
    return this.selectedAIs.includes(option);
  }

  toggleSelection(option: any): void {
    const index = this.selectedAIs.indexOf(option);
    if (index > -1) {
      // Deselect
      this.selectedAIs.splice(index, 1);
    } else if (this.selectedAIs.length < 2) {
      // Add only if under the limit
      this.selectedAIs.push(option);
    }
  }

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
}
