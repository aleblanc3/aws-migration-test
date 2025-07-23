import { Component, Output, EventEmitter, Input } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

//primeNG
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { Message } from 'primeng/message';

//Page assistant
import { UrlDataService } from '../url-data.service';
import { UploadData, ModifiedData } from '../../../../common/data.types'

@Component({
  selector: 'ca-upload-url',
  imports: [CommonModule,
    TranslateModule,
    FormsModule,
    ButtonModule, InputTextModule, InputGroupModule, InputGroupAddonModule, Message],
  templateUrl: './upload-url.component.html',
  styles: `
    :host {
      display: block;
    }
  `
})
export class UploadUrlComponent {

  //Import data from parent component
  @Input() mode: 'original' | 'prototype' = 'original';
  @Input() showSampleDataButton = true;

  get labelKey(): string {
    return this.mode === 'prototype' ? 'page.upload.url.modified' : 'page.upload.url.original';
  }

  //Export data to parent component
  @Output() modifiedData = new EventEmitter<ModifiedData>();
  @Output() uploadData = new EventEmitter<UploadData>();

  //Initialize stuff
  userInput: string = '';
  error: string = '';
  loading = false;
  showHelp: boolean = false;

  //This runs first, use it to inject services & other dependencies (delete if not needed)
  constructor(private urlDataService: UrlDataService) { }

  async getHtmlContent() {
    this.loading = true;
    this.error = '';

    try {
      const mainHTML = await this.urlDataService.fetchAndProcess(this.userInput);

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
      this.error = `Failed to fetch page: ${err.message || err || 'Unknown error'}`;
    } finally {
      this.loading = false;
    }
  }
  //Emit sample data
  async loadSampleData() {
    const uploadData = await this.urlDataService.loadSampleDataset('webpage');
    this.uploadData.emit(uploadData);
  }
}
