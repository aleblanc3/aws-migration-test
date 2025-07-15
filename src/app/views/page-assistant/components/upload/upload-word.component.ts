import { Component, Output, EventEmitter } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FileUploadModule } from 'primeng/fileupload';
import * as mammoth from 'mammoth';

@Component({
  selector: 'ca-upload-word',
  imports: [CommonModule,
    TranslateModule,
    FormsModule,
    FileUploadModule],
  templateUrl: './upload-word.component.html',
  styles: `
    :host {
      display: block;
    }
    :host ::ng-deep .p-fileupload-content {
      background: transparent;
      box-shadow: none;
      padding: 0;
      border: none;
    }
  `
})
export class UploadWordComponent {

  //Export data to parent component
  @Output() uploadData = new EventEmitter<{ originalUrl: string, originalHtml: string, modifiedUrl: string, modifiedHtml: string }>();

  //Initialize stuff
  originalUrl: string = '';
  originalHtml: string = '';
  modifiedUrl: string = '';
  modifiedHtml: string = '';
  wordInput: string = '';
  error: string = '';
  loading = false;
  uploadedFileName: string = '';

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
        if (!html) {
          console.warn('The document is empty or could not be read.');
          return;
        }

        //Emit original data & set modified to same (no changes)
        this.uploadData.emit({
          originalUrl: file.name,
          originalHtml: html,
          modifiedUrl: file.name,
          modifiedHtml: html
        });
      } catch (err) {
        console.error("Error extracting text:", err);
      }
    };

    reader.readAsArrayBuffer(file);
  }

}
