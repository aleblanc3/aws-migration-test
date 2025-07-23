import { Component, Output, EventEmitter, Input } from '@angular/core';
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

//primeNG
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';
import { Message } from 'primeng/message';

//Page assistant
import { UrlDataService } from '../url-data.service';
import { UploadData, ModifiedData } from '../../../../common/data.types'
import * as mammoth from 'mammoth';

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

  //Export data to parent component
  @Output() modifiedData = new EventEmitter<ModifiedData>();
  @Output() uploadData = new EventEmitter<UploadData>();

  constructor(private urlDataService: UrlDataService, private translate: TranslateService) { }

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
    const unknownError = this.translate.instant('page.upload.word.error.unknown');
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
        const result = await mammoth.convertToHtml({ arrayBuffer });
        const html = result.value.trim();
        if (!html) {
          this.error = docError;
          return;
        }

        //Emit original data & set modified to same (no changes)
        /* this.uploadData.emit({
              originalUrl: file.name,
              originalHtml: html,
              modifiedUrl: file.name,
              modifiedHtml: html
              }); */

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
      this.uploadData.emit({
        originalUrl: this.uploadedFileName,
        originalHtml: this.extractedHtml,
        modifiedUrl: this.uploadedFileName,
        modifiedHtml: this.extractedHtml
      });
    }
    if (this.mode === 'prototype') {
      this.modifiedData.emit({
        modifiedUrl: this.uploadedFileName,
        modifiedHtml: this.extractedHtml
      });
    }
  }
  //Emit sample data
  async loadSampleData() {
    const uploadData = await this.urlDataService.loadSampleDataset('word');
    this.uploadData.emit(uploadData);
  }

}
