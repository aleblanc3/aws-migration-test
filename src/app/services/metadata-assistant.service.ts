import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, map, retry, delay, timeout, switchMap } from 'rxjs/operators';
import { ApiKeyService } from './api-key.service';

export interface MetadataResult {
  url: string;
  scrapedContent: string;
  metaDescription: string;
  metaKeywords: string;
  frenchTranslatedDescription?: string;
  frenchTranslatedKeywords?: string;
  language: 'en' | 'fr';
}

export interface ProcessingOptions {
  urls: string[];
  model: string;
  translateToFrench: boolean;
}

// Allowed hosts that support CORS - same as page assistant
const ALLOWED_HOSTS = new Set([
  'cra-design.github.io',
  'cra-proto.github.io',
  'gc-proto.github.io',
  'test.canada.ca',
  'www.canada.ca'
]);

@Injectable({
  providedIn: 'root'
})
export class MetadataAssistantService {
  private readonly OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly SCRAPING_TIMEOUT = 30000; // 30 seconds
  private readonly API_TIMEOUT = 60000; // 60 seconds
  private readonly TRANSLATION_TIMEOUT = 90000; // 90 seconds with retry

  constructor(
    private http: HttpClient,
    private apiKeyService: ApiKeyService
  ) {}

  processUrls(options: ProcessingOptions): Observable<MetadataResult[]> {
    const results: MetadataResult[] = [];
    
    return from(options.urls).pipe(
      switchMap(url => this.processUrl(url, options.model, options.translateToFrench)),
      map(result => {
        results.push(result);
        return results;
      }),
      catchError(error => {
        console.error('Error processing URLs:', error);
        return throwError(() => error);
      })
    );
  }

  private processUrl(url: string, model: string, translateToFrench: boolean): Observable<MetadataResult> {
    return this.scrapeUrl(url).pipe(
      switchMap(scrapedContent => {
        if (!scrapedContent || scrapedContent.length < 50) {
          return throwError(() => new Error('Content too short or invalid for processing'));
        }

        const language = this.detectLanguage(scrapedContent);
        
        return this.generateMetadata(scrapedContent, model, language).pipe(
          switchMap(metadata => {
            const result: MetadataResult = {
              url,
              scrapedContent,
              metaDescription: metadata.description,
              metaKeywords: metadata.keywords,
              language
            };

            if (translateToFrench && language === 'en') {
              return this.translateMetadata(metadata).pipe(
                map(translated => ({
                  ...result,
                  frenchTranslatedDescription: translated.description,
                  frenchTranslatedKeywords: translated.keywords
                }))
              );
            }

            return of(result);
          })
        );
      })
    );
  }

  private scrapeUrl(url: string): Observable<string> {
    // Validate URL against allowed hosts (same as page assistant)
    try {
      const parsedUrl = new URL(url);
      if (!ALLOWED_HOSTS.has(parsedUrl.host)) {
        return throwError(() => new Error(
          `Host not allowed: ${parsedUrl.host}. Only government domains are supported.`
        ));
      }
    } catch (error) {
      return throwError(() => new Error('Invalid URL format'));
    }

    // Fetch with cache busting like page assistant
    return from(fetch(`${url}?_=${Date.now()}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache'
    })).pipe(
      timeout(this.SCRAPING_TIMEOUT),
      switchMap(response => {
        if (!response.ok) {
          throw new Error(`Failed to fetch URL: HTTP ${response.status}`);
        }
        return from(response.text());
      }),
      map(html => this.extractTextContent(html)),
      catchError(error => {
        console.error('Error scraping URL:', error);
        if (error.message.includes('Host not allowed')) {
          return throwError(() => error);
        }
        return throwError(() => new Error(
          `Failed to scrape URL: ${error.message || 'Unknown error'}`
        ));
      })
    );
  }

  private extractTextContent(html: string): string {
    // Parse HTML using DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Find main element - matching Python's _find_main_element logic
    let mainElement = this.findMainElement(doc);

    if (!mainElement) {
      console.warn('No main element found in page, attempting fallback to body content');
      // Fallback: try to extract content from body
      mainElement = doc.body;
      if (!mainElement) {
        console.error('No body element found in page');
        return '';
      }
    }

    // Clone to avoid modifying original
    const contentElement = mainElement.cloneNode(true) as HTMLElement;

    // Remove unwanted elements - matching Python's unwanted_sections
    const unwantedClasses = [
      'provisional most-requested-bullets well well-sm brdr-0',
      'pagedetails container',
      'lnkbx',
      'pagedetails',
      'gc-prtts',
      'alert alert-info',
      'footer',
      'nav',
      'header',
      'aside'
    ];

    // Remove by class name (Python lines 128-131)
    unwantedClasses.forEach(className => {
      contentElement.querySelectorAll(`.${className.replace(/ /g, '.')}`).forEach(el => el.remove());
    });

    // Remove by tag name (Python lines 134-137)
    ['footer', 'nav', 'header', 'aside'].forEach(tagName => {
      contentElement.querySelectorAll(tagName).forEach(el => el.remove());
    });

    // Remove "On this page" navigation and mark the section
    contentElement.querySelectorAll('h2.h3').forEach(h2 => {
      const text = h2.textContent || '';
      if (text.includes('On this page:') || text.includes('Sur cette page :')) {
        const nextSibling = h2.nextElementSibling;
        if (nextSibling && nextSibling.tagName === 'UL') {
          // Mark all li elements in this UL as part of "On this page" section
          nextSibling.querySelectorAll('li').forEach(li => {
            li.setAttribute('data-on-this-page', 'true');
          });
          nextSibling.remove();
        }
        h2.remove();
      }
    });

    // Also mark any li elements that are direct children of "On this page" type navigation
    contentElement.querySelectorAll('h2').forEach(h2 => {
      const text = h2.textContent || '';
      if (text.includes('On this page') || text.includes('Sur cette page')) {
        let nextElement = h2.nextElementSibling;
        while (nextElement && nextElement.tagName === 'UL') {
          nextElement.querySelectorAll('li').forEach(li => {
            li.setAttribute('data-on-this-page', 'true');
          });
          nextElement = nextElement.nextElementSibling;
        }
      }
    });

    // Extract text from allowed elements - now including li tags
    const allowedTags = ['h1', 'h2', 'h3', 'h4', 'p', 'li'];
    const textContent: string[] = [];

    allowedTags.forEach(tag => {
      contentElement.querySelectorAll(tag).forEach(element => {
        // Skip chat elements (Python lines 153-154)
        if (tag === 'h2') {
          const text = element.textContent || '';
          if (text.includes('Chat with Charlie') || text.includes('Clavardez avec Charlie')) {
            return;
          }
        }
        
        // Skip li elements that are part of "On this page" navigation
        if (tag === 'li' && element.hasAttribute('data-on-this-page')) {
          return;
        }
        
        const text = element.textContent?.trim();
        if (text && text.length > 0) {  // Only add non-empty text
          textContent.push(text);
        }
      });
    });

    // Join with space and truncate to 2500 characters
    const fullText = textContent.join(' ');
    
    // Log extraction details for debugging
    console.log(`Extracted ${fullText.length} characters of content`);
    if (fullText.length < 100) {
      console.warn(`Very short content extracted: '${fullText}'`);
    } else if (fullText.length > 2500) {
      console.log(`Content truncated from ${fullText.length} to 2500 characters`);
    }
    
    return fullText.substring(0, 2500);
  }

  private findMainElement(doc: Document): Element | null {
    // Matching Python's main_selectors (lines 83-88)
    const mainSelectors = [
      'main[property="mainContentOfPage"][resource="#wb-main"][typeof="WebPageElement"]',
      'main[property="mainContentOfPage"][resource="#wb-main"][typeof="WebPageElement"].col-md-9.col-md-push-3',
      'main[role="main"][property="mainContentOfPage"].container',
      'main[role="main"][property="mainContentOfPage"]'
    ];

    // Try each selector (Python lines 90-99)
    for (const selector of mainSelectors) {
      const element = doc.querySelector(selector);
      if (element) {
        // Check for container div inside (Python lines 94-98)
        const isLastSelector = selector === mainSelectors[mainSelectors.length - 1];
        if (isLastSelector) {
          const containerDiv = element.querySelector('div.container');
          if (containerDiv) {
            console.log('Found main element with container div inside');
            return containerDiv;
          }
        }
        return element;
      }
    }

    // Generic fallback (Python lines 101-109)
    const mainElement = doc.querySelector('main[role="main"]');
    if (mainElement) {
      console.log('Found main element using generic selector');
      const containerDiv = mainElement.querySelector('div.container');
      if (containerDiv) {
        console.log('Found container div inside main element');
        return containerDiv;
      }
      return mainElement;
    }

    // Additional fallback: try just a plain <main> tag
    const plainMain = doc.querySelector('main');
    if (plainMain) {
      console.log('Found plain main element');
      const containerDiv = plainMain.querySelector('div.container');
      if (containerDiv) {
        console.log('Found container div inside plain main element');
        return containerDiv;
      }
      return plainMain;
    }

    // Last resort: try to find any element with role="main"
    const roleMain = doc.querySelector('[role="main"]');
    if (roleMain) {
      console.log('Found element with role="main"');
      return roleMain;
    }

    return null;
  }

  private detectLanguage(content: string): 'en' | 'fr' {
    // Simple language detection based on common French words
    const frenchIndicators = [
      'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une',
      'et', 'ou', 'mais', 'pour', 'avec', 'sans', 'sur',
      'dans', 'par', 'que', 'qui', 'quoi', 'dont', 'où'
    ];

    const words = content.toLowerCase().split(/\s+/);
    const frenchWordCount = words.filter(word => frenchIndicators.includes(word)).length;
    const frenchRatio = frenchWordCount / Math.max(words.length, 1);

    return frenchRatio > 0.05 ? 'fr' : 'en';
  }

  private generateMetadata(content: string, model: string, language: 'en' | 'fr'): Observable<{description: string, keywords: string}> {
    const apiKey = this.apiKeyService.getCurrentKey();
    if (!apiKey) {
      return throwError(() => new Error('API key not configured'));
    }

    // Generate description
    const descriptionPrompt = language === 'en' 
      ? `As a search engine optimization expert, analyze the following content carefully and provide a concise, complete summary suitable for a meta description in English. The summary MUST be highly relevant to the specific content provided and capture its main topic and purpose. Use topic-specific terms found in the content, write in full sentences, and ensure the summary ends concisely within 275 characters. IMPORTANT: Provide ONLY the meta description itself with NO additional commentary or explanations.\n\n${content}\n\nSummary:`
      : `En tant qu'expert en référencement, analysez attentivement le contenu suivant et fournissez un résumé concis et complet adapté à une méta-description en français. Le résumé DOIT être parfaitement adapté au contenu spécifique fourni. Utilisez des termes spécifiques au sujet, écrivez en phrases complètes, et assurez-vous que le résumé se termine de manière concise dans les 275 caractères. IMPORTANT: Fournissez UNIQUEMENT la méta-description elle-même SANS commentaire supplémentaire.\n\n${content}\n\nRésumé:`;

    const keywordsPrompt = language === 'en'
      ? `As a search engine optimization expert, carefully analyze the following content and identify 10 meaningful, topic-specific meta keywords that are DIRECTLY EXTRACTED from or strongly implied by the content. IMPORTANT: Return ONLY a comma-separated list of keywords with absolutely NO additional notes or commentary. Exclude 'Canada Revenue Agency' from the keywords.\n\n${content}\n\nKeywords:`
      : `En tant qu'expert en optimisation pour les moteurs de recherche, analysez attentivement le contenu suivant et identifiez 10 mots-clés méta significatifs qui sont DIRECTEMENT EXTRAITS du contenu. IMPORTANT: Retournez UNIQUEMENT une liste de mots-clés séparés par des virgules sans AUCUNE note supplémentaire. Excluez 'Agence du revenu du Canada' des mots-clés.\n\n${content}\n\nMots-clés:`;

    return this.callOpenRouter(descriptionPrompt, model, 200).pipe(
      switchMap(description => {
        return this.callOpenRouter(keywordsPrompt, model, 100).pipe(
          map(keywords => ({
            description: this.cleanMetadataResponse(description),
            keywords: this.cleanKeywordsResponse(keywords)
          }))
        );
      })
    );
  }

  private translateMetadata(metadata: {description: string, keywords: string}): Observable<{description: string, keywords: string}> {
    const apiKey = this.apiKeyService.getCurrentKey();
    if (!apiKey) {
      return throwError(() => new Error('API key not configured'));
    }

    // Use Mistral Small for translation (same as image-assistant)
    const translationModel = 'mistralai/mistral-small:free';

    const descriptionPrompt = `You are a professional translator specializing in Canadian government content. Translate the following English meta description to French, maintaining the formal tone used by the Canada Revenue Agency (CRA). 

Important CRA-specific terminology:
- "Canada Revenue Agency" → "Agence du revenu du Canada"
- "income tax" → "impôt sur le revenu"
- "benefits" → "prestations"
- "tax return" → "déclaration de revenus"
- "GST/HST" → "TPS/TVH"
- "business number" → "numéro d'entreprise"
- "tax credit" → "crédit d'impôt"
- "deduction" → "déduction"
- "tax-free savings account (TFSA)" → "compte d'épargne libre d'impôt (CELI)"
- "registered retirement savings plan (RRSP)" → "régime enregistré d'épargne-retraite (REER)"

IMPORTANT: Your response must contain ONLY the direct translation, with absolutely NO commentary, NO suggestions, NO explanations, and NO additional text of any kind. Return ONLY the translated text itself:

${metadata.description}

French translation:`;

    const keywordsPrompt = `Translate each of these English keywords to French. IMPORTANT: Return ONLY the translated keywords in a comma-separated list. Provide absolutely NO commentary, NO suggestions, NO explanations, and NO additional text of any kind. Return ONLY a comma-separated list of the translated keywords:

${metadata.keywords}

French keywords (comma-separated):`;

    return this.callOpenRouter(descriptionPrompt, translationModel, 200, this.TRANSLATION_TIMEOUT).pipe(
      retry({ count: 1, delay: 2000 }), // Retry once after 2 seconds for cold starts
      switchMap(description => {
        return this.callOpenRouter(keywordsPrompt, translationModel, 100, this.TRANSLATION_TIMEOUT).pipe(
          retry({ count: 1, delay: 2000 }),
          map(keywords => ({
            description: this.cleanMetadataResponse(description),
            keywords: this.cleanKeywordsResponse(keywords)
          }))
        );
      })
    );
  }

  private callOpenRouter(prompt: string, model: string, maxTokens: number, timeoutMs: number = this.API_TIMEOUT): Observable<string> {
    const apiKey = this.apiKeyService.getCurrentKey();
    if (!apiKey) {
      return throwError(() => new Error('API key not configured'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://content-assistant.app',
      'X-Title': 'Content Assistant'
    });

    const payload = {
      model: model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.3
    };

    return this.http.post<any>(this.OPENROUTER_URL, payload, { headers }).pipe(
      timeout(timeoutMs),
      map(response => {
        if (response.choices && response.choices[0]?.message?.content) {
          return response.choices[0].message.content;
        }
        throw new Error('Invalid response from API');
      }),
      catchError(error => {
        console.error('OpenRouter API error:', error);
        return throwError(() => new Error('Failed to generate content'));
      })
    );
  }

  private cleanMetadataResponse(response: string): string {
    let cleaned = response.trim();

    // Remove quotes if present
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }

    // Remove common prefixes
    const prefixes = [
      'Here is a summary:', 'Summary:', 'Meta description:',
      'Voici un résumé:', 'Résumé:', 'Méta-description:',
      'French translation:', 'Translation:'
    ];

    for (const prefix of prefixes) {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }

    // Truncate to 275 characters if needed
    if (cleaned.length > 275) {
      const lastPeriod = cleaned.lastIndexOf('.', 275);
      if (lastPeriod > 200) {
        cleaned = cleaned.substring(0, lastPeriod + 1);
      } else {
        cleaned = cleaned.substring(0, 275);
      }
    }

    return cleaned;
  }

  private cleanKeywordsResponse(response: string): string {
    let cleaned = response.trim();

    // Remove quotes if present
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }

    // Remove common prefixes
    const prefixes = [
      'Keywords:', 'Here are the keywords:', 'Meta keywords:',
      'Mots-clés:', 'Voici les mots-clés:', 'French keywords:'
    ];

    for (const prefix of prefixes) {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }

    // Clean up the keywords list
    const keywords = cleaned.split(',').map(k => k.trim()).filter(k => k.length > 0);
    return keywords.join(', ');
  }
}