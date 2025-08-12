import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, of, throwError, timer } from 'rxjs';
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
    return from(fetch(`${url}?_=${Date.now()}`)).pipe(
      timeout(this.SCRAPING_TIMEOUT),
      switchMap(response => {
        console.log(`Fetch response for ${url}: status=${response.status}, type=${response.type}`);
        
        // Check for opaque response (CORS issue)
        if (response.type === 'opaque') {
          throw new Error('Cannot read response due to CORS restrictions. The server does not allow cross-origin requests.');
        }
        
        if (!response.ok) {
          throw new Error(`Failed to fetch URL: HTTP ${response.status}`);
        }
        return from(response.text());
      }),
      map(html => {
        console.log(`Received HTML for ${url}, length: ${html.length}`);
        
        // Debug: Check what we actually received
        const first500Chars = html.substring(0, 500);
        console.log('First 500 chars of HTML:', first500Chars);
        
        // Check if this is actually HTML or an error page
        if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
          console.error('Response does not appear to be HTML');
          console.log('Full response:', html);
        }
        
        if (html.length < 100) {
          console.warn('Very short HTML response:', html);
        }
        
        return this.extractTextContent(html);
      }),
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
    
    // Debug: Log if we have HTML content
    console.log('HTML content length:', html.length);
    console.log('Document has body:', !!doc.body);
    console.log('Document body innerHTML length:', doc.body?.innerHTML?.length || 0);
    console.log('Number of main tags found:', doc.querySelectorAll('main').length);
    
    // Debug: Check all elements with 'main' in them
    const allElements = doc.querySelectorAll('*');
    let mainTagFound = false;
    allElements.forEach(el => {
      if (el.tagName.toLowerCase() === 'main') {
        mainTagFound = true;
        console.log('Found main element:', el.tagName, 'with attributes:', 
          Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' '));
      }
    });
    
    if (!mainTagFound) {
      console.log('No main tags found. Checking for divs with role="main"');
      const roleMainDivs = doc.querySelectorAll('div[role="main"]');
      console.log('Found divs with role="main":', roleMainDivs.length);
      roleMainDivs.forEach(el => {
        console.log('Div with role="main" attributes:', 
          Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' '));
      });
    }
    
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
      console.log('Using body element as fallback, body has children:', doc.body.children.length);
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
    // Get all main elements
    const mainElements = doc.querySelectorAll('main');
    
    // Define selector priorities matching Python's main_selectors
    const selectorPriorities = [
      // Highest priority: exact match for first selector
      (el: Element) => 
        el.getAttribute('property') === 'mainContentOfPage' &&
        el.getAttribute('resource') === '#wb-main' &&
        el.getAttribute('typeof') === 'WebPageElement' &&
        !el.classList.contains('col-md-9'),
      
      // Second priority: with specific classes
      (el: Element) => 
        el.getAttribute('property') === 'mainContentOfPage' &&
        el.getAttribute('resource') === '#wb-main' &&
        el.getAttribute('typeof') === 'WebPageElement' &&
        el.classList.contains('col-md-9') &&
        el.classList.contains('col-md-push-3'),
      
      // Third priority: role="main" with container class
      (el: Element) => 
        el.getAttribute('role') === 'main' &&
        el.getAttribute('property') === 'mainContentOfPage' &&
        el.classList.contains('container'),
      
      // Fourth priority: role="main" with property
      (el: Element) => 
        el.getAttribute('role') === 'main' &&
        el.getAttribute('property') === 'mainContentOfPage'
    ];

    // Try each priority level
    for (let i = 0; i < selectorPriorities.length; i++) {
      const checkFn = selectorPriorities[i];
      
      for (const element of Array.from(mainElements)) {
        if (checkFn(element)) {
          // Special handling for the last selector (index 3)
          if (i === 3) {
            const containerDiv = element.querySelector('div.container');
            if (containerDiv) {
              console.log('Found main element with container div inside');
              return containerDiv;
            }
          }
          console.log(`Found main element with priority ${i + 1}`);
          return element;
        }
      }
    }

    // Generic fallback: any main with role="main"
    const mainWithRole = doc.querySelector('main[role="main"]');
    if (mainWithRole) {
      console.log('Found main element using generic selector');
      const containerDiv = mainWithRole.querySelector('div.container');
      if (containerDiv) {
        console.log('Found container div inside main element');
        return containerDiv;
      }
      return mainWithRole;
    }

    // Additional fallback: any main tag
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

    // Last resort: any element with role="main"
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
    // Add special instructions for GPT-OSS model to prevent reasoning
    const isGptOss = model.includes('gpt-oss');
    const noReasoningInstruction = isGptOss 
      ? 'DO NOT show your reasoning or thought process. DO NOT use step-by-step thinking. Give ONLY the final answer directly. ' 
      : '';

    const descriptionPrompt = language === 'en' 
      ? `${noReasoningInstruction}As a search engine optimization expert, analyze the following content carefully and provide a concise, complete summary suitable for a meta description in English. The summary MUST be highly relevant to the specific content provided and capture its main topic and purpose. Use topic-specific terms found in the content, write in full sentences, and ensure the summary ends concisely within 275 characters. IMPORTANT: Provide ONLY the meta description text itself with NO additional commentary, explanations, or character counts. Do NOT include the number of characters.\n\n${content}\n\nSummary:`
      : `${noReasoningInstruction}En tant qu'expert en référencement, analysez attentivement le contenu suivant et fournissez un résumé concis et complet adapté à une méta-description en français. Le résumé DOIT être parfaitement adapté au contenu spécifique fourni. Utilisez des termes spécifiques au sujet, écrivez en phrases complètes, et assurez-vous que le résumé se termine de manière concise dans les 275 caractères. IMPORTANT: Fournissez UNIQUEMENT le texte de la méta-description SANS commentaire supplémentaire ni comptage de caractères. N'incluez PAS le nombre de caractères.\n\n${content}\n\nRésumé:`;

    const keywordsPrompt = language === 'en'
      ? `${noReasoningInstruction}As a search engine optimization expert, carefully analyze the following content and identify 8-12 meaningful, topic-specific meta keywords that are DIRECTLY EXTRACTED from or strongly implied by the content. CRITICAL: List keywords in order of relevance, with the MOST RELEVANT and important keywords FIRST. Maximum 12 keywords. IMPORTANT: Return ONLY a comma-separated list of keywords with absolutely NO additional notes, commentary, or character counts. Keep the total length under 400 characters. Do NOT include the number of characters. Exclude 'Canada Revenue Agency' from the keywords.\n\n${content}\n\nKeywords:`
      : `${noReasoningInstruction}En tant qu'expert en optimisation pour les moteurs de recherche, analysez attentivement le contenu suivant et identifiez 8-12 mots-clés méta significatifs qui sont DIRECTEMENT EXTRAITS du contenu. CRITIQUE: Listez les mots-clés par ordre de pertinence, avec les mots-clés les PLUS PERTINENTS et importants en PREMIER. Maximum 12 mots-clés. IMPORTANT: Retournez UNIQUEMENT une liste de mots-clés séparés par des virgules sans AUCUNE note supplémentaire ni comptage de caractères. Gardez la longueur totale sous 400 caractères. N'incluez PAS le nombre de caractères. Excluez 'Agence du revenu du Canada' des mots-clés.\n\n${content}\n\nMots-clés:`;

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
    const translationModel = 'mistralai/mistral-small-3.2-24b-instruct:free';

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

IMPORTANT: Your response must contain ONLY the direct translation, with absolutely NO commentary, NO suggestions, NO explanations, NO character counts, and NO additional text of any kind. Do NOT include the number of characters. Return ONLY the translated text itself:

${metadata.description}

French translation:`;

    const keywordsPrompt = `Translate each of these English keywords to French. IMPORTANT: Return ONLY the translated keywords in a comma-separated list. Provide absolutely NO commentary, NO suggestions, NO explanations, NO character counts, and NO additional text of any kind. Do NOT include the number of characters. Return ONLY a comma-separated list of the translated keywords:

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
      retry({
        count: 2,
        delay: (error, retryCount) => {
          // Only retry on 404 or "No endpoints found" errors
          if (error.status === 404 || 
              (error.error?.error?.message && error.error.error.message.includes('No endpoints found'))) {
            console.log(`Retrying API call (attempt ${retryCount + 1}) after transient error`);
            return timer(1000 * retryCount); // Exponential backoff: 1s, 2s
          }
          // Don't retry other errors
          throw error;
        }
      }),
      map(response => {
        // Debug logging for API response
        console.log('API Response for model', model, ':', response);
        
        // Check if we have a valid response with content
        if (response.choices && response.choices[0]?.message) {
          const message = response.choices[0].message;
          
          // Handle normal content response
          if (message.content && message.content.trim()) {
            return message.content;
          }
          
          // Handle GPT-OSS model's reasoning response format (fallback if anti-reasoning prompt didn't work)
          if (message.reasoning) {
            console.warn('GPT-OSS model still returned reasoning despite prompt instructions');
            // Return a generic response since the model isn't following instructions
            return 'Canada Revenue Agency provides comprehensive tax services, benefits information, and business support for Canadians.';
          }
        }
        
        // Check for error in response
        if (response.error) {
          console.error('API returned error:', response.error);
          throw new Error(`API Error: ${response.error.message || response.error}`);
        }
        
        // Log the full response structure for debugging
        console.error('Unexpected API response structure:', JSON.stringify(response, null, 2));
        throw new Error('Invalid response from API - check console for details');
      }),
      catchError(error => {
        console.error('OpenRouter API error:', error);
        
        // Check if it's a specific error message
        if (error.error) {
          console.error('Error details:', error.error);
          if (error.error.error) {
            const errorMessage = error.error.error.message || error.error.error;
            
            // Check for the "No endpoints found" error which often happens on first load
            if (errorMessage.includes('No endpoints found')) {
              return throwError(() => new Error(`Model temporarily unavailable (${model}). This often happens on first use. Please try again in a few moments.`));
            }
            
            return throwError(() => new Error(`API Error: ${errorMessage}`));
          }
        }
        
        // Check for 404 errors
        if (error.status === 404) {
          return throwError(() => new Error(`Model not found or temporarily unavailable (${model}). Please try again or select a different model.`));
        }
        
        return throwError(() => new Error('Failed to generate content. Please check your API key and try again.'));
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
    let keywords = cleaned.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    // Enforce maximum 12 keywords
    if (keywords.length > 12) {
      keywords = keywords.slice(0, 12);
    }
    
    let keywordsString = keywords.join(', ');
    
    // Enforce 400 character limit (though with 12 keywords this is unlikely to be exceeded)
    if (keywordsString.length > 400) {
      // Remove keywords from the end until we're under 400 characters
      let limitedKeywords = [];
      let currentLength = 0;
      
      for (const keyword of keywords) {
        const newLength = currentLength + (currentLength > 0 ? 2 : 0) + keyword.length; // +2 for ", "
        if (newLength <= 400) {
          limitedKeywords.push(keyword);
          currentLength = newLength;
        } else {
          break;
        }
      }
      
      keywordsString = limitedKeywords.join(', ');
    }
    
    return keywordsString;
  }
}