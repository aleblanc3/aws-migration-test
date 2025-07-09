import { Component } from '@angular/core';

@Component({
  selector: 'ca-ai-options',
  imports: [],
  templateUrl: './ai-options.component.html',
  styles: ``
})
export class AiOptionsComponent {

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
  
}
