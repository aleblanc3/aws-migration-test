import { Injectable } from '@angular/core';
import { Diff } from '@ali-tas/htmldiff-js';
import { DiffOptions } from '../../../common/data.types';

@Injectable({
  providedIn: 'root'
})
export class WebDiffService {
  constructor() { }

  /**
   * Generate HTML diff using htmldiff-js
   */
  generateHtmlDiff(originalHtml: string, modifiedHtml: string): string {
    const options: DiffOptions = {
      repeatingWordsAccuracy: 0,
      ignoreWhiteSpaceDifferences: true,
      orphanMatchThreshold: 0,
      matchGranularity: 4,
      combineWords: true,
    };

    const diffResult = Diff.execute(
      originalHtml,
      modifiedHtml,
      options,
    ).replace(
      /<(ins|del)[^>]*>(\s|&nbsp;|&#32;|&#160;|&#x00e2;|&#x0080;|&#x00af;|&#x202f;|&#xa0;)+<\/(ins|del)>/gis,
      ' ',
    );

    return diffResult;
  }

  /**
   * Parse HTML string to get body content
   */
  parseHtmlContent(htmlString: string): string {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    return doc.body ? doc.body.innerHTML : htmlString;
  }

  /**
   * Generate rendered diff HTML for shadow DOM
   */
  generateRenderedDiff(originalHtml: string, modifiedHtml: string): string {
    const diffResult = this.generateHtmlDiff(originalHtml, modifiedHtml);
    return this.parseHtmlContent(diffResult);
  }

  /**
   * Get styles for rendered diff content
   */
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

      html, body {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
        max-width: 100%;
        overflow-x: hidden;
        font-family: sans-serif;
      }

      .rendered-content {
        background-color: #ffffff !important; 
        width: 100%;
        max-width: 100%;
        overflow-wrap: break-word;
        box-sizing: border-box;
      }

      table {
        width: 100%;
        table-layout: auto;
      }

      td, th, pre {
        word-break: break-word;
      }

      pre {
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