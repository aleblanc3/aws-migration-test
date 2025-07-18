import { Component, Output, EventEmitter } from '@angular/core';
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimeNG } from 'primeng/config';

//primeNG
import { ButtonModule } from 'primeng/button';
import { FileUploadModule } from 'primeng/fileupload';

//Page assistant
import { sampleHtmlA, sampleHtmlB } from './sample-data';
import { UrlDataService } from '../url-data.service';
import * as mammoth from 'mammoth';

@Component({
  selector: 'ca-upload-word',
  imports: [CommonModule,
    TranslateModule,
    FormsModule,
    FileUploadModule, ButtonModule],
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

  //Export data to parent component
  @Output() uploadData = new EventEmitter<{ originalUrl: string, originalHtml: string, modifiedUrl: string, modifiedHtml: string }>();

  constructor(private urlDataService: UrlDataService, private translate: TranslateService) { }

  //Initialize stuff
  originalUrl: string = '';
  originalHtml: string = '';
  modifiedUrl: string = '';
  modifiedHtml: string = '';
  wordInput: string = '';
  error: string = '';
  loading = false;
  uploadedFileName: string = '';
  totalSize: number = 0;
  totalSizePercent: number = 0;


  formatSize(bytes: number): string {
    const k = 1024;
    const dm = 1; //decimal points
    const sizes = this.translate.instant('fileSizeTypes') as string[];

    //Error handling
    if (!sizes || !Array.isArray(sizes)) {
      console.warn('Missing or invalid fileSizeTypes translation');
      return `${bytes} B`;
    }
    if (bytes === 0) {
      return `0 ${sizes[0]}`;
    }

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));

    return `${formattedSize} ${sizes[i]}`;
  }

  getWordContent(event: any): void {
    console.log('Upload event received:', event);
    const file: File = event.files?.[0];
    if (!file) {
      console.warn('No file found in upload event');
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
        console.log(html);
        if (!html) {
          console.warn('The document is empty or could not be read.');
          return;
        }

        //Emit original data & set modified to same (no changes)
        //  this.uploadData.emit({
        //   originalUrl: file.name,
        //    originalHtml: html,
        //   modifiedUrl: file.name,
        //    modifiedHtml: html
        //  });

        //Remove this line if we want to emit during the upload step
        this.originalHtml = html;

      } catch (err) {
        console.error("Error extracting text:", err);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  //Remove this fxn if we want to emit during upload step
  emitData() {
    this.uploadData.emit({
      originalUrl: this.uploadedFileName,
      originalHtml: this.originalHtml,
      modifiedUrl: this.uploadedFileName,
      modifiedHtml: this.originalHtml

    });
  }
  //Emit sample data
  async loadSampleData() {
    const uploadData = await this.urlDataService.loadSampleDataset('word');
    this.uploadData.emit(uploadData);
  }

}
