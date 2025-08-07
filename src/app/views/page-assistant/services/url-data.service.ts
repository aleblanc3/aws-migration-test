import { Injectable } from '@angular/core';
import { sampleHtmlO, sampleHtmlM, sampleSnippetO, sampleSnippetM, sampleWordO, sampleWordM } from '../components/sample-data';
import { UploadData } from '../../../common/data.types'
import { UploadStateService } from './upload-state.service';
//import prettier from 'prettier/standalone';
import * as parserHtml from 'prettier/parser-html';

@Injectable({
  providedIn: 'root'
})
export class UrlDataService {

  constructor(private uploadState: UploadStateService) { }

  //Block unknown hosts
  private allowedHosts = new Set([
    "cra-design.github.io",
    "cra-proto.github.io",
    "gc-proto.github.io",
    "test.canada.ca",
    "www.canada.ca"
  ]);

  /** Gets HTML content from a URL and processes it. 
    * Note: remove type later if it isn't needed */

  async fetchAndProcess(url: string): Promise<string> {
    const parsedUrl = new URL(url);

    //Check if host is allowed
    if (!this.allowedHosts.has(parsedUrl.host)) {
      throw new Error(`${parsedUrl.host} is blocked`);
    }

    //Get HTML content
    const response = await fetch(`${url}?_=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`Fetch failed: HTTP ${response.status}`);
    }
    console.warn(`Response code: ${response.status}`);

    const html = await response.text();

    //Process HTML and return main element
    return this.extractContent(html);

  }

  //Runs all clean-up functions (might need to add type for full html document from url vs. snippet from copy/paste)
  async extractContent(html: string): Promise<string> {
    const doc = new DOMParser().parseFromString(html, 'text/html');

    //process HTML
    await this.processAjaxReplacements(doc);
    await this.processJsonReplacements(doc);
    this.processModalDialogs(doc);
    this.updateRelativeURLs(doc, "https://www.canada.ca");
    this.cleanupUnnecessaryElements(doc);
    this.displayInvisibleElements(doc);
    this.addToc(doc);

    // Return main content
    const main = doc.querySelector('main');
    if (!main) {
      console.warn('No <main> tag found. Using full <body> content instead.');
    }
    const content = main ? main.outerHTML : doc.body.innerHTML.trim();
    return await this.formatHtml(content);
  }

  //START OF CLEAN-UP FUNCTIONS

  //Prettier HTML
  async formatHtml(html: string, source?: 'url' | 'paste' | 'word' | 'ai'): Promise<string> {
    try {
      const { default: prettier } = await import('prettier/standalone');
      if (source === 'word') {
        // Wrap in <main>
        html = `<main  property="mainContentOfPage" resource="#wb-main" typeof="WebPageElement" class="container">${html}</main>`;

        // Apply replacements
        html = html
          .replace('<h1>', '<h1 property="name" id="wb-cont" dir="ltr">')
          .replace('<table>', '<table class="wb-tables table table-striped">');
      }
      // Wrap in <body>
      if (source !== 'ai') {
        html = `<body vocab="http://schema.org/" typeof="WebPage" resource="#wb-webpage" class=" cnt-wdth-lmtd">${html}</body>`;
      }
      if (source === 'ai') {
        html = this.aiCleanup(html);
      }

      //const [{ default: prettier }, parserHtml] = await Promise.all([
      //  import('prettier/standalone'),
      //  import('prettier/parser-html'),
      //]);
      const formatted = prettier.format(html, {
        parser: 'html',
        plugins: [parserHtml],
        htmlWhitespaceSensitivity: 'ignore', // default is css which treats <span> as inline and <div> as block
      });
      return formatted;
    } catch (error) {
      console.error('Error formatting HTML:', error);
      return html; // returns unformatted HTML
    }
  }

  //Clean AI-generated HTML
  private aiCleanup(html: string): string {
    // Handle cases where ``` appears inside <p> tags
    html = html.replace(/<p>```html<\/p>/, '```html\n').replace(/<p>```<\/p>/, '\n```');
    // Extract content inside triple backticks if they exist
    const match = html.match(/```(?:html)?\r?\n([\s\S]*?)\r?\n```/);
    if (match) {
      html = match[1]; // Capture only the inner content
    }

    // Trim leading and trailing <p> and </p> tags
    html = html.replace(/^<p>/, '').replace(/<\/p>$/, '').trim();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll("p").forEach(p => {
      let children = p.children;
      // If the <p> only contains one block-level element, unwrap it
      if (children.length === 1 && children[0].matches("div, section, ul, ol, table, h1, h2, h3, h4, h5, h6")) {
        p.replaceWith(...p.childNodes);
      }
    });
    // Remove empty <p> tags
    doc.querySelectorAll("p").forEach(p => {
      if (p.innerHTML.trim() === "") {
        p.remove();
      }
    });
    // Return the cleaned-up HTML as a string
    return doc.body.outerHTML;
  }

  //Resolve AJAX-loaded content
  private async processAjaxReplacements(doc: Document): Promise<void> {
    const baseUrl = 'https://www.canada.ca';

    const fetchUrl = async (url: string, type: 'json' | 'text'): Promise<any> => {
      try {
        const response = await fetch(url);
        return type === 'json' ? response.json() : response.text();
      } catch (error) {
        console.error(`Error fetching URL: ${url}`, error);
        return type === 'json' ? {} : '';
      }
    };

    const processElements = async (): Promise<void> => {
      const ajaxElements = doc.querySelectorAll(
        '[data-ajax-replace^="/"], [data-ajax-after^="/"], [data-ajax-append^="/"], [data-ajax-before^="/"], [data-ajax-prepend^="/"]'
      );

      if (!ajaxElements.length) return;

      for (const element of ajaxElements) {
        const tag = element.tagName.toLowerCase();
        const attributes = element.attributes;

        for (let i = 0; i < attributes.length; i++) {
          const attr = attributes[i];
          const attrName = attr.name;
          const ajaxUrl = attr.value;

          if (!attrName.startsWith('data-ajax-') || !ajaxUrl.startsWith('/')) {
            continue;
          }

          const [url, anchor] = ajaxUrl.split('#');
          const fullUrl = `${baseUrl}${url}`;
          const fetchedHtml = await fetchUrl(fullUrl, 'text');

          if (!fetchedHtml) continue;

          const ajaxDoc = new DOMParser().parseFromString(fetchedHtml, 'text/html');

          let content: string;
          if (anchor) {
            const anchorElement = ajaxDoc.querySelector(`#${anchor}`);
            content = anchorElement ? anchorElement.outerHTML : '';
          } else {
            const isFullDoc = /<html[\s>]/i.test(fetchedHtml) && /<body[\s>]/i.test(fetchedHtml);
            if (isFullDoc) {
              console.warn(`Skipping full document injection from: ${fullUrl}`);
              continue;
            }
            content = ajaxDoc.body ? ajaxDoc.body.innerHTML : ajaxDoc.documentElement.innerHTML;
          }

          if (!content) continue;

          const styledContent = `
          <div style="border: 3px dashed #fbc02f; padding: 8px; border-radius: 4px;">
            <${tag}>${content}</${tag}>
          </div>
        `;

          element.outerHTML = styledContent;
        }
      }
    };

    // Keep processing until no more AJAX elements are found (handles nested AJAX)
    let previousCount: number;
    let currentCount = 0;

    do {
      previousCount = currentCount;
      await processElements();
      currentCount = doc.querySelectorAll(
        '[data-ajax-replace^="/"], [data-ajax-after^="/"], [data-ajax-append^="/"], [data-ajax-before^="/"], [data-ajax-prepend^="/"]'
      ).length;
    } while (currentCount && currentCount !== previousCount);
  }

  //Resolve JSON-loaded content

  private async processJsonReplacements(doc: Document): Promise<void> {
    const baseUrl = 'https://www.canada.ca';

    const fetchUrl = async (url: string, type: 'json' | 'text'): Promise<any> => {
      try {
        const response = await fetch(url);
        return type === 'json' ? response.json() : response.text();
      } catch (error) {
        console.error(`Error fetching URL: ${url}`, error);
        return type === 'json' ? {} : '';
      }
    };

    const parseJsonUrl = (url: string): { url: string; jsonKey: string } => {
      const [baseUrl, jsonKey = ''] = url.split('#');
      return { url: baseUrl, jsonKey: jsonKey.slice(1) };
    };

    const parseJsonConfig = (config: string): Record<string, any> | null => {
      try {
        return JSON.parse(config.replace(/&quot;/g, '"'));
      } catch (error) {
        console.error('Error parsing JSON config:', error);
        return null;
      }
    };

    const resolveJsonPath = (obj: any, path: string): any => {
      return path
        .split('/')
        .reduce(
          (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
          obj,
        );
    };

    const jsonElements = doc.querySelectorAll('[data-wb-jsonmanager]');
    if (!jsonElements.length) return;

    const jsonDataMap = new Map<string, any>();

    // Process all JSON manager elements and fetch their data
    await Promise.all(
      Array.from(jsonElements).map(async (element) => {
        const jsonConfigAttr = element.getAttribute('data-wb-jsonmanager');
        if (!jsonConfigAttr) return;

        const jsonConfig = parseJsonConfig(jsonConfigAttr);
        if (!jsonConfig?.['url'] || !jsonConfig?.['name']) return;

        const { url, jsonKey } = parseJsonUrl(jsonConfig['url']);
        const fullUrl = `${baseUrl}${url}`;

        try {
          const jsonData = await fetchUrl(fullUrl, 'json');
          const content = resolveJsonPath(jsonData, jsonKey);
          jsonDataMap.set(jsonConfig['name'], content);
        } catch (error) {
          console.error(`Error fetching JSON for ${jsonConfig['name']}:`, error);
        }
      })
    );

    // Process all JSON replace elements
    const replaceElements = doc.querySelectorAll('[data-json-replace]');
    replaceElements.forEach((element) => {
      const replacePath = element.getAttribute('data-json-replace') || '';
      const match = replacePath.match(/^#\[(.*?)\](.*)$/);
      if (!match) return;

      const jsonName = match[1];
      const jsonPath = match[2].substring(1);

      if (!jsonDataMap.has(jsonName)) {
        console.warn(`No JSON data found for: ${jsonName}`);
        return;
      }

      const jsonData = jsonDataMap.get(jsonName);
      const content = resolveJsonPath(jsonData, jsonPath);

      const styledContent = `
      <div style="
        border: 3px dashed #fbc02f;
        padding: 8px;
        border-radius: 4px;
      "> 
        ${content} 
      </div>
    `;

      element.outerHTML = styledContent;
    });
  }



  //Remove irrelevent stuff
  private cleanupUnnecessaryElements(doc: Document): void {
    const noisySelectors = ['section#chat-bottom-bar', '#gc-pft', 'header', 'footer', 'charlie'];
    noisySelectors.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    });
  }

  //Reveal hidden stuff
  private displayInvisibleElements(doc: Document): void {
    const invisibleSelectors = ['.wb-inv', '.hidden', '.nojs-show'];
    invisibleSelectors.forEach(selector => {
      doc.querySelectorAll<HTMLElement>(selector).forEach(el => {
        el.classList.remove(...selector.split('.').filter(Boolean));
        el.style.border = '2px solid #6F9FFF'; // Visual cue
      });
    });
  }

  //Show modals FIX PADDING
  private processModalDialogs(doc: Document): void {
    const modals = doc.querySelectorAll('.modal-dialog.modal-content');
    modals.forEach(modal => {
      // Unhide if it has 'mfp-hide'
      modal.classList.remove('mfp-hide');
      // Wrap content in a styled <div>
      const wrapper = doc.createElement('div');
      wrapper.setAttribute(
        'style',
        'border: 2px dashed #666; padding: 8px; border-radius: 4px;'
      );
      // Move children into the wrapper
      while (modal.firstChild) {
        wrapper.appendChild(modal.firstChild);
      }
      modal.appendChild(wrapper);
    });
  }

  //Resolve relative URLs <-- make this work for canada.ca and github where the correct baseUrl is probably mydomain.ca

  private updateRelativeURLs(doc: Document, baseUrl: string): void {
    const anchors = doc.querySelectorAll<HTMLAnchorElement>('a');
    const images = doc.querySelectorAll<HTMLImageElement>('img');

    anchors.forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (href) {
        if (href.startsWith('/')) {
          anchor.setAttribute('href', `${baseUrl}${href}`);
          anchor.setAttribute('target', '_blank');
        } else if (/^(http|https):\/\//.test(href)) {
          anchor.setAttribute('target', '_blank');
        }
      }
    });

    images.forEach((img) => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('/')) {
        img.setAttribute('src', `${baseUrl}${src}`);
      }
    });
  }

  //Add ToC anchors
  private addToc(doc: Document): void {
    const tocSection = doc.querySelector('.section.mwsinpagetoc');
    if (!tocSection) return;

    // Extract TOC links and their data
    const tocLinks = Array.from(tocSection.querySelectorAll('a'))
      .map(link => {
        const href = link.getAttribute('href');
        const text = link.textContent?.trim();

        if (href?.startsWith('#') && text) {
          return {
            id: href.slice(1), // Remove the '#'
            text: text
          };
        }
        return null;
      })
      .filter(link => link !== null); // Remove null entries

    if (!tocLinks.length) return;

    // Match headings with TOC links and add IDs
    const headings = doc.querySelectorAll('h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      const headingText = heading.textContent?.trim();
      if (!headingText) return;

      const matchedLink = tocLinks.find(link => link.text === headingText);
      if (matchedLink) {
        heading.setAttribute('id', matchedLink.id);
      }
    });
  }

  //END OF CLEAN-UP FUNCTIONS

  //Start of sample data
  async loadSampleDataset(name: 'webpage' | 'snippet' | 'word' = 'webpage'): Promise<void> {
    let originalHtml: string;
    let modifiedHtml: string;

    switch (name) {
      case 'snippet':
        originalHtml = await this.extractContent(sampleSnippetO);
        modifiedHtml = await this.formatHtml(sampleSnippetM);
        break;

      case 'word':
        originalHtml = await this.formatHtml(sampleWordO, 'word');
        modifiedHtml = await this.formatHtml(sampleWordM, 'word');
        break;

      default:
        originalHtml = await this.extractContent(sampleHtmlO);
        modifiedHtml = await this.formatHtml(sampleHtmlM);
        break;
    }

    this.uploadState.setUploadData({
      originalUrl: `Original ${name}`,
      originalHtml,
      modifiedUrl: `Modified ${name}`,
      modifiedHtml,
    });
  }

}

