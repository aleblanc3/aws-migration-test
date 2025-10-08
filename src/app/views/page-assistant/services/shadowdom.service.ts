import { Injectable, inject } from '@angular/core';
import { WebDiffService } from './web-diff.service';
import { SelectionTypes } from '../data/data.model';
//import { LinkData, SelectionTypes } from '../data/data.model';

@Injectable({
  providedIn: 'root'
})
export class ShadowDomService {
  private webDiffService = inject(WebDiffService);

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

    // Add external stylesheets
    const externalStyles = [
      'https://use.fontawesome.com/releases/v5.15.4/css/all.css',
      'https://www.canada.ca/etc/designs/canada/wet-boew/css/theme.min.css',
      'https://www.canada.ca/etc/designs/canada/wet-boew/méli-mélo/2024-09-kejimkujik.min.css'
    ];
    for (const href of externalStyles) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      shadowRoot.appendChild(link);
    }

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

    // Parse current diff and before content
    const parser = new DOMParser();
    const diffDoc = parser.parseFromString(diffResult, 'text/html');
    /*const beforeDoc = parser.parseFromString(originalHtml, 'text/html');

    type LinksMap = Map<string, LinkData[]>;

    
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
          console.log(`Newly added link text`, insText);
          element.outerHTML = wrapWithSpan(element, 'Newly added link');
        }
      }
    }

    */
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
    const uniqueElements = Array.from(diffDoc.querySelectorAll('ins.diffins, del.diffdel, del.diffmod, .updated-link')).map((el, index) => {
      //Group diffmods <--needs QA check
      if (el.matches('del.diffmod') && el.nextElementSibling?.matches('ins.diffmod')) {
        const wrapper = diffDoc.createElement('span');
        wrapper.classList.add('diff-group');
        const matchingIns = el.nextElementSibling;
        el.parentNode?.insertBefore(wrapper, el);
        wrapper.appendChild(el);
        wrapper.appendChild(matchingIns);
        el = wrapper;
      }
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
    /* 
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
    */
    return diffDoc.body.innerHTML;
  }

  //Handle clicks inside Shadow DOM
  handleDocumentClick(shadowRoot: ShadowRoot, updateCurrentIndex: (index: number) => void): () => void {
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
      const changeElements = this.getDataIdElements(shadowRoot);

      if (!changeElements.length) return;

      const clickedElement = changeElements.find((el) =>
        el.contains(event.target as Node)
      );

      if (!clickedElement) return;

      //const index = Number(clickedElement.getAttribute('data-id'));
      const index = changeElements.indexOf(clickedElement);
      this.scrollToElement(clickedElement);
      if (updateCurrentIndex) {
        updateCurrentIndex(index);
        this.lastSelection = { count: 1, startId: null, endId: null }; //reset selection
      }

    };

    // Attach listener and return cleanup function
    shadowRoot.addEventListener('click', clickHandler);

    return () => {
      shadowRoot.removeEventListener('click', clickHandler);
    };
  }

  //Handle text selection inside Shadow DOM
  handleSelection(shadowRoot: ShadowRoot): () => void {
    const selectionHandler = () => {
      this.highlightSelected(shadowRoot);
    };

    shadowRoot.addEventListener('mouseup', selectionHandler);
    shadowRoot.addEventListener('keyup', selectionHandler); // for keyboard selection

    return () => {
      shadowRoot.removeEventListener('mouseup', selectionHandler);
      shadowRoot.removeEventListener('keyup', selectionHandler);
    };
  }

  //Helper functions for next/prev buttons
  getDataIdElements(shadowRoot: ShadowRoot): HTMLElement[] {
    return Array.from(shadowRoot.querySelectorAll<HTMLElement>('[data-id]'));
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


  public lastSelection: SelectionTypes = { count: 1, startId: null, endId: null };

  highlightSelected(shadowRoot: ShadowRoot): void {
    //NOTE: window.getSelection() seems limited to text in shadowdom so extra checks needed to match with actual shadowdom elements
    const selection = window.getSelection();
    if (!shadowRoot || !selection) { this.lastSelection = { count: 0, startId: null, endId: null }; return }; //reset lastSelection

    const selectedText = normalize(selection.toString());
    if (!selectedText) return; //no change to lastSelection

    //Step 1: Throw error if selected text not unique
    try {
      this.clearHighlights(shadowRoot);
      findSelectionInShadow(shadowRoot, selectedText); //throws error if not unique
      //Step 2: Find best match      
      const dataIdElements = this.getDataIdElements(shadowRoot);
      // All matches
      const matches = dataIdElements
        .map(element => {
          const text = normalize(element.textContent || "");
          return {
            element,
            dataId: parseInt(element.getAttribute("data-id") || "0"),
            text,
            textLength: text.length
          };
        })
        .filter(item => item.text && selectedText.includes(item.text));

      if (matches.length === 0) {
        throw new Error("No diffs found in selected text.");
      }
      console.log('All matches:', matches.map(m => `${m.dataId}: "${m.text}"`));

      // Best match = longest match
      let bestMatch = matches.reduce((prev, current) =>
        current.textLength > prev.textLength ? current : prev
      );
      console.log(`Initial best match: data-id="${bestMatch.dataId}", text: "${bestMatch.text}" (${bestMatch.textLength} chars)`);

      // Handle short best match
      if (bestMatch.text.length <= 20) {
        console.log("Selected text: ", selectedText);
        const expanded = expandBestMatch(bestMatch.element, selectedText.length, 3);
        if (!selectedText.includes(expanded)) {
          console.log("Initial best match was wrong, checking others.");
          console.log("EXPANDED SHADOWDOM TEXT")
          console.log(expanded)
          const sortedMatches = matches.sort((a, b) => b.textLength - a.textLength);
          let found = false;
          console.log(sortedMatches)
          for (const possibleMatch of sortedMatches) {
            const expanded = expandBestMatch(possibleMatch.element, selectedText.length, 3);
            console.log("Checking: ", expanded);
            if (selectedText.includes(expanded)) {
              bestMatch = possibleMatch;
              found = true;
              console.log(`New best match: data-id="${bestMatch.dataId}", text: "${bestMatch.text}" (${bestMatch.textLength} chars)`);
              console.log("EXPANDED SHADOWDOM TEXT")
              console.log(expanded)
              break;
            }
          }
          if (!found) { throw new Error("No expanded matches match the selected text."); }
        }
      }

      // Get continuous range of matches
      const matchedDataIds = new Set(matches.map(m => m.dataId));
      let startId = bestMatch.dataId;
      let endId = bestMatch.dataId;

      // Current best match
      let finalText = checkRange(shadowRoot, startId, endId);

      // Expand left
      while (startId > 0) {
        const includeText = checkRange(shadowRoot, startId - 1, endId);
        if (includeText) {
          startId--;
          finalText = includeText;
        } else {
          break;
        }
      }

      // Expand right
      while (true) {
        const includeText = checkRange(shadowRoot, startId, endId + 1);
        if (includeText) {
          endId++;
          finalText = includeText;
        } else {
          break;
        }
      }

      // Final range
      console.log(`Final match between ${startId} and ${endId}:`, finalText);

      // Step 3: Highlight the range
      let highlightedCount = 0;
      const elementById = Object.fromEntries(dataIdElements.map(el => [parseInt(el.getAttribute('data-id') || '0'), el]));
      for (let id = startId; id <= endId; id++) {
        if (matchedDataIds.has(id)) {
          const element = elementById[id];
          if (element) {
            element.classList.add('highlight');
            highlightedCount++;
          }
        }
      }
      console.log(`Highlighted ${highlightedCount} elements from data-id ${startId} to ${endId}`);

      this.lastSelection = { count: highlightedCount, startId: startId, endId: endId };
      return;

    } catch (err) {
      console.error(err);
      this.lastSelection = { count: 0, startId: null, endId: null }; //nothing selected
      return;
    }

    /********************
     * HELPER FUNCTIONS *
     ********************/

    //Normalizes a string of text
    function normalize(text: string): string {
      return text.replace(/\s+/g, " ").trim();
    }

    //Extracts text-only from shadow dom
    function extractShadowText(shadowRoot: ShadowRoot): string {

      const walker = document.createTreeWalker(shadowRoot, NodeFilter.SHOW_TEXT, null);
      let text = "";

      let node: Node | null = walker.nextNode();
      while (node) {
        text += node.textContent || "";
        node = walker.nextNode();
      }

      return normalize(text);
    }

    //Checks if selected text is unique in shadow dom
    function findSelectionInShadow(shadowRoot: ShadowRoot, selectedText: string): number {
      const shadowText = extractShadowText(shadowRoot);

      if (!selectedText) return -1;

      const idx = shadowText.indexOf(selectedText);

      //No match
      if (idx === -1) {
        throw new Error("Selection not found in shadowDOM."); //should never appear
      }
      //2nd match
      const secondIdx = shadowText.indexOf(selectedText, idx + 1);
      if (secondIdx !== -1) {
        throw new Error("Selected text is not unique in shadowDOM.");
      }
      //Unique match position
      return idx;
    }

    function checkRange(root: ParentNode, startId: number, endId: number): string | null {
      const startEl = root.querySelector(`[data-id="${startId}"]`);
      const endEl = root.querySelector(`[data-id="${endId}"]`);

      if (!startEl || !endEl) {
        return null;
      }

      // Create a range of text from start element to end element
      const range = document.createRange();
      range.setStartBefore(startEl);
      range.setEndAfter(endEl);
      const rangeText = normalize(range.toString());

      // Check if range is in the selected text
      return selectedText.includes(rangeText) ? rangeText : null;
    }

    //Include text on either side of match to confirm accuracy
    function expandBestMatch(element: HTMLElement, maxLength: number, chars = 5): string {
      let text = normalize(element.textContent || "");
      // If already longer than maxLength, just trim
      if (text.length >= maxLength) return text.slice(0, maxLength);

      // Expand backwards into previous text
      let remaining = Math.min(chars, maxLength - text.length);
      let prevNode: Node | null = element.previousSibling;
      while (remaining > 0 && prevNode) {
        if (prevNode.nodeType === Node.TEXT_NODE) {
          const slice = prevNode.textContent?.slice(-remaining) || "";
          text = joinStrings(slice, text);
          remaining -= slice.length;
        }
        prevNode = prevNode.previousSibling;
      }

      // Expand forwards into next text
      remaining = Math.min(chars, maxLength - text.length);
      let nextNode: Node | null = element.nextSibling;
      while (remaining > 0 && nextNode) {
        if (nextNode.nodeType === Node.TEXT_NODE) {
          const slice = nextNode.textContent?.slice(0, remaining) || "";
          text = joinStrings(text, slice);
          remaining -= slice.length;
        }
        nextNode = nextNode.nextSibling;
      }

      // Confirm final length is less than selection
      if (text.length > maxLength) {
        text = text.slice(0, maxLength);
      }

      return normalize(text);
    }

    function joinStrings(left: string, right: string): string {
      if (!left) return right;
      if (!right) return left;

      const l = left[left.length - 1]; //last char
      const r = right[0]; //first char

      if (/\s/.test(l) || /\s/.test(r) || /[.,!?;:)]/.test(r)) {
        return left + right;
      }
      return left + " " + right;
    }

  }
}