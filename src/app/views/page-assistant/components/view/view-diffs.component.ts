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

import { UploadData, DiffOptions } from '../../../../common/data.types'

//Services
import { OpenRouterService, OpenRouterMessage } from '../openrouter.service';
import { AiOptionsComponent } from './ai-options.component';
import { WebDiffService } from '../../services/web-diff.service';
import { SourceDiffService } from '../../services/source-diff.service';
import { ShadowDomService } from '../../services/shadowdom.service';

import { HorizontalRadioButtonsComponent } from '../../../../components/horizontal-radio-buttons/horizontal-radio-buttons.component';
import { ViewOption, WebViewType, SourceViewType } from '../../../../common/data.types';

@Component({
  selector: 'ca-view-diffs',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, CardModule, TabsModule, RadioButtonModule,
    AiOptionsComponent, HorizontalRadioButtonsComponent
  ],
  templateUrl: './view-diffs.component.html',
  styleUrl: './view-diffs.component.scss',
})
export class ViewDiffsComponent implements AfterViewInit, OnDestroy, OnChanges {

  constructor(
    private openRouterService: OpenRouterService,
    private htmlDiffService: WebDiffService,
    private sourceDiffService: SourceDiffService,
    private shadowDomService: ShadowDomService
  ) { }

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

  //Web view options
  webSelectedView: WebViewType = WebViewType.Diff;

  webViewOptions: ViewOption<WebViewType>[] = [
    { label: 'page.compare.view.original', value: WebViewType.Original, icon: 'pi pi-file' },
    { label: 'page.compare.view.modified', value: WebViewType.Modified, icon: 'pi pi-file-edit' },
    { label: 'page.compare.view.diff', value: WebViewType.Diff, icon: 'pi pi-sort-alt' }
  ];

  // Source view options
  sourceSelectedView: SourceViewType = SourceViewType.SideBySide;

  sourceViewOptions: ViewOption<SourceViewType>[] = [
    { label: 'page.compare.view.sidebyside', value: SourceViewType.SideBySide, icon: 'pi pi-pause' },
    { label: 'page.compare.view.unified', value: SourceViewType.Unified, icon: 'pi pi-equals' }
  ];

  //Variables
  showResults = false;

  private shadowRoot?: ShadowRoot | null = null;

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
      this.shadowRoot = this.shadowDomService.initializeShadowDOM(this.liveContainer.nativeElement);
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
  onViewChange(viewType: WebViewType) {
    this.webSelectedView = viewType;
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

    this.shadowDomService.generateShadowDOMContent(
      this.shadowRoot,
      this.webSelectedView,
      this.uploadData?.originalHtml || '',
      this.uploadData?.modifiedHtml || ''
    );
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

    this.shadowDomService.generateShadowDOMDiff(
      this.shadowRoot,
      this.uploadData?.originalHtml || '',
      this.uploadData?.modifiedHtml || ''
    );
  }

  private generateDiff2HtmlDiff() {
    if (!this.sourceContainer) {
      return;
    }

    this.sourceDiffService.generateDiff2HtmlDiff(
      this.sourceContainer.nativeElement,
      this.uploadData?.originalHtml || '',
      this.uploadData?.modifiedHtml || '',
      this.uploadData?.originalUrl || '',
      this.uploadData?.modifiedUrl || ''
    );
  }

  clearAll() {
    this.uploadData.originalHtml = '';
    this.uploadData.modifiedHtml = '';
    this.showResults = false;

    // Clear shadow DOM
    if (this.shadowRoot) {
      this.shadowDomService.clearShadowDOM(this.shadowRoot);
    }

    // Clear diff2html container
    if (this.sourceContainer) {
      this.sourceDiffService.clearDiffContainer(this.sourceContainer.nativeElement);
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