import { Injectable } from '@angular/core';
import { DiffOptions } from '../data/data.model';

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
      
      /* Base styling for ins, del, and updated-link */
      ins,
      del,
      .updated-link {
        display: inline;
        padding: 0 0.3em;
        height: auto;
        border-radius: 0.3em;
        -webkit-box-decoration-break: clone;
        -o-box-decoration-break: clone;
        box-decoration-break: clone;
        margin-left: 0.07em;
        margin-right: 0.07em;
        font-weight: 500;
      }

      /* Inserted text (ins) */
      .rendered-content ins {
        background-color: #d4edda !important;
        color: #155724 !important;
        text-decoration: none !important;
        padding: 2px 4px;
        border-radius: 3px;
        border: 1px solid #c3e6cb;
      }

      /* Deleted text (del) */
      .rendered-content del {
        background-color: #f8d7da !important;
        color: #721c24 !important;
        text-decoration: line-through !important;
        padding: 2px 4px;
        border-radius: 3px;
        border: 1px solid #f5c6cb;
      }

      /* Updated links */
      .updated-link {
        background-color: #FFEE8C;
      }

      /* Highlighting for inserted, deleted, and updated elements */
      del.highlight,
      ins.highlight,
      span.diff-group.highlight,
      .updated-link.highlight:not(.overlay-wrapper.updated-link) {
        outline: 3px dotted #6e2ea7;
        padding-left: 0.35em;
        padding-right: 0.35em;
        line-height: unset;
        position: unset;
        top: unset;
        height: unset;
        transition: padding-left ease 0.3s, padding-right ease 0.3s, color ease 0.7s;
      }

      /* Overlay wrapper styles */
      .overlay-wrapper {
        position: relative;
        display: inline-block;
        width: 100%;
        height: 100%;
      }

      .overlay-wrapper::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(131, 213, 168, 0.4);
        z-index: 10;
        border-radius: 5px;
        pointer-events: none;
      }

      .overlay-wrapper.del::before {
        background: rgba(243, 165, 157, 0.5);
      }

      .overlay-wrapper.del::after {
        content: "";
        position: absolute;
        top: 50%;
        left: 0;
        width: 100%;
        height: 2px;
        background: rgba(24, 21, 21, 0.5);
        z-index: 20;
        pointer-events: none;
        opacity: 0.8;
      }

      .overlay-wrapper.updated-link::before {
        background: rgba(250, 237, 165, 0.23);
      }

      .overlay-wrapper.highlight::before {
        border: 2px dotted #000;
      }

      .overlay-wrapper img {
        width: 100%;
        display: block;
      }

      /* Optional connection type styling */
      .cnjnctn-type-or > [class*=cnjnctn-col]:not(:first-child):before {
        content: "or";
      }
    `;
  }
}