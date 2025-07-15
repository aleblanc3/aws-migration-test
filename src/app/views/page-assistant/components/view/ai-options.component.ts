import { Component, ViewChild, Input, Output, EventEmitter} from '@angular/core';
import { CommonModule} from '@angular/common';

import { ButtonModule } from 'primeng/button';
import { DrawerModule, Drawer } from 'primeng/drawer';


@Component({
  selector: 'ca-ai-options',
  imports: [CommonModule, ButtonModule, DrawerModule ],
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

  //test 3
 @ViewChild('drawerRef') drawerRef!: Drawer;

    closeDrawer(e: any): void {
        this.drawerRef.close(e);
    }

    visible: boolean = false;
//END TEST

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
