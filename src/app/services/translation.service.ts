import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ApiKeyService } from './api-key.service';

@Injectable({
  providedIn: 'root',
})
export class TranslationService {
  private openRouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  private docxPrompt = `You are a document formatting assistant. 
You will be provided two inputs in HTML format:
1. An English HTML document that contains unique identifiers for each text segment (e.g., <p id="P1">, <p id="P2">).
2. A block of French text that is the translation of the English document.

Your task: return the French document in HTML format such that:
1. All English text is replaced with its correct French translation.
2. The HTML structure (tags, attributes, order) remains unchanged.
3. Each text element retains its original unique ID.
Do not add extra commentary or leftover English text.`;

  private pptxPrompt = `You are a presentation formatting assistant. 
Inputs:
1. English HTML containing IDs like S3_T1, S3_T2.
2. A block of French text.

Your task: 
1. Replace the English text with correct French translation.
2. Preserve the same HTML structure and unique IDs.
3. If the French text is one paragraph but the English input is split into multiple segments, split it appropriately.
Return only the French HTML document.`;

  constructor(
    private http: HttpClient,
    private apiKeyService: ApiKeyService,
  ) {}

  /**
   * Aligns French text with the English HTML structure.
   */
  async alignTranslation(
    englishHtml: string,
    frenchText: string,
    englishFile: File | null,
  ): Promise<string | null> {
    // Clean English HTML
    englishHtml = englishHtml.replace(/<img[^>]*>/g, '');

    // Select prompt based on file type
    const fileExtension = englishFile?.name.split('.').pop()?.toLowerCase();
    const systemPrompt =
      fileExtension === 'pptx' ? this.pptxPrompt : this.docxPrompt;

    // Build chat request
    const combinedPrompt = `${systemPrompt}\n\nEnglish Document (HTML):\n${englishHtml}\n\nFrench Text:\n${frenchText}\n\nReturn the French document in HTML format that exactly follows the structure of the English document.`;

    const requestJson = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: combinedPrompt },
    ];

    const models = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'google/gemini-exp-1206:free',
      'cognitivecomputations/dolphin3.0-mistral-24b:free',
      'cognitivecomputations/dolphin3.0-r1-mistral-24b:free',
      'nvidia/llama-3.1-nemotron-70b-instruct:free',
      'deepseek/deepseek-r1:free',
    ];

    let finalResponse: string | null = null;

    for (const model of models) {
      const aiResponse = await this.getORData(model, requestJson, 0.0);
      if (aiResponse?.choices?.[0]?.message?.content) {
        finalResponse = this.removeCodeFences(
          aiResponse.choices[0].message.content,
        );
        console.log('AI response received.');
        break; // Stop at first successful response
      }
    }

    return finalResponse;
  }

  /**
   * Fetches data from OpenRouter API
   */
  private async getORData(
    model: string,
    requestJson: any,
    temperature = 0.0,
  ): Promise<any> {
    const apiKey = this.apiKeyService.getCurrentKey();
    if (!apiKey) throw new Error('API key is required.');

    const headers = new HttpHeaders({
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Title': 'Content Assistant', // optional but nice
    });

    const payload = { model, messages: requestJson, temperature };

    try {
      const resp = await this.http
        .post(this.openRouterApiUrl, payload, {
          headers,
          responseType: 'text', // <-- key change
          observe: 'response',
        })
        .toPromise();

      const ct = resp?.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return JSON.parse(resp!.body as string);
      } else {
        console.error(
          `OpenRouter non-JSON (status ${resp?.status}, ${ct}):\n`,
          (resp?.body || '').slice(0, 500),
        );
        return undefined; // let alignTranslation() try the next model
      }
    } catch (err: any) {
      const status = err?.status;
      const bodySnippet =
        typeof err?.error === 'string'
          ? err.error.slice(0, 500)
          : JSON.stringify(err?.error);
      console.error(
        `OpenRouter HTTP error (model: ${model}) status=${status}: ${bodySnippet}`,
      );
      return undefined; // keep falling back
    }
  }

  /**
   * Removes ``` code fences from AI output
   */
  private removeCodeFences(str: string): string {
    str = str.replace(/^```.*\n/, '');
    str = str.replace(/\n\s*```+\s*$/, '');
    return str.trim();
  }

  /**
   * Builds a mapping of paragraph IDs to French text from HTML.
   */
  buildFrenchTextMap(finalFrenchHtml: string): { [key: string]: string } {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = finalFrenchHtml;
    const frenchMap: { [key: string]: string } = {};
    tempDiv.querySelectorAll('p[id]').forEach((p) => {
      const id = p.getAttribute('id')!;
      const text = p.textContent?.trim() || '';
      if (text) frenchMap[id] = text;
    });
    return frenchMap;
  }
}
