export interface UploadData {
  originalHtml: string;
  modifiedHtml: string;
  originalUrl: string;
  modifiedUrl: string;
}

export interface PageAssistantState {
  uploadData: UploadData | null;
  activeStep: number;
}

export interface DiffOptions { //Tweaks how sensitive HTML diff is to whitespace, word repitition, etc.
  repeatingWordsAccuracy?: number;
  ignoreWhiteSpaceDifferences?: boolean;
  orphanMatchThreshold?: number;
  matchGranularity?: number;
  combineWords?: boolean;
}