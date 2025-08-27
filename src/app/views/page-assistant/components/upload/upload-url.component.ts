import { Component, Output, EventEmitter, Input } from '@angular/core';
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

//primeNG
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { MessageModule } from 'primeng/message';

//Amimations
import { trigger, state, style, transition, animate } from '@angular/animations';

//Page assistant
import { UrlDataService } from '../../services/url-data.service';
import { UploadStateService } from '../../services/upload-state.service';
import { UploadData, ModifiedData } from '../../data/data.model'

@Component({
  selector: 'ca-upload-url',
  imports: [CommonModule,
    TranslateModule,
    FormsModule,
    ButtonModule, InputTextModule, InputGroupModule, InputGroupAddonModule, MessageModule],
  templateUrl: './upload-url.component.html',
  styles: `
    :host {
      display: block;
    }
    ::ng-deep button.p-button.nohover:hover {
    background-color: transparent !important;
    }
    ::ng-deep button.p-button.nohover {
    border: none !important;
    }
  `,
  animations: [
    trigger('slideDown', [
      state('void', style({ opacity: 0, transform: 'translateY(-20px)' })),
      state('*', style({ opacity: 1, transform: 'translateY(0)' })),
      transition(':enter', animate('200ms ease-out')),
      transition(':leave', animate('100ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' })))
    ])
  ]
})
export class UploadUrlComponent {

  //Import data from parent component
  @Input() mode: 'original' | 'prototype' = 'original';
  @Input() showSampleDataButton = true;

  get labelKey(): string {
    return this.mode === 'prototype' ? 'page.upload.url.modified' : 'page.upload.url.original';
  }

  //Export upload complete
  @Output() uploadComplete = new EventEmitter<void>();

  //Initialize stuff
  userInput: string = '';
  error: string = '';
  loading = false;
  showHelp: boolean = false;

  //This runs first, use it to inject services & other dependencies (delete if not needed)
  constructor(private urlDataService: UrlDataService, private uploadState: UploadStateService, private translate: TranslateService) { }

  async getHtmlContent() {
    const unknownError = this.translate.instant('page.upload.error.unknown');
    const tryError = this.translate.instant('page.upload.url.error.try');
    this.loading = true;
    this.error = '';

    try {
      const mainHTML = await this.urlDataService.fetchAndProcess(this.userInput);

      //Emit original data & set modified to same (no changes)
      if (this.mode === 'original') {
        this.uploadState.setUploadData({
          originalUrl: this.userInput,
          originalHtml: mainHTML.html,
          modifiedUrl: this.userInput,
          modifiedHtml: mainHTML.html,
          found: {
            original: mainHTML.found,
            modified: mainHTML.found,
          },
          metadata: mainHTML.metadata,
          breadcrumb: mainHTML.breadcrumb
        });
      }
      if (this.mode === 'prototype') {
        this.uploadState.mergeModifiedData({
          modifiedUrl: this.userInput,
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
  async loadSampleData() {
    await this.urlDataService.loadSampleDataset('webpage');
    this.uploadComplete.emit();
  }
}
