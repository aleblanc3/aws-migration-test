// src/app/views/page-assistant/services/link-ai.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { ApiKeyService } from '../../../services/api-key.service';
import { DestMeta } from './content-extractor.service';

/** Chat payload types (OpenRouter-compatible minimal shapes) */
type ChatRole = 'system' | 'user' | 'assistant';
interface ChatMessage {
  role: ChatRole;
  content: string;
}
interface OpenRouterChoice {
  message?: { role?: string; content?: string };
}
interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
}

export interface AiVerdict {
  verdict: 'match' | 'mismatch' | 'uncertain';
  confidence: number; // 0..1
  rationale?: string;
  matchedFields?: (
    | 'h1'
    | 'title'
    | 'ogTitle'
    | 'metaDescription'
    | 'headings'
    | 'bodyPreview'
  )[];
}

@Injectable({ providedIn: 'root' })
export class LinkAiService {
  private openRouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  // Reuse your model rotation style
  private models: string[] = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'google/gemini-exp-1206:free',
    'cognitivecomputations/dolphin3.0-mistral-24b:free',
    'cognitivecomputations/dolphin3.0-r1-mistral-24b:free',
    'nvidia/llama-3.1-nemotron-70b-instruct:free',
    'deepseek/deepseek-r1:free',
  ];

  // prefer-inject over constructor DI
  private readonly http = inject(HttpClient);
  private readonly apiKeyService = inject(ApiKeyService);

  /**
   * Ask the model whether a link label matches the destination page content.
   * Returns a structured verdict or null if all models fail.
   */
  async judge(linkText: string, meta: DestMeta): Promise<AiVerdict | null> {
    const systemPrompt = `You judge if a link label matches its destination page.
Use ONLY the provided extracted fields (h1,h2,h3, meta description,bodyPreview).
Consider abbreviations and synonyms.Respond with a single compact JSON object and nothing else:
{"verdict":"match|mismatch|uncertain","confidence":0..1}`;

    const userPayload = {
      linkText,
      destination: {
        url: meta.finalUrl,
        h1: meta.h1,
        title: meta.title,
        ogTitle: meta.ogTitle,
        metaDescription: meta.metaDescription,
        headings: meta.headings?.slice(0, 10),
        bodyPreview: meta.bodyPreview,
      },
    };

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify(userPayload) },
    ];

    for (const model of this.models) {
      const resp = await this.callOpenRouter(model, messages, 0.0);
      const text = resp?.choices?.[0]?.message?.content;
      if (!text) continue;

      const cleaned = this.stripCodeFences(text);
      const parsed = this.looseJsonParse(cleaned);
      const verdict = this.toVerdict(parsed);
      if (verdict) return verdict;
    }
    return null;
  }

  // ------- OpenRouter plumbing -------

  private async callOpenRouter(
    model: string,
    messages: ChatMessage[],
    temperature = 0.0,
  ): Promise<OpenRouterResponse | undefined> {
    const apiKey = this.apiKeyService.getCurrentKey();
    if (!apiKey) throw new Error('API key is required.');

    const headers = new HttpHeaders({
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Title': 'Content Assistant - Link Report',
    });

    const payload = { model, messages, temperature };

    try {
      const resp = (await this.http
        .post(this.openRouterApiUrl, payload, {
          headers,
          responseType: 'text', // prevents Angular JSON parse issues on non-JSON
          observe: 'response',
        })
        .toPromise()) as HttpResponse<string> | null;

      const ct = resp?.headers.get('content-type') || '';
      if (ct.includes('application/json') && typeof resp?.body === 'string') {
        return JSON.parse(resp.body) as OpenRouterResponse;
      } else {
        console.error(
          `OpenRouter non-JSON (status ${resp?.status}, ${ct}):\n`,
          (resp?.body || '').slice(0, 500),
        );
        return undefined;
      }
    } catch (err: unknown) {
      const httpErr = err as { status?: number; error?: unknown };
      const status = httpErr?.status;
      const bodySnippet =
        typeof httpErr?.error === 'string'
          ? httpErr.error.slice(0, 500)
          : JSON.stringify(httpErr?.error);
      console.error(
        `OpenRouter HTTP error (model: ${model}) status=${status}: ${bodySnippet}`,
      );
      return undefined;
    }
  }

  // ------- Output hygiene -------

  /** Remove ``` fences if a model adds them. */
  private stripCodeFences(s: string): string {
    return s
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  /**
   * Try to parse JSON even if the model wraps it with text.
   * - First try direct JSON.parse
   * - Then try the first {...} block via regex
   */
  private looseJsonParse(s: string): unknown | null {
    try {
      return JSON.parse(s);
    } catch {
      // fall through to regex extraction
      void 0;
    }
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0] as string);
      } catch {
        // ignore and return null below
        void 0;
      }
    }
    return null;
  }

  /** Validate & coerce to AiVerdict */
  private toVerdict(j: unknown): AiVerdict | null {
    if (!j || typeof j !== 'object') return null;
    const obj = j as Record<string, unknown>;

    const verdict = obj['verdict'];
    if (
      verdict !== 'match' &&
      verdict !== 'mismatch' &&
      verdict !== 'uncertain'
    )
      return null;

    let confidence = Number(obj['confidence']);
    if (!Number.isFinite(confidence)) confidence = 0;
    confidence = Math.max(0, Math.min(1, confidence));

    let matchedFields: AiVerdict['matchedFields'] | undefined;
    if (Array.isArray(obj['matchedFields'])) {
      const arr = obj['matchedFields'] as unknown[];
      const allowed = new Set([
        'h1',
        'title',
        'ogTitle',
        'metaDescription',
        'headings',
        'bodyPreview',
      ]);
      matchedFields = arr
        .filter((x): x is NonNullable<AiVerdict['matchedFields']>[number] => {
          return typeof x === 'string' && allowed.has(x);
        })
        .slice(); // copy
    }

    const out: AiVerdict = { verdict, confidence };
    if (typeof obj['rationale'] === 'string') out.rationale = obj['rationale'];
    if (matchedFields && matchedFields.length)
      out.matchedFields = matchedFields;
    return out;
  }
}
