import { Component, Output, EventEmitter, Input } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

//primeNG
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { Message } from 'primeng/message';

//Page assistant
import { UrlDataService } from '../url-data.service';
import { UploadData, ModifiedData } from '../../../../common/data.types'

@Component({
  selector: 'ca-upload-paste',
  imports: [CommonModule,
    TranslateModule,
    FormsModule,
    ButtonModule, TextareaModule, Message],
  templateUrl: './upload-paste.component.html',
  styles: `
    :host {
      display: block;
    }
  `
})
export class UploadPasteComponent {

  //Import data from parent component
  @Input() mode: 'original' | 'prototype' = 'original';
  @Input() showSampleDataButton = true;

  get labelKey(): string {
    return this.mode === 'prototype' ? 'page.upload.paste.prototype' : 'page.upload.paste.original';
  }

  //Export data to parent component
  @Output() modifiedData = new EventEmitter<ModifiedData>();
  @Output() uploadData = new EventEmitter<UploadData>();

  //Initialize stuff
  userInput: string = '';
  error: string = '';
  loading = false;

  //This runs first, use it to inject services & other dependencies (delete if not needed)
  constructor(private urlDataService: UrlDataService) { }

  async getPasteContent(): Promise<void> {
    this.loading = true;
    this.error = '';

    try {
      const mainHTML = await this.urlDataService.extractContent(this.userInput);

      //Emit original data & set modified to same (no changes)
      if (this.mode === 'original') {
        this.uploadData.emit({
          originalUrl: this.userInput,
          originalHtml: mainHTML,
          modifiedUrl: this.userInput,
          modifiedHtml: mainHTML
        });
      }
      if (this.mode === 'prototype') {
        this.modifiedData.emit({
          modifiedUrl: this.userInput,
          modifiedHtml: mainHTML
        });
      }

    } catch (err: any) {
      this.error = `Failed to extract content: ${err.message || err || 'Unknown error'}`;
    } finally {
      this.loading = false;
    }
  }
  //Emit sample data
  async loadSampleData(): Promise<void> {
    const uploadData = await this.urlDataService.loadSampleDataset('snippet');
    this.uploadData.emit(uploadData);
  }
}