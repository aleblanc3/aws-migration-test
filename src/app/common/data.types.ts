// Upload data (from html, copy/paste, or word)
export interface UploadData {
  originalHtml: string;
  modifiedHtml: string;
  originalUrl: string;
  modifiedUrl: string;
  found?: {
    original: { hidden: boolean; modal: boolean; dynamic: boolean };
    modified: { hidden: boolean; modal: boolean; dynamic: boolean };
  };
}

// Modified data (from upload or AI generated content)
export interface ModifiedData {
  modifiedUrl: string;
  modifiedHtml: string;
}

//Original data (from user edits or saving AI changes)
export interface OriginalData {
  originalUrl: string;
  originalHtml: string;
}

//Data structure for extractContent fxn 
export interface htmlProcessingResult {
  html: string;
  found: {
    hidden: boolean;
    modal: boolean;
    dynamic: boolean;
  };
}

// Diff options to tweaks how sensitive HTML diff is to whitespace, word repitition, etc.
export interface DiffOptions {
  repeatingWordsAccuracy?: number;
  ignoreWhiteSpaceDifferences?: boolean;
  orphanMatchThreshold?: number;
  matchGranularity?: number;
  combineWords?: boolean;
}

//View options for horizontal radio buttons
export enum WebViewType {
  Original = 'original',
  Modified = 'modified',
  Diff = 'diff'
}

export enum SourceViewType {
  Original = 'original',
  Modified = 'modified',
  SideBySide = 'side-by-side',
  LineByLine = 'line-by-line'
}

export interface ViewOption<T = string> {
  label: string;
  value: T;
  icon: string;
}

//Compare options for drawer radio buttons
export enum CompareTask {
  AiGenerated = 'compareAI',
  PrototypeUrl = 'compareUrl',
  TwoModels = 'compare2Models',
  TwoPrompts = 'compare2Prompts'
}

export enum PromptKey {
  Headings = 'headings',
  Doormats = 'doormats',
  PlainLanguage = 'plainLanguage'
}

export enum AiModel {
  Gemini = 'google/gemini-2.0-flash-exp:free', //1.05M context (saves prompt data)
  DeepSeekChatV3 = 'deepseek/deepseek-chat-v3-0324:free', //164k context (saves prompt data)
  Qwen = 'qwen/qwen3-235b-a22b:free', //131k context
  Llama32 = 'meta-llama/llama-3.2-3b-instruct:free', //131k context = wonky results for some reason
  Mistral = 'mistralai/mistral-small-3.1-24b-instruct:free', //128k context
  Kimi = 'moonshotai/kimi-k2:free', //66k context
  Llama33 = 'meta-llama/llama-3.3-70b-instruct:free', //66k context = too small
  Llama31 = 'meta-llama/llama-3.1-405b-instruct:free' //66k context = fine???
}

