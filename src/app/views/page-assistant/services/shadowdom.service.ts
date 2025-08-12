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
    container.innerHTML = `<div id="editable" contenteditable="false">${html}</div>`;
  }

  //Render Diff
  private async renderDiffHtml(container: HTMLElement, originalHtml: string, modifiedHtml: string, className: string): Promise<void> {
    const diffResult = await this.webDiffService.generateHtmlDiff(originalHtml, modifiedHtml);
    const adjustedDiff = await this.adjustDOM(originalHtml, diffResult);
    container.classList.add(className);
    container.innerHTML = adjustedDiff;
  }

  //Adjust diff result (mark changed links, images, remove nested diff tags)
  private async adjustDOM(originalHtml: string, diffResult: string) {
    interface LinkData {
      text: string;
      href: string;
      insText: string;
      element: Element;
    }

    type LinksMap = Map<string, LinkData[]>;

    // Parse current diff and before content
    const parser = new DOMParser();
    const diffDoc = parser.parseFromString(diffResult, 'text/html');
    const beforeDoc = parser.parseFromString(originalHtml, 'text/html');

    const newLinks: LinksMap = new Map();

    const cleanText = (text: string) => text?.trim().replace(/\s+/g, ' ') || '';

    const wrapWithSpan = (el: Element, title: string) => {
      return `<span class="updated-link" title="${title}">${el.outerHTML}</span>`;
    };

    const findMatchingLinks = (beforeText: string) =>
      newLinks.get(beforeText) ||
      [...newLinks.values()].flat().filter(({ insText }) => insText === beforeText);

    // Collect new links from diff
    diffDoc.querySelectorAll('a').forEach(el => {
      const text = cleanText(el.textContent || '');
      const href = el.getAttribute('href');
      if (!text || !href) return;

      newLinks.set(text, newLinks.get(text) || []);
      newLinks.get(text)!.push({
        text,
        insText:
          cleanText(Array.from(el.childNodes).filter(n => n.nodeName !== 'INS').map(n => n.textContent || '').join('')) ||
          cleanText(Array.from(el.children).filter(c => c.tagName !== 'INS').map(c => c.textContent || '').join('')),
        href,
        element: el
      });
    });

    // Compare with beforeDoc links
    beforeDoc.querySelectorAll('a').forEach(el => {
      const text = cleanText(el.textContent || '');
      const href = el.getAttribute('href');
      if (!text || !href) return;

      const matches = findMatchingLinks(text);
      if (!matches.length) return;

      const matchingKey = [...newLinks.keys()].find(key =>
        newLinks.get(key)?.some(({ insText }) => insText === text)
      );
      if (matchingKey) newLinks.delete(matchingKey);

      if (matches.some(({ href: matchHref }) => matchHref === href)) {
        newLinks.delete(text);
        return;
      }

      if (
        matches.find(({ element }) => element.tagName === 'DEL')?.element.textContent?.trim() === text ||
        matches.find(({ element }) => element.querySelector('ins'))?.element.textContent?.trim() === text
      ) {
        newLinks.delete(text);
        return;
      }

      for (const { insText, element } of matches) {
        if (insText) {
          element.outerHTML = wrapWithSpan(element, `Old URL: ${href}`);
        }
      }
      newLinks.delete(text);
    });

    // Wrap remaining new links
    for (const links of newLinks.values()) {
      for (const { element, insText } of links) {
        if (insText) {
          element.outerHTML = wrapWithSpan(element, 'Newly added link');
        }
      }
    }

    // Remove nested ins/del tags
    diffDoc.querySelectorAll('del > del, ins > ins').forEach(el => {
      const parent = el.parentElement;
      if (parent && parent.textContent?.trim() === el.textContent?.trim()) {
        parent.replaceWith(el);
      }
    });

    diffDoc.querySelectorAll('del > ins, ins > del').forEach(el => {
      const parent = el.parentElement;
      if (parent && parent.textContent?.trim() === el.textContent?.trim()) {
        parent.replaceWith(el);
      }
    });

    // Assign IDs
    const uniqueElements = Array.from(diffDoc.querySelectorAll('ins, del, .updated-link')).map((el, index) => {
      const parent = el.parentElement;
      return {
        element: el,
        outerHTML: parent?.innerHTML?.replace(/\n/g, '').trim() || '',
        id: index + 1
      };
    });

    uniqueElements.forEach(({ element, id }) => {
      element.setAttribute('data-id', `${id}`);
    });

    const wrapWithOverlayWrapper = (el: Element, parentClass: string) => {
      const parent = el.parentElement;
      const dataId = parent?.getAttribute('data-id');
      const wrapper = document.createElement('div');
      wrapper.className = `overlay-wrapper ${parentClass}`;
      if (dataId) wrapper.setAttribute('data-id', dataId);
      wrapper.innerHTML = el.outerHTML;
      parent?.replaceWith(wrapper);
    };

    diffDoc.querySelectorAll('ins img, del img, .updated-link img').forEach(el => {
      const parent = el.parentElement;
      let parentClass = '';
      if (parent?.tagName === 'INS') parentClass = 'ins';
      else if (parent?.tagName === 'DEL') parentClass = 'del';

      if (parentClass) {
        wrapWithOverlayWrapper(el, parentClass);
      }
    });

    return diffDoc.body.innerHTML;
  }

  //Handle clicks inside Shadow DOM
  handleDocumentClick(shadowRoot: ShadowRoot, updateCurrentIndex: (index: number) => void
  ): () => void {
    const clickHandler = (event: Event) => {
      let target = event.target as HTMLElement;

      while (target && target.tagName !== 'A') {
        target = target.parentElement as HTMLElement;
      }
      //link clicks
      if (target?.tagName === 'A') {
        const href = target.getAttribute('href') ?? '';
        //anchor links
        if (href.startsWith('#')) {
          event.preventDefault();
          const sectionId = target.getAttribute('href')?.substring(1);
          const targetSection = shadowRoot.getElementById(sectionId ?? '');

          if (targetSection) {
            targetSection.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            });
          }
        }
        //other links
        if (!href.startsWith('#')) {
          event.preventDefault();
        }
      }
      //diff clicks      
      const changeElements = Array.from(
        shadowRoot.querySelectorAll<HTMLElement>('[data-id]')
      );

      if (!changeElements.length) return;

      const clickedElement = changeElements.find((el) =>
        el.contains(event.target as Node)
      );

      if (!clickedElement) return;

      const index = Number(clickedElement.getAttribute('data-id'));
      this.scrollToElement(clickedElement);
      if (updateCurrentIndex) {
        updateCurrentIndex(index);
      }

    };

    // Attach listener and return cleanup function
    shadowRoot.addEventListener('click', clickHandler);

    return () => {
      shadowRoot.removeEventListener('click', clickHandler);
    };
  }

  //Helper functions for next/prev buttons

  getDataIdElements(shadowRoot: ShadowRoot): HTMLElement[] {
    return Array.from(shadowRoot.querySelectorAll('[data-id]')) as HTMLElement[];
  }

  highlightElement(el: HTMLElement, highlightClass = 'highlight') {
    this.clearHighlights(el.getRootNode() as ShadowRoot, highlightClass);
    el.classList.add(highlightClass);
  }

  clearHighlights(shadowRoot: ShadowRoot, highlightClass = 'highlight') {
    shadowRoot.querySelectorAll(`.${highlightClass}`).forEach((node) => {
      node.classList.remove(highlightClass);
    });
  }

  scrollToElement(el: HTMLElement) {
    const shadowRoot = el.getRootNode() as ShadowRoot;
    shadowRoot.querySelectorAll('.highlight').forEach(h => h.classList.remove('highlight'));
    el.classList.add('highlight');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  openParentDetails(el: HTMLElement) {
    const detailsEl = el.closest('details');
    if (detailsEl) {
      detailsEl.open = true;
    }
  }

  closeAllDetailsExcept(shadowRoot: ShadowRoot, keepOpenEl: HTMLElement) {
    shadowRoot.querySelectorAll('details').forEach((details) => {
      if (details !== keepOpenEl.closest('details')) {
        (details as HTMLDetailsElement).open = false;
      }
    });
  }
}