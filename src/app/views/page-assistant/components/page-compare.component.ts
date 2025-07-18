/*TO-DO
1. Load 2 version of an HTML page 
2. Fix ajax & json content
3. Generate diffs in 2 formats 
    text based diff using diff and diff2html (side-by-side code)
    visual diff using @ali-tas/htmldiff-js (diffs wrapped in <ins> and <del> tags)
4. Inject visual diff into shadow dom diff-viewer (or iframe if we can handle the extra resources)
5. Enhance rendered diff by styling inserted & deleted content, wrapping new/changed links. handling media queries, modal content, ajax-loaded sections, json-managed data
6. Add navigation between diff elements (next() & prev())
7. Store and restore UI state using sessionStorage?
Notes: 
Add radio buttons to change display from original, modified, & differences
Add dropdown to select from an array of modified versions (so you can step it back if needed after a bad iteration)
*/

import {
  Component, Input, ViewChild, ViewEncapsulation, AfterViewInit, OnDestroy, OnChanges, SimpleChanges, //decorators & lifecycle
  ElementRef, Renderer2, //DOM utilities
  inject, //Dependency injection
  signal, WritableSignal, Signal, computed, effect //Signals/reactivity
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

//PrimeNG
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
//import { PanelModule } from 'primeng/panel';
import { TabsModule } from 'primeng/tabs';
//import { MessageModule } from 'primeng/message';
//import { DividerModule } from 'primeng/divider';
import { RadioButtonModule } from 'primeng/radiobutton';

//Diffs
import {
  Diff2HtmlUIConfig,
  Diff2HtmlUI,
} from 'diff2html/lib/ui/js/diff2html-ui';
import { createPatch } from 'diff';
import { Diff } from '@ali-tas/htmldiff-js';

import { UploadData, DiffOptions } from '../../../common/data.types'

//Services
import { OpenRouterService, OpenRouterMessage } from './openrouter.service';
import { AiOptionsComponent } from './view/ai-options.component';




export interface ViewOption {
  label: string;
  value: 'original' | 'modified' | 'diff';
  icon: string;
}

@Component({
  selector: 'ca-page-compare',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, CardModule, TabsModule, RadioButtonModule,
    AiOptionsComponent
  ],
  templateUrl: './page-compare.component.html',
  styleUrl: './page-compare.component.scss'
})
export class PageCompareComponent implements AfterViewInit, OnDestroy, OnChanges {

  constructor(private openRouterService: OpenRouterService) { }

  //Accept input from parent component
  @Input() uploadData: UploadData = {
    originalHtml: '',
    modifiedHtml: '',
    originalUrl: '',
    modifiedUrl: ''
  };

  //On changes
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['modifiedHtml'] && !changes['modifiedHtml'].isFirstChange()) {
      console.log('AI response updated!');
      this.compareHtml();
    }
  }

  //View children
  @ViewChild('liveContainer', { static: false }) liveContainer!: ElementRef;
  @ViewChild('sourceContainer', { static: false }) sourceContainer!: ElementRef;

  //signals
  shadowDOM = signal<ShadowRoot | null>(null);

  legendItems = signal<
    { text: string; colour: string; style: string; lineStyle?: string }[]
  >([
    { text: 'Previous version', colour: '#F3A59D', style: 'highlight' },
    { text: 'Updated version', colour: '#83d5a8', style: 'highlight' },
    { text: 'Updated link', colour: '#FFEE8C', style: 'highlight' },
    { text: 'Hidden content', colour: '#6F9FFF', style: 'line' },
    {
      text: 'Modal content',
      colour: '#666',
      style: 'line',
      lineStyle: 'dashed',
    },
    {
      text: 'Dynamic content',
      colour: '#fbc02f',
      style: 'line',
      lineStyle: 'dashed',
    },
  ]);

  //View options
  selectedView: 'original' | 'modified' | 'diff' = 'diff';

  viewOptions: ViewOption[] = [
    { label: 'Original', value: 'original', icon: 'pi pi-file' },
    { label: 'Modified', value: 'modified', icon: 'pi pi-file-edit' },
    { label: 'Diff', value: 'diff', icon: 'pi pi-sort-alt' }
  ];

  //Variables
  showResults = false;
  //textDiffResult = '';
  //originalStructure = '';
  //modifiedStructure = '';

  private shadowRoot?: ShadowRoot;

  ngAfterViewInit() {
    // Initialize shadow DOM when the view is ready
    if (this.liveContainer) {
      this.initializeShadowDOM();
    }
  }

  ngOnDestroy() {
    // Clean up shadow DOM if needed
    this.shadowRoot = undefined;
  }

  private initializeShadowDOM() {
    if (this.liveContainer && !this.shadowRoot) {
      this.shadowRoot = this.liveContainer.nativeElement.attachShadow({ mode: 'open' });
    }
  }

  compareHtml() {
    if (!this.uploadData?.originalHtml.trim() || !this.uploadData?.modifiedHtml.trim()) {
      return;
    }

    this.showResults = true;

    // Generate web & code views
    this.generateShadowDOMDiff();
    this.generateDiff2HtmlDiff();
  }

  // View switcher method
  onViewChange(viewType: 'original' | 'modified' | 'diff') {
    this.selectedView = viewType;
    this.generateShadowDOMContent();
  }

  // Enhanced method to handle different view types
  private generateShadowDOMContent() {
    if (!this.shadowRoot) {
      this.initializeShadowDOM();
    }

    if (!this.shadowRoot) {
      console.error('Shadow DOM failed to initialize');
      return;
    }

    // Clear previous content
    this.shadowRoot.innerHTML = '';

    // Add base styles
    const style = document.createElement('style');
    style.textContent = this.getRenderedDiffStyles();
    this.shadowRoot.insertBefore(style, this.shadowRoot.firstChild);

    // Create container
    const diffContainer = document.createElement('div');
    diffContainer.className = 'rendered-diff-container';

    const renderedContent = document.createElement('div');
    renderedContent.className = 'rendered-content';

    switch (this.selectedView) {
      case 'original':
        this.renderOriginalHtml(renderedContent);
        break;
      case 'modified':
        this.renderModifiedHtml(renderedContent);
        break;
      case 'diff':
        this.renderDiffHtml(renderedContent);
        break;
    }

    diffContainer.appendChild(renderedContent);
    this.shadowRoot.appendChild(diffContainer);
  }

  private renderOriginalHtml(container: HTMLElement) {
    const parser = new DOMParser();
    const originalDoc = parser.parseFromString(this.uploadData?.originalHtml, 'text/html');

    container.className = 'rendered-content original-content';
    container.innerHTML = originalDoc.body ? originalDoc.body.innerHTML : this.uploadData?.originalHtml;
  }

  private renderModifiedHtml(container: HTMLElement) {
    const parser = new DOMParser();
    const modifiedDoc = parser.parseFromString(this.uploadData?.modifiedHtml, 'text/html');

    container.className = 'rendered-content modified-content';
    container.innerHTML = modifiedDoc.body ? modifiedDoc.body.innerHTML : this.uploadData?.modifiedHtml;
  }

  private renderDiffHtml(container: HTMLElement) {
    const parser = new DOMParser();

    // Use htmldiff-js to get the diff with HTML highlighting
    const options: DiffOptions = {
      repeatingWordsAccuracy: 0,
      ignoreWhiteSpaceDifferences: true,
      orphanMatchThreshold: 0,
      matchGranularity: 4,
      combineWords: true,
    };

    const diffResult = Diff.execute(
      this.uploadData?.originalHtml,
      this.uploadData?.modifiedHtml,
      options,
    ).replace(
      /<(ins|del)[^>]*>(\s|&nbsp;|&#32;|&#160;|&#x00e2;|&#x0080;|&#x00af;|&#x202f;|&#xa0;)+<\/(ins|del)>/gis,
      ' ',
    );

    // Parse the diff result and render it
    const diffDoc = parser.parseFromString(diffResult, 'text/html');

    container.className = 'rendered-content diff-content';
    container.innerHTML = diffDoc.body ? diffDoc.body.innerHTML : diffResult;
  }

  //Web view <--old
  private generateShadowDOMDiff() {
    if (!this.shadowRoot) {
      this.initializeShadowDOM();
    }

    if (!this.shadowRoot) {
      console.error('Shadow DOM failed to initialize');
      return;
    }

    // Parse HTML using DOMParser
    const parser = new DOMParser();
    const originalDoc = parser.parseFromString(this.uploadData?.originalHtml, 'text/html');
    const modifiedDoc = parser.parseFromString(this.uploadData?.modifiedHtml, 'text/html');

    // Create diff container to render the HTML
    const diffContainer = document.createElement('div');
    diffContainer.className = 'rendered-diff-container';

    // Create the rendered content container
    const renderedContent = document.createElement('div');
    renderedContent.className = 'rendered-content';

    // Use htmldiff-js to get the diff with HTML highlighting
    const options: DiffOptions = {
      repeatingWordsAccuracy: 0,
      ignoreWhiteSpaceDifferences: true,
      orphanMatchThreshold: 0,
      matchGranularity: 4,
      combineWords: true,
    };
    const diffResult = Diff.execute(
      this.uploadData?.originalHtml,
      this.uploadData?.modifiedHtml,
      options,
    ).replace(
      /<(ins|del)[^>]*>(\s|&nbsp;|&#32;|&#160;|&#x00e2;|&#x0080;|&#x00af;|&#x202f;|&#xa0;)+<\/(ins|del)>/gis,
      ' ',
    );

    // Parse the diff result and render it
    const diffDoc = parser.parseFromString(diffResult, 'text/html');

    // Clone the body content from the diff result
    if (diffDoc.body) {
      renderedContent.innerHTML = diffDoc.body.innerHTML;
    } else {
      renderedContent.innerHTML = diffResult;
    }

    diffContainer.appendChild(renderedContent);

    // Clear previous content and add new diff
    this.shadowRoot.innerHTML = '';
    this.shadowRoot.appendChild(diffContainer);

    // Add enhanced styles for rendered content
    const style = document.createElement('style');
    style.textContent = this.getRenderedDiffStyles();
    this.shadowRoot.insertBefore(style, this.shadowRoot.firstChild);
  }



  private getRenderedDiffStyles(): string {
    return `
      /* Import canada.ca CSS */
        @import url('https://use.fontawesome.com/releases/v5.15.4/css/all.css');
        @import url('https://www.canada.ca/etc/designs/canada/wet-boew/css/theme.min.css');
        @import url('https://www.canada.ca/etc/designs/canada/wet-boew/méli-mélo/2024-09-kejimkujik.min.css');

    /* Shadow DOM container and layout fixes */
      :host {
        all: initial;
        display: block;
        width: 100%;
        box-sizing: border-box;
      }

      html, body {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        max-width: 100%;
        overflow-x: hidden;
        font-family: sans-serif;
      }

      .rendered-content {
        background-color: #ffffff !important; 
        width: 100%;
        max-width: 100%;
        overflow-wrap: break-word;
        box-sizing: border-box;
      }

      table {
        width: 100%;
        table-layout: auto;
      }

      td, th, pre {
        word-break: break-word;
      }

      pre {
        white-space: pre-wrap;
      }
      
      /* Custom diff styles */
      .rendered-content ins {
        background-color: #d4edda !important;
        color: #155724 !important;
        text-decoration: none !important;
        padding: 2px 4px;
        border-radius: 3px;
        border: 1px solid #c3e6cb;
        font-weight: 500;
      }
      
      .rendered-content del {
        background-color: #f8d7da !important;
        color: #721c24 !important;
        text-decoration: line-through !important;
        padding: 2px 4px;
        border-radius: 3px;
        border: 1px solid #f5c6cb;
        font-weight: 500;
      }
    `;
  }

  private generateDiff2HtmlDiff() {
    try {
      // Create unified diff patch
      const patch = createPatch(
        '',
        this.uploadData?.originalHtml,
        this.uploadData?.modifiedHtml,
        this.uploadData?.originalUrl,
        this.uploadData?.modifiedUrl,
      );

      // Configure diff2html
      const configuration: Diff2HtmlUIConfig = {
        drawFileList: false,
        fileListToggle: false,
        fileListStartVisible: false,
        fileContentToggle: false,
        matching: 'lines',
        outputFormat: 'side-by-side',
        synchronisedScroll: true,
        highlight: true,
        renderNothingWhenEmpty: false
      };

      // Clear previous content
      if (this.sourceContainer) {
        this.sourceContainer.nativeElement.innerHTML = '';

        // Create diff2html UI
        const diff2htmlUi = new Diff2HtmlUI(
          this.sourceContainer.nativeElement,
          patch,
          configuration
        );

        diff2htmlUi.draw();
      }
    } catch (error) {
      console.error('Error generating diff2html:', error);
      if (this.sourceContainer) {
        this.sourceContainer.nativeElement.innerHTML = '<p class="p-error">Error generating unified diff view.</p>';
      }
    }
  }

  clearAll() {
    this.uploadData.originalHtml = '';
    this.uploadData.modifiedHtml = '';
    this.showResults = false;
    //this.textDiffResult = '';
    //this.originalStructure = '';
    //this.modifiedStructure = '';

    // Clear shadow DOM
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }

    // Clear diff2html container
    if (this.sourceContainer) {
      this.sourceContainer.nativeElement.innerHTML = '';
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
          this.uploadData.modifiedHtml = response;
          this.uploadData.modifiedUrl = "GenAI response"
          this.isLoading = false;
          this.compareHtml();
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