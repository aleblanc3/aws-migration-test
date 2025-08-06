import {
  Component, Input, ViewChild, ViewEncapsulation, AfterViewInit, OnDestroy, OnChanges, OnInit, SimpleChanges, //decorators & lifecycle
  ElementRef, Renderer2, //DOM utilities
  inject, //Dependency injection
  signal, WritableSignal, Signal, computed, effect //Signals/reactivity
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

//Translation
import { TranslateModule, TranslateService } from "@ngx-translate/core";

//PrimeNG
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TabsModule } from 'primeng/tabs';
import { RadioButtonModule } from 'primeng/radiobutton';


//Services
import { UploadStateService } from './services/upload-state.service';
import { UrlDataService } from './services/url-data.service';
import { UploadData, ViewOption, WebViewType, SourceViewType, PromptKey, AiModel } from '../../common/data.types';
import { PromptTemplates } from './components/ai-prompts';

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

  constructor(private translate: TranslateService, private uploadState: UploadStateService, private sourceDiffService: SourceDiffService, private shadowDomService: ShadowDomService, private openRouterService: OpenRouterService, private urlDataService: UrlDataService, private router: Router) {
    effect(() => {
      const data = this.uploadState.getUploadData();
      const viewType = this.webSelectedView();
      const shadowRoot = this.shadowDOM();
      console.log("[Web tab] received new data");
      if (data?.originalHtml && data?.modifiedHtml && shadowRoot) {
        console.log("[Web tab] generating diff");
        this.shadowDomService.generateShadowDOMContent(
          shadowRoot,
          viewType,
          data.originalHtml,
          data.modifiedHtml);
      }
    });
    effect(() => {
      const data = this.uploadState.getUploadData();
      const viewType = this.sourceSelectedView();
      const container = this.sourceContainerSignal();
      console.log("[Source tab] received new data");
      if (data?.originalHtml && data?.modifiedHtml && container) {
        console.log("[Source tab] generating diff");
        this.sourceDiffService.generateSourceContent(
          container.nativeElement,
          viewType,
          data.originalHtml,
          data.modifiedHtml,
          data.originalUrl ?? 'Original',
          data.modifiedUrl ?? 'Modified'
        );
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
  sourceSelectedView = signal<SourceViewType>(SourceViewType.SideBySide);

  sourceViewOptions: ViewOption<SourceViewType>[] = [
    { label: 'page.compare.view.original', value: SourceViewType.Original, icon: 'pi pi-file' },
    { label: 'page.compare.view.modified', value: SourceViewType.Modified, icon: 'pi pi-file-edit' },
    { label: 'page.compare.view.sidebyside', value: SourceViewType.SideBySide, icon: 'pi pi-pause' },
    { label: 'page.compare.view.linebyline', value: SourceViewType.LineByLine, icon: 'pi pi-equals' }
  ];

  //Change web view
  onWebViewChange(viewType: WebViewType) {
    this.webSelectedView.set(viewType);
  }

  //Change source view
  onSourceViewChange(viewType: SourceViewType) {
    this.sourceSelectedView.set(viewType);
  }

  //Get DOM elements from template
  @ViewChild('liveContainer', { static: false }) liveContainer!: ElementRef;
  @ViewChild('sourceContainer', { static: false }) sourceContainer!: ElementRef;

  shadowDOM = signal<ShadowRoot | null>(null);
  sourceContainerSignal = signal<ElementRef | null>(null);

  //Runs when view is initialized
  ngAfterViewInit() {
    const shadowRoot = this.shadowDomService.initializeShadowDOM(this.liveContainer.nativeElement);
    if (shadowRoot) {
      this.shadowDOM.set(shadowRoot);
      console.log('Shadow DOM is initialized.');
    }
    if (this.sourceContainer) {
      this.sourceContainerSignal.set(this.sourceContainer);
      console.log('Source container is initialized.');
    }
  }

  ngOnInit(): void {
    this.observeDarkMode();

  }
  ngOnDestroy() {
    if (this.shadowDOM) {
      this.shadowDomService.clearShadowDOM(this.shadowDOM()!);
      this.shadowDOM.set(null);
    }
    this.sourceContainerSignal.set(null);
    this.darkModeObserver?.disconnect();
  }

  clearAll(): void {
    this.uploadState.resetUploadFlow();
    this.router.navigate(['page-assistant']);
  }

  private darkModeObserver?: MutationObserver;
  private observeDarkMode(): void {
    this.darkModeObserver = new MutationObserver(() => {
      this.sourceDiffService.loadPrismTheme();
    });

    //Checks for any changes to classes on <html> ie. dark-mode
    this.darkModeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
  }

  //AI Prompt
  aiPrompt: string = "";
  selectedPromptKey: PromptKey = PromptKey.PlainLanguage;
  get selectedPromptText(): string {
    return PromptTemplates[this.selectedPromptKey];
  }
  onPromptChange(key: PromptKey) {
    this.selectedPromptKey = key;
  }

  //AI Model
  selectedAiModel: AiModel = AiModel.Gemini;

  onAiChange(key: AiModel) {
    this.selectedAiModel = key;
  }

  //AI interaction
  isLoading = false;

  async sendToAIold(): Promise<void> {
    this.isLoading = true;
    try {
      const data = this.uploadState.getUploadData();
      const html = data!.originalHtml;
      if (!html) return;

      const prompt = this.selectedPromptText;
      const model = this.selectedAiModel;

      const messages: OpenRouterMessage[] = [
        { role: 'system', content: prompt },
        { role: 'user', content: html }
      ];

      const response = await firstValueFrom(this.openRouterService.sendChat(model, messages));
      const formattedResponse = await this.urlDataService.formatHtml(response, 'ai');
      console.log(formattedResponse)
      this.uploadState.mergeModifiedData({
        modifiedUrl: "AI generated",
        modifiedHtml: formattedResponse
      });
    } catch (err: any) {
      console.error('Error getting AI response:', err);
    } finally {
      this.isLoading = false;
    }

  }

  //FROM OPENROUTER REQUEST BUILDER
  async sendToAI(): Promise<void> {
    this.isLoading = true;
    try {
      const apiKey = localStorage.getItem('apiKey');
      if (!apiKey) throw new Error('Missing API key');

      const uploadData = this.uploadState.getUploadData();
      const html = uploadData?.originalHtml
      if (!html) throw new Error('No HTML to send');

      const prompt = this.selectedPromptText;
      const model = this.selectedAiModel;
      const url = "https://openrouter.ai/api/v1/chat/completions";

      const headers = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      };

      const payload = {
        "models": [model, AiModel.Mistral, AiModel.Qwen],
        "messages": [
          { "role": "system", "content": prompt },
          { "role": "user", "content": html }
        ],
        "temperature": 0,
        "provider": {
          "allow_fallbacks": true,
          //"data_collection": "deny"
        }
      };

      //console.log(`Using AI model: `, model);
      //console.log(prompt);
      //console.log(html);
      console.log('Sending to OpenRouter:', {payload});

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      console.log(`AI response status: `, response.status);

      const data = await response.json();

      //console.log(data);

      if (data.error) {
        console.info(`400: Bad Request (invalid or missing params, CORS)\n
                    401: Invalid credentials (OAuth session expired, disabled/invalid API key)\n
                    402: Your account or API key has insufficient credits. Add more credits and retry the request.\n
                    403: Your chosen model requires moderation and your input was flagged\n
                    408: Your request timed out\n
                    429: You are being rate limited\n
                    502: Your chosen model is down or we received an invalid response from it\n
                    503: There is no available model provider that meets your routing requirements`);
        console.error(data.error?.status);
        console.error(data.error?.message);
        throw new Error(`AI error: ${data.error?.message}`);
      }

      const aiResponse = data.choices?.[0].message.content;

      //console.log(`AI RESPONSE: `, aiResponse);
      console.log(`AI MODAL: `, data.model);
      console.log(`PROMPT TOKENS: `, data.usage.prompt_tokens);
      console.log(`RESPONSE TOKENS: `, data.usage.completion_tokens);
      console.log(`TOTAL TOKENS: `, data.usage.total_tokens);

      if (model != data.model) { console.warn("A FALLBACK MODEL WAS USED") }

      const formattedResponse = await this.urlDataService.formatHtml(aiResponse, 'ai');

      //console.log(formattedResponse)

      this.uploadState.mergeModifiedData({
        modifiedUrl: "AI generated",
        modifiedHtml: formattedResponse
      });

    } catch (err) {
      console.error(`sendToAI function failed:`, err);
      // ADD ERROR MESSAGE & TOAST

    } finally {
      this.isLoading = false;
    }
  }
}
