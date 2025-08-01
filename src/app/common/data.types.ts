// Upload data (from html, copy/paste, or word)
export interface UploadData {
  originalHtml: string;
  modifiedHtml: string;
  originalUrl: string;
  modifiedUrl: string;
}

// Modified data (from upload or AI generated content)
export interface ModifiedData {
  modifiedUrl: string;
  modifiedHtml: string;
}

// Page assistant state (not used yet)
export interface PageAssistantState {
  uploadData: UploadData | null;
  activeStep: number;
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
  PlainLanguage = 'plainLanguage',
  Banana = 'banana'
}

export enum AiModel {  
  DeepSeekChatV3 = 'deepseek/deepseek-chat-v3-0324:free',
  MistralSmall = 'mistralai/mistral-small-3.1-24b-instruct:free',
  DeepHermes = 'nousresearch/deephermes-3-llama-3-8b-preview:free',
  Llama3B = 'meta-llama/llama-3.2-3b-instruct:free',
  Llama11B = 'meta-llama/llama-3.2-11b-vision-instruct:free',
  Gemini = 'google/gemini-2.0-flash-exp:free',
  Mai = 'microsoft/mai-ds-r1:free',
  Qwen = 'qwen/qwen3-235b-a22b:free',  
  DeepSeek = 'deepseek/deepseek-chat:free',
  DeepSeekR1 = 'deepseek/deepseek-r1:free',
  DeepSeekV3 = 'deepseek/deepseek-v3-base:free',
  MistralNemo = 'mistralai/mistral-nemo:free',
  DeepSeekR1T2 = 'tngtech/deepseek-r1t2-chimera:free',
  DeepSeekR1T = 'tngtech/deepseek-r1t-chimera:free',
  DeepSeekR1May = 'deepseek/deepseek-r1-0528:free',
  KimiDev = 'moonshotai/kimi-dev-72b:free',
  KimiVL = 'moonshotai/kimi-vl-a3b-thinking:free',
  Llama353B = 'nvidia/llama-3.1-nemotron-ultra-253b-v1:free',
  GeminiPro = 'google/gemini-2.5-pro-exp-03-25',
}

