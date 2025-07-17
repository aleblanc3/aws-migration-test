import { Injectable } from '@angular/core';
import * as JSZip from 'jszip';

@Injectable({ providedIn: 'root' })
export class FileParseService {
  async extractDocxParagraphs(arrayBuffer: ArrayBuffer): Promise<string> {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const xmlStr = await zip.file('word/document.xml')!.async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, 'application/xml');

    const paras = Array.from(xmlDoc.getElementsByTagName('w:p'));
    const fullText: string[] = [];

    paras.forEach((p) => {
      const texts = Array.from(p.getElementsByTagName('w:t'))
        .map((t) => t.textContent || '')
        .join('');
      if (texts.trim()) fullText.push(texts.trim());
    });
    return fullText.join('\n\n');
  }

  async extractPptxText(arrayBuffer: ArrayBuffer): Promise<string> {
    const zip = await JSZip.loadAsync(arrayBuffer);

    const slideEntries = Object.keys(zip.files).filter((f) =>
      /^ppt\/slides\/slide\d+\.xml$/i.test(f)
    );

    const allParagraphs: string[] = [];

    for (const entry of slideEntries) {
      const xmlStr = await zip.file(entry)!.async('string');
      const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
      const slideNumber = entry.match(/slide(\d+)\.xml$/i)![1];

      const paraNodes = Array.from(doc.getElementsByTagName('a:p'));
      for (const para of paraNodes) {
        let paragraphText = '';

        const textNodes = Array.from(para.getElementsByTagName('a:t'));
        for (const node of textNodes) {
          const raw = node.textContent?.trim() ?? '';

          if (raw === slideNumber) continue;

          let anc: Node | null = node.parentNode;
          let skip = false;
          while (anc) {
            if (
              anc instanceof Element &&
              anc.localName === 'fld' &&
              anc.getAttribute('type') === 'slidenum'
            ) {
              skip = true;
              break;
            }
            anc = anc.parentNode;
          }
          if (skip) continue;

          paragraphText += node.textContent ?? '';
        }

        if (paragraphText.trim()) {
          allParagraphs.push(paragraphText.trim());
        }
      }
    }

    return allParagraphs.join('\n\n');
  }

  async extractDocxTextXmlWithId(
    arrayBuffer: ArrayBuffer
  ): Promise<{ id: string; text: string }[]> {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const xml = await zip.file('word/document.xml')!.async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const paras = Array.from(doc.getElementsByTagName('w:p'));
    const out: { id: string; text: string }[] = [];
    let pCount = 1;
    for (const p of paras) {
      const texts = Array.from(p.getElementsByTagName('w:t')).map((t) =>
        (t.textContent || '').trim()
      );
      if (!texts.join('').trim()) {
        pCount++;
        continue;
      }
      let rCount = 1;
      for (const t of texts) {
        if (t) out.push({ id: `P${pCount}_R${rCount}`, text: t });
        rCount++;
      }
      pCount++;
    }
    return out;
  }

  async extractPptxTextXmlWithId(
    arrayBuffer: ArrayBuffer
  ): Promise<{ id: string; text: string }[]> {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const slides = Object.keys(zip.files).filter((f) =>
      /^ppt\/slides\/slide(\d+)\.xml$/.test(f)
    );
    const out: { id: string; text: string }[] = [];
    for (const f of slides) {
      const slideNum = f.match(/\d+/)![0];
      const xml = await zip.file(f)!.async('string');
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const runs = Array.from(doc.getElementsByTagName('a:r')).filter(
        (r) => r.getElementsByTagName('a:t').length
      );
      runs.forEach((r, idx) => {
        const t = r.getElementsByTagName('a:t')[0].textContent || '';
        out.push({ id: `S${slideNum}_T${idx + 1}`, text: t.trim() });
      });
    }
    return out;
  }
}
