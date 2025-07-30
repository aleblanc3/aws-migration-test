import {
  Component, Input, ViewChild, ViewEncapsulation, AfterViewInit, OnDestroy, OnChanges, OnInit, SimpleChanges, //decorators & lifecycle
  ElementRef, Renderer2, //DOM utilities
  inject, //Dependency injection
  signal, WritableSignal, Signal, computed, effect //Signals/reactivity
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

//Translation
import { TranslateModule, TranslateService } from "@ngx-translate/core";

//PrimeNG
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { RadioButtonModule } from 'primeng/radiobutton';


//Services
import { UploadStateService } from './services/upload-state.service';
import { UploadData, DiffOptions, ViewOption, WebViewType, SourceViewType } from '../../common/data.types';

import { OpenRouterService, OpenRouterMessage } from './services/openrouter.service';
import { AiOptionsComponent } from './components/ai-options.component';
import { WebDiffService } from './services/web-diff.service';
import { SourceDiffService } from './services/source-diff.service';
import { ShadowDomService } from './services/shadowdom.service';

import { HorizontalRadioButtonsComponent } from '../../components/horizontal-radio-buttons/horizontal-radio-buttons.component';

@Component({
  selector: 'ca-page-assistant-compare',
  imports: [CommonModule, FormsModule,
    TranslateModule,
    TabsModule, ButtonModule, RadioButtonModule, CardModule,
    AiOptionsComponent, HorizontalRadioButtonsComponent],
  templateUrl: './page-assistant.component.html',
  styleUrl: './page-assistant.component.css'
})
export class PageAssistantCompareComponent implements OnInit {

  constructor(private translate: TranslateService, private uploadState: UploadStateService, private sourceDiffService: SourceDiffService, private shadowDomService: ShadowDomService, private openRouterService: OpenRouterService, private router: Router) {
    effect(() => {
      const data = this.uploadState.getUploadData();
      const viewType = this.webSelectedView();
      const shadowRoot = this.shadowDOM();
      console.log("Watch out!");
      if (data?.originalHtml && data?.modifiedHtml && shadowRoot) {
        console.log("It's happening!");
        this.shadowDomService.generateShadowDOMContent(
          shadowRoot,
          viewType,
          data.originalHtml,
          data.modifiedHtml);

        const container = this.sourceContainer?.nativeElement;
        if (container) {
          this.sourceDiffService.generateDiff2HtmlDiff(
            container,
            data.originalHtml,
            data.modifiedHtml,
            data.originalUrl ?? 'Original',
            data.modifiedUrl ?? 'Modified'
          );
        }
      }
    });
  }

  get uploadType(): 'url' | 'paste' | 'word' {
    return this.uploadState.getSelectedUploadType(); // returns signal().value
  }

  get uploadData(): Partial<UploadData> | null {
    return this.uploadState.getUploadData(); // returns signal().value
  }

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
  webSelectedView = signal<WebViewType>(WebViewType.Diff);

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

  //Change view
  onWebViewChange(viewType: WebViewType) {
    this.webSelectedView.set(viewType);
  }

  onSourceViewChange(viewType: SourceViewType) {
    this.sourceSelectedView = viewType;
    //do something
  }


  //Get DOM elements from template
  @ViewChild('liveContainer', { static: false }) liveContainer!: ElementRef;
  @ViewChild('sourceContainer', { static: false }) sourceContainer!: ElementRef;
  //private shadowRoot?: ShadowRoot | null = null;
  shadowDOM = signal<ShadowRoot | null>(null);

  //Runs when view is initialized
  ngAfterViewInit() {
    const shadowRoot = this.shadowDomService.initializeShadowDOM(this.liveContainer.nativeElement);
    if (shadowRoot) {
      this.shadowDOM.set(shadowRoot);
      console.log('Shadow DOM is initialized.');
    }
  }

  ngOnInit(): void {

  }
  ngOnDestroy() {
    if (this.shadowDOM) {
      this.shadowDomService.clearShadowDOM(this.shadowDOM()!);
      this.shadowDOM.set(null);
    }
  }

  clearAll(): void {
    this.uploadState.resetUploadFlow();
    this.router.navigate(['page-assistant']);
  }

  //AI interaction
  aiResponse: string = '';
  isLoading = false;

  sendToAI(): void {
    this.isLoading = true;
    const data = this.uploadState.getUploadData();
    const html = data!.originalHtml;
    const prompt = "You are an expert web content writer with 10 years of experience in the public service. Your primary function is to help web publishers rewrite technical content to be easy to understand for the general public. Please review the included HTML code and update only the words. Return only the updated HTML code with no explanations. "

    if (!html) return;
    const messages: OpenRouterMessage[] = [
      { role: 'system', content: prompt },
      { role: 'user', content: html }
    ];

    this.openRouterService.sendChat('deepseek/deepseek-chat-v3-0324:free', messages).subscribe({
      next: (response) => {
        this.aiResponse = response;        
        this.uploadState.mergeModifiedData({
          modifiedUrl: "AI generated",
          modifiedHtml: this.aiResponse
        })
        this.isLoading = false;
      },
        error: (err) => {
        console.error('Error getting AI response:', err);
        this.aiResponse = 'An error occurred while contacting the AI.';
        this.isLoading = false;
      }
    });

  }




}
