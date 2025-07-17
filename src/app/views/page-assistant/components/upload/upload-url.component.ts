import { Component, Output, EventEmitter } from '@angular/core'; 
import { TranslateModule } from "@ngx-translate/core";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

//primeNG
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { CardModule } from 'primeng/card';
import { Message } from 'primeng/message';

//Page assistant
import { sampleHtmlA, sampleHtmlB } from './sample-data';
import { UrlDataService } from '../url-data.service';

@Component({
  selector: 'ca-upload-url',
  imports: [CommonModule, 
            TranslateModule, 
            FormsModule, 
            ButtonModule, InputTextModule, InputGroupModule, InputGroupAddonModule, CardModule, Message],
  templateUrl: './upload-url.component.html',
  styles: `
    :host {
      display: block;
    }
  `
})
export class UploadUrlComponent {

  //Export data to parent component
   @Output() uploadData = new EventEmitter<{ originalUrl: string, originalHtml: string, modifiedUrl: string, modifiedHtml: string }>();

  //Initialize stuff
  originalUrl: string = '';
  originalHtml: string = '';
  modifiedUrl: string = '';
  modifiedHtml: string = '';
  urlInput: string = '';
  error: string = '';
  loading = false;

  //This runs first, use it to inject services & other dependencies (delete if not needed)
  constructor(private urlDataService: UrlDataService) { }

  async getHtmlContent() {
    this.loading = true;
    this.error = '';

    try {
      const mainHTML = await this.urlDataService.fetchAndProcess(this.urlInput);

      //Emit original data & set modified to same (no changes)
      this.uploadData.emit({
        originalUrl: this.urlInput,
        originalHtml: mainHTML,
        modifiedUrl: this.urlInput,
        modifiedHtml: mainHTML
      });

    } catch (err: any) {
      this.error = `Failed to fetch page: ${err.message}`;
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
