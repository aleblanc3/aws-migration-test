import { TranslateModule } from '@ngx-translate/core';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiKeyService } from '../../services/api-key.service';
import { RouterModule } from '@angular/router';
import { FileParseService } from '../../services/file-parse.service';

@Component({
  selector: 'app-translation-assistant',
  imports: [
    CommonModule, // *ngIf / <ng-template>
    RouterModule,
  ],
  templateUrl: './translation-assistant.component.html',
  styleUrls: ['./translation-assistant.component.css'],
})
export class TranslationAssistantComponent implements OnInit {
  selectedFile: File | null = null;
  previewText = '';
  previewVisible = false;
  showSecondUpload = false;
  sourceError = '';

  constructor(
    public apiKeyService: ApiKeyService,
    private router: Router,
    private route: ActivatedRoute,
    private parseSrv: FileParseService
  ) {}

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
}
