import { Component, Output, EventEmitter, Input } from '@angular/core';
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

//primeNG
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { Message } from 'primeng/message';

//Page assistant
import { UrlDataService } from '../../services/url-data.service';
import { UploadStateService } from '../../services/upload-state.service';

@Component({
  selector: 'ca-upload-word',
  imports: [CommonModule,
    TranslateModule,
    FormsModule,
    FileUploadModule, ButtonModule, Message],
  templateUrl: './upload-word.component.html',
  styles: `
    :host {
      display: block;
    }
    :host ::ng-deep .p-fileupload-header {
      background: transparent;
      box-shadow: none;
      padding: 0;
      border: none;
    }
    :host ::ng-deep .p-fileupload-content {
      background: transparent;
      box-shadow: none;
      padding: 0;
      border: none;
    }
    :host ::ng-deep .p-fileupload .p-progressbar {
  margin: 0 !important;
  padding: 0 !important;
  height: 0 !important;
  display: none !important;
  border: none !important;
}
::ng-deep .p-fileupload {
  --p-fileupload-content-gap: 0.0rem;
}
  `
})
export class UploadWordComponent {

  //Import data from parent component
  @Input() mode: 'original' | 'prototype' = 'original';
  @Input() showSampleDataButton = true;

  //Export upload complete
  @Output() uploadComplete = new EventEmitter<void>();

  constructor(private urlDataService: UrlDataService, private uploadState: UploadStateService, private translate: TranslateService) { }

  //Initialize stuff
  error: string = '';
  loading = false;
  extractedHtml: string = ''; //only needed if emit is a separate step
  uploadedFileName: string = ''; //only needed if emit is a separate step

  formatSize(bytes: number): string {
    const k = 1024;
    const dm = 1; //decimal points
    const sizes = this.translate.instant('fileSizeTypes') as string[];
    const sizesWarning = this.translate.instant('fileSizeTypes.warning');

    //Error handling
    if (!sizes || !Array.isArray(sizes)) {
      console.warn(sizesWarning);
      return `${bytes} B`;
    }
    if (bytes === 0) {
      return `0 ${sizes[0]}`;
    }

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
    const index = Math.min(i, sizes.length - 1);

    return `${formattedSize} ${sizes[index]}`;
  }

  getWordContent(event: any): void {
    this.loading = true;
    const uploadError = this.translate.instant('page.upload.word.error.upload');
    const docError = this.translate.instant('page.upload.word.error.doc');
    const unknownError = this.translate.instant('page.upload.error.unknown');
    const tryError = this.translate.instant('page.upload.word.error.try');

    //console.log('Upload event received:', event);
    const file: File = event.files?.[0];
    if (!file) {
      this.error = uploadError;
      this.loading = false;
      return;
    }
    //console.log('File:', file.name);
    this.uploadedFileName = file.name;
    const reader = new FileReader();
    reader.onload = async () => {
      const arrayBuffer = reader.result as ArrayBuffer;

      try {
        const mammoth = await import('mammoth/mammoth.browser');
        const result = await mammoth.convertToHtml({ arrayBuffer });
        var html = result.value.trim();
        if (!html) {
          this.error = docError;
          return;
        }

        // Format the HTML
        html = await this.urlDataService.formatHtml(html, 'word');

        //Emit original data & set modified to same (no changes)
        /* if (this.mode === 'original') {
        this.uploadState.setUploadData({
          originalUrl: this.uploadedFileName,
          originalHtml: this.extractedHtml,
          modifiedUrl: this.uploadedFileName,
          modifiedHtml: this.extractedHtml
        });
      }
      if (this.mode === 'prototype') {
        this.uploadState.mergeModifiedData({
          modifiedUrl: this.uploadedFileName,
          modifiedHtml: this.extractedHtml
        });
      }
      
      this.uploadComplete.emit(); */

        //Remove this line if we want to emit during the upload step
        this.extractedHtml = html;

      } catch (err: any) {
        this.error = `${tryError} ${err.message || err || unknownError}`;
      } finally {
        this.loading = false;
      }
    };

    reader.readAsArrayBuffer(file);
  }

  //Remove this fxn if we want to emit during upload step
  emitData() {
    if (this.mode === 'original') {
      this.uploadState.setUploadData({
        originalUrl: this.uploadedFileName,
        originalHtml: this.extractedHtml,
        modifiedUrl: this.uploadedFileName,
        modifiedHtml: this.extractedHtml
      });
    }
    if (this.mode === 'prototype') {
      this.uploadState.mergeModifiedData({
        modifiedUrl: this.uploadedFileName,
        modifiedHtml: this.extractedHtml
      });
    }

    this.uploadComplete.emit();

  }
  //Emit sample data
  async loadSampleData() {
    await this.urlDataService.loadSampleDataset('word');
    this.uploadComplete.emit();
  }

}
