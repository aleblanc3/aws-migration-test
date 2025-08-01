import { Injectable } from '@angular/core';
import { Diff2HtmlUI } from 'diff2html/lib/ui/js/diff2html-ui-slim';
import { createPatch } from 'diff';
import type { Diff2HtmlUIConfig } from 'diff2html/lib/ui/js/diff2html-ui-slim';


@Injectable({
  providedIn: 'root'
})
export class SourceDiffService {
  constructor() { }

  //Update source code views

  async generateSourceContent(
    container: HTMLElement,
    viewType: 'original' | 'modified' | 'side-by-side' | 'line-by-line',
    originalHtml: string,
    modifiedHtml: string,
    originalUrl: string,
    modifiedUrl: string
  ): Promise<void> {

    this.clearDiffContainer(container);

    //Switch views
    switch (viewType) {
      case 'original':
        this.renderSource(container, originalHtml);
        break;
      case 'modified':
        this.renderSource(container, modifiedHtml);
        break;
      case 'side-by-side':
        await this.renderSourceDiff(container, originalHtml, modifiedHtml, originalUrl, modifiedUrl, 'side-by-side');
        break;
      case 'line-by-line':
        await this.renderSourceDiff(container, originalHtml, modifiedHtml, originalUrl, modifiedUrl, 'line-by-line');
        break;

    }
  }

  private async renderSource(container: HTMLElement, html: string): Promise<void> {
    const { default: Prism } = await import('prismjs');
    await import('prismjs/components/prism-markup'); // only import the HTML language

    this.loadPrismTheme();

    // Escape HTML to prevent rendering
    const escapedHtml = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    container.innerHTML = `<pre class="m-0"><code class="language-html">${escapedHtml}</code></pre>`;
    const codeBlock = container.querySelector('code');
    if (codeBlock) {
      Prism.highlightElement(codeBlock);
    }
  }

  //Generate source code diff
  async renderSourceDiff(
    container: HTMLElement,
    originalHtml: string,
    modifiedHtml: string,
    originalUrl: string,
    modifiedUrl: string,
    diffStyle: 'side-by-side' | 'line-by-line' = 'side-by-side' // default to side-by-side
  ): Promise<void> {
    try {
      //Import diff modules
      //const [{ createPatch }, { default: Diff2HtmlUI }] = await Promise.all([
      //  import('diff'),
      //  import('diff2html/lib/ui/js/diff2html-ui-slim'),
      //]);

      // Create unified diff patch
      const patch = createPatch(
        '',
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
        outputFormat: diffStyle,
        synchronisedScroll: true,
        highlight: true,
        renderNothingWhenEmpty: false
      };

      // Clear previous content
      container.innerHTML = '';

      // Create diff2html UI
      const diff2htmlUi = new Diff2HtmlUI(container, patch, configuration);
      diff2htmlUi.draw();
      //diff2htmlUi.highlightCode();
    } catch (error) {
      console.error('Error generating diff2html:', error);
      container.innerHTML = '<p class="p-error">Error generating unified diff view.</p>';
    }
  }

  //Clear diff container
  clearDiffContainer(container: HTMLElement): void {
    if (container) {
      container.innerHTML = '';
    }
  }

  //Toggle theme for light/dark mode
  public loadPrismTheme(): void {
    const isDarkMode = document.documentElement.classList.contains('dark-mode');
    const existingLink = document.getElementById('prism-theme') as HTMLLinkElement;

    const newHref = isDarkMode
      ? 'css/prism-okaidia.min.css'
      : 'css/prism.min.css';

    if (existingLink) {
      if (existingLink.href.endsWith(newHref)) return; // already loaded
      existingLink.href = newHref;
    } else {
      const link = document.createElement('link');
      link.id = 'prism-theme';
      link.rel = 'stylesheet';
      link.href = newHref;
      document.head.appendChild(link);
    }
  }

}