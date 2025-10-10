// src/app/views/page-assistant/services/component-ai.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { ApiKeyService } from '../../../services/api-key.service';

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

export type ComponentHealth = 'ok' | 'issue' | 'unknown';

export interface ComponentAiInput {
  componentLabel: string; // human label (translated)
  guidanceUrl?: string | null; // resolved UCDG URL (optional but preferred)
  htmlSnippet?: string | null; // trimmed snippet that shows the component usage
}

export interface ComponentAiResult {
  componentLabel: string;
  health: ComponentHealth;
  confidence: number; // 0..1
  codeUpToDate?: boolean;
  issues?: string[]; // bulleted issues found
  rationale?: string; // brief rationale (1-2 sentences)
}

@Injectable({ providedIn: 'root' })
export class ComponentAiService {
  private readonly http = inject(HttpClient);
  private readonly apiKeyService = inject(ApiKeyService);

  private openRouterApiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  // Same rotation style as Link Report
  private models: string[] = [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemini-2.0-flash-exp:free',
    'google/gemini-exp-1206:free',
    'cognitivecomputations/dolphin3.0-mistral-24b:free',
    'cognitivecomputations/dolphin3.0-r1-mistral-24b:free',
    'nvidia/llama-3.1-nemotron-70b-instruct:free',
    'deepseek/deepseek-r1:free',
  ];

  /** Batch assess selected components; returns a result per input (same order). */
  async assess(components: ComponentAiInput[]): Promise<ComponentAiResult[]> {
    const results: ComponentAiResult[] = [];
    for (const c of components) {
      const one = await this.assessOne(c);
      results.push(one);
    }
    return results;
  }

  /** Assess a single component with minimal, strictly-JSON output. */
  private async assessOne(input: ComponentAiInput): Promise<ComponentAiResult> {
    const system = `You are a senior CRA web UI reviewer.
Given a component label, its UCDG guidance URL, and a small HTML snippet showing how it's used on a page:
- Judge if the component choice is appropriate for its apparent purpose (UX/writing perspective).
- Judge if the code looks up to date with GCWeb/GCDS/UCDG guidance (class names, structure hints).
- If you’re unsure, return "unknown".

Return ONLY compact JSON (no prose):
{
  "health": "ok" | "issue" | "unknown",
  "confidence": 0..1,
  "codeUpToDate": true|false,
  "issues": ["short bullet 1","short bullet 2"],
  "rationale": "≤25 words"
}`;

    // Keep payload tight; never send huge HTML (trimmed by caller, but re-guard here)
    const snippet = (input.htmlSnippet || '').slice(0, 25000);
    const user = {
      componentLabel: input.componentLabel,
      guidanceUrl: input.guidanceUrl || null,
      htmlSnippet: snippet || null,
    };

    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(user) },
    ];

    for (const model of this.models) {
      const resp = await this.callOpenRouter(model, messages, 0.0);
      const text = resp?.choices?.[0]?.message?.content;
      if (!text) continue;

      const cleaned = this.stripCodeFences(text);
      const parsed = this.looseJsonParse(cleaned);
      const out = this.toResult(parsed, input.componentLabel);
      if (out) return out;
    }

    // Fallback when all models fail/parse fails
    return {
      componentLabel: input.componentLabel,
      health: 'unknown',
      confidence: 0,
      codeUpToDate: undefined,
      issues: [],
      rationale: 'No AI response.',
    };
  }

  // ---------- OpenRouter plumbing ----------
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
      'X-Title': 'Content Assistant - Component Guidance',
    });

    const payload = { model, messages, temperature };

    try {
      const resp = (await this.http
        .post(this.openRouterApiUrl, payload, {
          headers,
          responseType: 'text',
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

  // ---------- Output hygiene ----------
  private stripCodeFences(s: string): string {
    return s
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  private tryParseJSON<T = unknown>(s: string): T | null {
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  }

  private looseJsonParse(s: string): unknown | null {
    const direct = this.tryParseJSON(s);
    if (direct !== null) return direct;

    const m = s.match(/\{[\s\S]*\}/);
    return m ? this.tryParseJSON(m[0]!) : null;
  }

  private toResult(
    j: unknown,
    componentLabel: string,
  ): ComponentAiResult | null {
    if (!j || typeof j !== 'object') return null;
    const o = j as Record<string, unknown>;

    const health = o['health'];
    if (health !== 'ok' && health !== 'issue' && health !== 'unknown')
      return null;

    let confidence = Number(o['confidence']);
    if (!Number.isFinite(confidence)) confidence = 0;
    confidence = Math.max(0, Math.min(1, confidence));

    const res: ComponentAiResult = {
      componentLabel,
      health,
      confidence,
    };

    if (typeof o['codeUpToDate'] === 'boolean')
      res.codeUpToDate = o['codeUpToDate'];
    if (typeof o['rationale'] === 'string') res.rationale = o['rationale'];

    if (Array.isArray(o['issues'])) {
      res.issues = (o['issues'] as unknown[])
        .filter((x): x is string => typeof x === 'string')
        .slice(0, 6);
    } else {
      res.issues = [];
    }

    return res;
  }
}
