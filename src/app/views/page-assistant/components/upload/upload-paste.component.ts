import { Component, Output, EventEmitter, Input } from '@angular/core';
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';

//primeNG
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { Message } from 'primeng/message';

//Page assistant
import { UrlDataService } from '../../services/url-data.service';
import { UploadStateService } from '../../services/upload-state.service';
import { UploadData, ModifiedData } from '../../data/data.model'

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
  production: boolean = environment.production;

  get labelKey(): string {
    return this.mode === 'prototype' ? 'page.upload.paste.modified' : 'page.upload.paste.original';
  }

  //Export upload complete
  @Output() uploadComplete = new EventEmitter<void>();

  //Initialize stuff
  userInput: string = '';
  error: string = '';
  loading = false;

  //This runs first, use it to inject services & other dependencies (delete if not needed)
  constructor(private urlDataService: UrlDataService, private uploadState: UploadStateService, private translate: TranslateService) { }

  async getPasteContent(): Promise<void> {
    const unknownError = this.translate.instant('page.upload.error.unknown');
    const tryError = this.translate.instant('page.upload.paste.error.try');
    this.loading = true;
    this.error = '';

    try {
      const mainHTML = await this.urlDataService.extractContent(this.userInput);

      //Emit original data & set modified to same (no changes)
      if (this.mode === 'original') {
        this.uploadState.setUploadData({
          originalUrl: "Copy/Paste",
          originalHtml: mainHTML.html,
          modifiedUrl: "Copy/Paste",
          modifiedHtml: mainHTML.html,
          found: {
            original: mainHTML.found,
            modified: mainHTML.found
          }
        });
      }
      if (this.mode === 'prototype') {
        this.uploadState.mergeModifiedData({
          modifiedUrl: "Copy/Paste",
          modifiedHtml: mainHTML.html
        });
        this.uploadState.mergeFoundFlags('modified', mainHTML.found);
      }

      this.uploadComplete.emit();
    } catch (err: any) {
      this.error = `${tryError} ${err.message || err || unknownError}`;
    } finally {
      this.loading = false;
    }
  }
  //Emit sample data
  async loadSampleData(): Promise<void> {
    await this.urlDataService.loadSampleDataset('snippet');
    this.uploadComplete.emit();
  }
}