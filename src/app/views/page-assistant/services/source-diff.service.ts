import { Injectable } from '@angular/core';
import {
  Diff2HtmlUIConfig,
  Diff2HtmlUI,
} from 'diff2html/lib/ui/js/diff2html-ui-slim';
import { createPatch } from 'diff';


@Injectable({
  providedIn: 'root'
})
export class SourceDiffService {
  constructor() { }

  /**
   * Generate diff2html UI in the provided container
   */
  generateDiff2HtmlDiff(
    container: HTMLElement,
    originalHtml: string,
    modifiedHtml: string,
    originalUrl: string,
    modifiedUrl: string
  ): void {
    try {
      // Create unified diff patch
      const patch = createPatch(
        'test.html',
        originalHtml,
        modifiedHtml,
        originalUrl,
        modifiedUrl,
      );

      // Configure diff2html
      const configuration: Diff2HtmlUIConfig = {
        drawFileList: false,
        fileListToggle: false,
        fileListStartVisible: false,
        fileContentToggle: false,
        matching: 'lines',
        outputFormat: 'side-by-side',
        synchronisedScroll: true,
        highlight: true,
        renderNothingWhenEmpty: false
      };

      // Clear previous content
      container.innerHTML = '';

      // Create diff2html UI
      const diff2htmlUi = new Diff2HtmlUI(
        container,
        patch,
        configuration
      );

      diff2htmlUi.draw();
      diff2htmlUi.highlightCode();
    } catch (error) {
      console.error('Error generating diff2html:', error);
      container.innerHTML = '<p class="p-error">Error generating unified diff view.</p>';
    }
  }

  /**
   * Clear diff container
   */
  clearDiffContainer(container: HTMLElement): void {
    if (container) {
      container.innerHTML = '';
    }
  }
}