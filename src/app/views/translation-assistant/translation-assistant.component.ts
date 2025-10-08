import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

// primeNG
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { PanelModule } from 'primeng/panel';
import { MessageModule } from 'primeng/message';
import { FileUploadModule } from 'primeng/fileupload';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

// FontAwesome
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFilePowerpoint } from '@fortawesome/free-regular-svg-icons';

// services
import { ApiKeyService } from '../../services/api-key.service';
import { FileParseService } from '../../services/file-parse.service';
import { TranslationService } from '../../services/translation.service';

@Component({
  selector: 'ca-translation-assistant', // was 'app-translation-assistant'
  imports: [
    CommonModule,
    RouterModule,
    ButtonModule,
    CardModule,
    PanelModule,
    MessageModule,
    FileUploadModule,
    FormsModule,
    ProgressSpinnerModule,
    FontAwesomeModule,
  ],
  templateUrl: './translation-assistant.component.html',
  styles: ``,
})
export class TranslationAssistantComponent implements OnInit {
  // prefer-inject: replace constructor DI with inject()
  public readonly apiKeyService = inject(ApiKeyService);
  private readonly translationService = inject(TranslationService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly parseSrv = inject(FileParseService);

  isExpanded = false;
  isDragging = false;
  selectedFile: File | null = null;
  previewText = '';
  previewVisible = false;
  showSecondUpload = false;
  showDownloadSection = false;
  isProcessing = false;
  frenchText = '';
  englishHtmlStored = '';
  finalFrenchHtml = '';
  sourceError = '';
  faFilePowerpoint = faFilePowerpoint;

  onClear(): void {
    this.router
      .navigateByUrl('/', { skipLocationChange: true })
      .then(() => this.router.navigate([this.router.url]));
  }

  ngOnInit(): void {
    // check for API key in URL parameters
    this.route.queryParams.subscribe((params) => {
      const apiKey = params['key'];
      if (apiKey) {
        // set the API key from URL parameter
        this.apiKeyService.setKey(apiKey);
      }
    });
  }

  onFileSelected(event: Event) {
    this.previewText = '';
    this.showSecondUpload = false;
    this.sourceError = '';
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;

    if (this.selectedFile) {
      this.buildEnglishHtmlStored(this.selectedFile).catch(console.error);
    }
  }

  isDocx(file: File): boolean {
    return file.name.toLowerCase().endsWith('.docx');
  }

  isPptx(file: File): boolean {
    return file.name.toLowerCase().endsWith('.pptx');
  }

  onDragOver(event: DragEvent) {
    event.preventDefault(); // Prevent browser from opening the file
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;

    if (event.dataTransfer?.files.length) {
      const droppedFile = event.dataTransfer.files[0];
      if (
        droppedFile.name.endsWith('.docx') ||
        droppedFile.name.endsWith('.pptx')
      ) {
        this.selectedFile = droppedFile;
        this.previewText = '';
        this.showSecondUpload = false;
        this.sourceError = '';

        this.buildEnglishHtmlStored(this.selectedFile).catch(console.error);
        this.previewSource();
      } else {
        this.sourceError = 'Only .docx or .pptx files are supported.';
      }
    }
  }

  async previewSource() {
    if (!this.selectedFile) {
      this.sourceError = 'Please select a file first.';
      return;
    }

    const buf = await this.selectedFile.arrayBuffer();
    const ext = this.selectedFile.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'docx') {
        this.previewText = await this.parseSrv.extractDocxParagraphs(buf);
      } else if (ext === 'pptx') {
        this.previewText = await this.parseSrv.extractPptxText(buf);
      } else {
        this.sourceError = 'Only .docx or .pptx files are supported.';
      }
      this.showSecondUpload = true;
    } catch (e) {
      console.error(e);
      this.sourceError = 'Failed to extract text for preview.';
    }
  }

  copyAll(event: MouseEvent) {
    event.stopPropagation();

    const textToCopy = this.previewText.trim();
    if (!textToCopy) {
      alert('There is no text to copy!');
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).catch((err) => {
        console.error('Failed to copy: ', err);
        alert('Failed to copy text.');
      });
    } else {
      const textarea = document.createElement('textarea');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Fallback: Unable to copy', err);
        alert('Failed to copy text.');
      }
      document.body.removeChild(textarea);
    }
  }

  async onFormatTargetLanguageContent() {
    if (!this.frenchText.trim()) {
      alert('Please paste your translation first.');
      return;
    }

    this.isProcessing = true;
    this.showDownloadSection = false;

    try {
      const formattedHtml = await this.translationService.alignTranslation(
        this.englishHtmlStored,
        this.frenchText,
        this.selectedFile,
      );

      if (!formattedHtml) {
        alert('Formatting failed. No response from API.');
        return;
      }

      this.finalFrenchHtml = formattedHtml;
      console.log('Final French HTML:', this.finalFrenchHtml);

      this.showDownloadSection = true;
    } catch (error) {
      console.error('Error during formatting:', error);
      alert('An error occurred while formatting.');
    } finally {
      this.isProcessing = false;
    }
  }

  async onDownloadFile() {
    if (!this.finalFrenchHtml || !this.finalFrenchHtml.trim()) {
      alert('No formatted French document available.');
      return;
    }

    const fileExtension = this.selectedFile?.name
      .split('.')
      .pop()
      ?.toLowerCase();
    let mimeType =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (fileExtension === 'pptx') {
      mimeType =
        'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }

    try {
      const arrayBuffer = await this.selectedFile?.arrayBuffer();
      if (!arrayBuffer) {
        throw new Error('Failed to read the source file.');
      }

      const JSZipModule = await import('jszip');
      const zip = await JSZipModule.default.loadAsync(arrayBuffer);

      if (fileExtension === 'docx') {
        const docXml = await zip.file('word/document.xml')?.async('string');
        if (!docXml) throw new Error('Missing document.xml in DOCX file.');

        const rawMapping = await this.extractDocxTextXmlWithId(arrayBuffer);
        const aggregatedMapping = this.aggregateDocxMapping(rawMapping);
        const updatedDocXml = this.conversionDocxXmlModified(
          docXml,
          this.finalFrenchHtml,
          aggregatedMapping,
        );

        zip.file('word/document.xml', updatedDocXml);
      } else if (fileExtension === 'pptx') {
        const slideRegex = /^ppt\/slides\/slide(\d+)\.xml$/i;
        for (const fileName of Object.keys(zip.files)) {
          const match = slideRegex.exec(fileName);
          if (match) {
            const slideNumber = match[1];
            const slideXml = await zip.file(fileName)?.async('string');
            if (slideXml) {
              const updatedSlideXml = this.conversionPptxXml(
                slideXml,
                this.finalFrenchHtml,
                slideNumber,
              );
              zip.file(fileName, updatedSlideXml);
            }
          }
        }
      }

      const generatedBlob = await zip.generateAsync({ type: 'blob', mimeType });
      const baseFileName =
        this.selectedFile?.name.split('.').slice(0, -1).join('.') ||
        'translated-file';
      const modifiedFileName = `${baseFileName}-FR.${fileExtension}`;

      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(generatedBlob);
      downloadLink.download = modifiedFileName;
      downloadLink.click();
      URL.revokeObjectURL(downloadLink.href);
    } catch (error) {
      console.error('Error generating download file:', error);
      alert('Failed to generate the translated file.');
    }
  }

  private async extractDocxTextXmlWithId(arrayBuffer: ArrayBuffer) {
    const JSZipModule = await import('jszip');
    const zip = await JSZipModule.default.loadAsync(arrayBuffer);

    const docXmlStr = await zip.file('word/document.xml')?.async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXmlStr!, 'application/xml');

    const paragraphs = xmlDoc.getElementsByTagName('w:p');
    const textElements: { id: string; text: string }[] = [];
    let paragraphCounter = 1;

    for (const paragraph of paragraphs) {
      const runElements = paragraph.getElementsByTagName('w:r');
      if (runElements.length === 0) continue;

      let runCounter = 1;
      for (const run of runElements) {
        const textNodes = run.getElementsByTagName('w:t');
        for (const textNode of textNodes) {
          const id = `P${paragraphCounter}_R${runCounter++}`;
          textElements.push({ id, text: textNode.textContent || '' });
        }
      }
      paragraphCounter++;
    }
    return textElements;
  }

  private aggregateDocxMapping(mapping: { id: string; text: string }[]) {
    const aggregated: Record<string, { id: string; texts: string[] }> = {};
    mapping.forEach((item) => {
      const paraId = item.id.split('_')[0];
      if (!aggregated[paraId]) {
        aggregated[paraId] = { id: paraId, texts: [] };
      }
      aggregated[paraId].texts.push(item.text);
    });

    return Object.values(aggregated).map((entry) => {
      const combined = entry.texts.join('').replace(/\s+/g, ' ').trim(); // was let
      return { id: entry.id, text: combined };
    });
  }

  private async buildEnglishHtmlStored(file: File): Promise<void> {
    const buf = await file.arrayBuffer();
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'docx') {
      const rawMapping = await this.extractDocxTextXmlWithId(buf);
      const aggregatedMapping = this.aggregateDocxMapping(rawMapping);
      this.englishHtmlStored = aggregatedMapping
        .map((item) => `<p id="${item.id}">${item.text}</p>`)
        .join('');
    } else if (ext === 'pptx') {
      const rawMapping = await this.parseSrv.extractPptxTextXmlWithId(buf);
      this.englishHtmlStored = rawMapping
        .map((item) => `<p id="${item.id}">${item.text}</p>`)
        .join('');
    } else {
      this.englishHtmlStored = '';
    }

    console.log(
      'englishHtmlStored sample:',
      this.englishHtmlStored.slice(0, 200),
    );
  }

  private conversionDocxXmlModified(
    originalXml: string,
    finalFrenchHtml: string,
    aggregatedMapping: { id: string; text: string }[],
  ) {
    const frenchMap = this.buildFrenchTextMap(finalFrenchHtml);
    const parser = new DOMParser();
    const serializer = new XMLSerializer();
    const xmlDoc = parser.parseFromString(originalXml, 'application/xml');

    const paragraphs = xmlDoc.getElementsByTagName('w:p');
    let mappingIndex = 0;

    for (const p of paragraphs) {
      if (mappingIndex >= aggregatedMapping.length) break;

      const tElements = p.getElementsByTagName('w:t');
      if (tElements.length > 0 && tElements[0].textContent?.trim()) {
        const key = aggregatedMapping[mappingIndex].id;
        if (frenchMap[key]) {
          // Replace the text in the first <w:t> element
          tElements[0].textContent = frenchMap[key];

          // Ensure spaces are preserved in the first <w:t>
          const firstT = tElements[0] as Element;
          if (!firstT.getAttribute('xml:space')) {
            firstT.setAttribute('xml:space', 'preserve');
          }

          // Clear the text for any additional <w:t> elements
          for (let j = 1; j < tElements.length; j++) {
            tElements[j].textContent = '';
          }
        }
        mappingIndex++;
      }
    }

    return serializer.serializeToString(xmlDoc);
  }

  private conversionPptxXml(
    originalXml: string,
    finalFrenchHtml: string,
    slideNumber: string,
  ) {
    const frenchMap = this.buildFrenchTextMap(finalFrenchHtml);
    const memoryCache: Record<string, string> = {};
    let runIndex = 1;

    return originalXml.replace(
      /(<a:r>[\s\S]*?<a:t>)([\s\S]*?)(<\/a:t>[\s\S]*?<\/a:r>)/g,
      (match, prefix, origText, suffix) => {
        const key = `S${slideNumber}_T${runIndex++}`;
        const origTrim = (origText || '').trim();
        const candidateRaw = frenchMap[key];
        let newText = '';

        if (candidateRaw !== undefined) {
          const candidate = candidateRaw.trim();
          newText = candidate;
          if (origTrim && candidate !== origTrim) {
            memoryCache[origTrim] = candidate;
          }
        } else if (memoryCache[origTrim]) {
          newText = memoryCache[origTrim];
        } else if (/^\s*[\d.,-]+\s*$/.test(origTrim)) {
          newText = origTrim; // numeric fallback
        } else {
          newText = '';
        }

        // If bold, apply heading/inline spacing tweaks (parity with jQuery)
        if (newText && /<a:rPr[^>]*\sb="1"/.test(prefix)) {
          let t = newText.trim();
          const wordCount = t.split(/\s+/).length;
          const isHeading = wordCount > 2;
          if (isHeading) {
            if (!t.endsWith(' ')) t += ' ';
          } else {
            if (!t.startsWith(' ')) t = ' ' + t;
            if (!t.endsWith(' ')) t += ' ';
          }
          newText = t;
        }

        return prefix + this.escapeXml(newText) + suffix;
      },
    );
  }

  private buildFrenchTextMap(finalFrenchHtml: string) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = finalFrenchHtml;
    const paragraphs = tempDiv.querySelectorAll('p[id]');
    const map: Record<string, string> = {};
    paragraphs.forEach((p) => {
      const id = p.getAttribute('id');
      if (id) map[id] = p.textContent?.trim() || '';
    });
    return map;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
