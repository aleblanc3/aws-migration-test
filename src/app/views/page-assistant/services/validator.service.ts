import { Injectable } from '@angular/core';
import { allowedElements, allowedClasses, disallowedAttributes, guidanceMap, guidanceContentMap } from '../data/css-list.config';

@Injectable({
  providedIn: 'root'
})
export class ValidatorService {

  validateHtml(html: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const violations: { type: string; detail: string; node: Element }[] = [];

    this.walkNodes(doc.body, violations);

    return violations;
  }

  private walkNodes(node: Element, violations: any[]) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();

      // Check element whitelist
      if (!allowedElements.includes(tagName)) {
        violations.push({
          type: 'element',
          detail: `Unexpected element <${tagName}>`,
          node
        });
      }

      // Check class whitelist
      node.classList.forEach(cls => {
        if (!this.isClassAllowed(cls)) {
          violations.push({
            type: 'class',
            detail: `Unexpected class "${cls}" on <${tagName}>`,
            node
          });
        }
      });

      // Check attributes
      Array.from(node.attributes).forEach(attr => {
        if (this.isAttributeDisallowed(attr.name)) {
          violations.push({
            type: 'attribute',
            detail: `Disallowed attribute "${attr.name}" on <${tagName}>`,
            node
          });
        }
      });
    }

    // Recurse children
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        this.walkNodes(child as Element, violations);
      }
    });
  }

  private isClassAllowed(cls: string): boolean {
    return allowedClasses.some(allowed => {
      if (typeof allowed === 'string') return allowed === cls;
      if (allowed instanceof RegExp) return allowed.test(cls);
      return false;
    });
  }

  private isAttributeDisallowed(attr: string): boolean {
    return disallowedAttributes.some(bad => {
      if (typeof bad === 'string') return bad === attr;
      if (bad instanceof RegExp) return bad.test(attr);
      return false;
    });
  }

  collectGuidanceUrls(html: string): { name: string; url: string }[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const found: Map<string, { name: string; url: string }> = new Map();

    this.walkForGuidance(doc.body, found);
    this.walkForContentGuidance(doc.body, found);

    return Array.from(found.values()); // unique by url
  }

  private walkForGuidance(node: Element, found: Map<string, { name: string; url: string }>) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      node.classList.forEach(cls => {
        for (const group of guidanceMap) {
          if (group.patterns.some(pat =>
            typeof pat === 'string' ? pat === cls : pat.test(cls)
          )) {
            found.set(group.url, { name: group.name, url: group.url });
          }
        }
      });
    }

    node.childNodes.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        this.walkForGuidance(child as Element, found);
      }
    });
  }

  private walkForContentGuidance(
    node: Element,
    found: Map<string, { name: string; url: string }>
  ) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();

      const text = node.textContent?.trim();
      if (text) {
        for (const group of guidanceContentMap) {
          if (group.tag === tagName &&
            group.patterns.some(pat =>
              typeof pat === 'string' ? pat === text : pat.test(text)
            )
          ) {
            found.set(group.url, { name: group.name, url: group.url });
          }
        }
      }
    }

    node.childNodes.forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        this.walkForContentGuidance(child as Element, found);
      }
    });
  }

}


