import { Injectable } from '@angular/core';
import { WebDiffService } from './web-diff.service';

@Injectable({
  providedIn: 'root'
})
export class ShadowDomService {
  constructor(private webDiffService: WebDiffService) { }


  //Initialize shadowDOM on an element
  initializeShadowDOM(element: HTMLElement): ShadowRoot | null {
    if (element && !element.shadowRoot) {
      return element.attachShadow({ mode: 'open' });
    }
    return element?.shadowRoot || null;
  }

  //Clear shadowDom content
  clearShadowDOM(shadowRoot: ShadowRoot): void {
    if (shadowRoot) {
      shadowRoot.innerHTML = '';
    }
  }

  //Generate shadow DOM content based on view type
  async generateShadowDOMContent(
    shadowRoot: ShadowRoot,
    viewType: 'original' | 'modified' | 'diff',
    originalHtml: string,
    modifiedHtml: string
  ): Promise<void> {
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
    renderedContent.classList.add('rendered-content');

    //Switch views
    switch (viewType) {
      case 'original':
        this.renderHtml(renderedContent, originalHtml, 'original-html');
        break;
      case 'modified':
        this.renderHtml(renderedContent, modifiedHtml, 'modified-html');
        break;
      case 'diff':
        await this.renderDiffHtml(renderedContent, originalHtml, modifiedHtml, 'diff-content');
        break;
    }

    diffContainer.appendChild(renderedContent);
    shadowRoot.appendChild(diffContainer);
  }

  //Render HTML
  private renderHtml(container: HTMLElement, html: string, className: string): void {
    container.classList.add(className);
    container.innerHTML = html;
  }

  //Render Diff
  private async renderDiffHtml(container: HTMLElement, originalHtml: string, modifiedHtml: string, className: string): Promise<void> {
    const diffResult = await this.webDiffService.generateHtmlDiff(originalHtml, modifiedHtml);

    container.classList.add(className);
    container.innerHTML = diffResult;
  }
}