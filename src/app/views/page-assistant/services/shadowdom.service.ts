import { Injectable } from '@angular/core';
import { WebDiffService } from './web-diff.service';

@Injectable({
  providedIn: 'root'
})
export class ShadowDomService {
  constructor(private webDiffService: WebDiffService) { }

  /**
   * Initialize shadow DOM on an element
   */
  initializeShadowDOM(element: HTMLElement): ShadowRoot | null {
    if (element && !element.shadowRoot) {
      return element.attachShadow({ mode: 'open' });
    }
    return element?.shadowRoot || null;
  }

  /**
   * Clear shadow DOM content
   */
  clearShadowDOM(shadowRoot: ShadowRoot): void {
    if (shadowRoot) {
      shadowRoot.innerHTML = '';
    }
  }

  /**
   * Generate shadow DOM content based on view type
   */
  generateShadowDOMContent(
    shadowRoot: ShadowRoot,
    viewType: 'original' | 'modified' | 'diff',
    originalHtml: string,
    modifiedHtml: string
  ): void {
    if (!shadowRoot) {
      console.error('Shadow DOM not available');
      return;
    }

    // Clear previous content
    this.clearShadowDOM(shadowRoot);

    // Add base styles
    const style = document.createElement('style');
    style.textContent = this.webDiffService.getRenderedDiffStyles();
    shadowRoot.insertBefore(style, shadowRoot.firstChild);

    // Create container
    const diffContainer = document.createElement('div');
    diffContainer.className = 'rendered-diff-container';

    const renderedContent = document.createElement('div');
    renderedContent.className = 'rendered-content';

    switch (viewType) {
      case 'original':
        this.renderOriginalHtml(renderedContent, originalHtml);
        break;
      case 'modified':
        this.renderModifiedHtml(renderedContent, modifiedHtml);
        break;
      case 'diff':
        this.renderDiffHtml(renderedContent, originalHtml, modifiedHtml);
        break;
    }

    diffContainer.appendChild(renderedContent);
    shadowRoot.appendChild(diffContainer);
  }

  /**
   * Generate shadow DOM diff (legacy method for backward compatibility)
   */
  async generateShadowDOMDiff(
    shadowRoot: ShadowRoot,
    originalHtml: string,
    modifiedHtml: string
  ): Promise<void> {
    if (!shadowRoot) {
      console.error('Shadow DOM failed to initialize');
      return;
    }

    // Parse HTML using DOMParser
    const parser = new DOMParser();
    const originalDoc = parser.parseFromString(originalHtml, 'text/html');
    const modifiedDoc = parser.parseFromString(modifiedHtml, 'text/html');

    // Create diff container to render the HTML
    const diffContainer = document.createElement('div');
    diffContainer.className = 'rendered-diff-container';

    // Create the rendered content container
    const renderedContent = document.createElement('div');
    renderedContent.className = 'rendered-content';

    // Use htmldiff-js to get the diff with HTML highlighting
    const diffResult = await this.webDiffService.generateHtmlDiff(originalHtml, modifiedHtml);

    // Parse the diff result and render it
    const diffDoc = parser.parseFromString(diffResult, 'text/html');

    // Clone the body content from the diff result
    if (diffDoc.body) {
      renderedContent.innerHTML = diffDoc.body.innerHTML;
    } else {
      renderedContent.innerHTML = diffResult;
    }

    diffContainer.appendChild(renderedContent);

    // Clear previous content and add new diff
    this.clearShadowDOM(shadowRoot);
    shadowRoot.appendChild(diffContainer);

    // Add enhanced styles for rendered content
    const style = document.createElement('style');
    style.textContent = this.webDiffService.getRenderedDiffStyles();
    shadowRoot.insertBefore(style, shadowRoot.firstChild);
  }

  private renderOriginalHtml(container: HTMLElement, originalHtml: string): void {
    const parser = new DOMParser();
    const originalDoc = parser.parseFromString(originalHtml, 'text/html');

    container.className = 'rendered-content original-content';
    container.innerHTML = originalDoc.body ? originalDoc.body.innerHTML : originalHtml;
  }

  private renderModifiedHtml(container: HTMLElement, modifiedHtml: string): void {
    const parser = new DOMParser();
    const modifiedDoc = parser.parseFromString(modifiedHtml, 'text/html');

    container.className = 'rendered-content modified-content';
    container.innerHTML = modifiedDoc.body ? modifiedDoc.body.innerHTML : modifiedHtml;
  }

  private async renderDiffHtml(container: HTMLElement, originalHtml: string, modifiedHtml: string): Promise<void> {
    const diffResult = await this.webDiffService.generateRenderedDiff(originalHtml, modifiedHtml);

    container.className = 'rendered-content diff-content';
    container.innerHTML = diffResult;
  }
}