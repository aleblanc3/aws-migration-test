import { Injectable } from '@angular/core';
import { DiffOptions } from '../../../common/data.types';

@Injectable({
  providedIn: 'root'
})
export class WebDiffService {
  constructor() { }

  
  //Generate HTML diff (web page view) using htmldiff-js
  async generateHtmlDiff(originalHtml: string, modifiedHtml: string): Promise<string> {
    const options: DiffOptions = {
      repeatingWordsAccuracy: 0,
      ignoreWhiteSpaceDifferences: true,
      orphanMatchThreshold: 0,
      matchGranularity: 4,
      combineWords: true,
    };

    const { Diff } = await import('@ali-tas/htmldiff-js');

    const diffResult = Diff.execute(
      originalHtml,
      modifiedHtml,
      options,
    ).replace(
      /<(ins|del)[^>]*>(\s|&nbsp;|&#32;|&#160;|&#x00e2;|&#x0080;|&#x00af;|&#x202f;|&#xa0;)+<\/(ins|del)>/gis, // Remove empty or whitespace-only <ins>/<del> tags
      ' ',
    );

    return diffResult;
  }

  //Styles for HTML diff
  getRenderedDiffStyles(): string {
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

      .rendered-content {
        margin: 0;
        padding: 0;
        background-color: #ffffff !important; 
        width: 100%;
        max-width: 100%;
        overflow-wrap: break-word;
        box-sizing: border-box;
        font-family: sans-serif;
      }

      .rendered-content table {
        width: 100%;
        table-layout: auto;
      }

      .rendered-content td, .rendered-content th, .rendered-content pre {
        word-break: break-word;
      }

      .rendered-content pre {
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
}