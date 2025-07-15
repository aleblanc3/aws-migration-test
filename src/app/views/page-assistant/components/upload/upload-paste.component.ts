import { Component, Output, EventEmitter } from '@angular/core'; 
import { TranslateModule } from "@ngx-translate/core";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

//primeNG
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { CardModule } from 'primeng/card';
import { Message } from 'primeng/message';

//Page assistant
import { sampleHtmlA, sampleHtmlB } from './sample-data';
import { UrlDataService } from '../url-data.service';

@Component({
  selector: 'ca-upload-paste',
 imports: [CommonModule, 
            TranslateModule, 
            FormsModule, 
            ButtonModule, TextareaModule, Message, CardModule],
  templateUrl: './upload-paste.component.html',
  styles: `
    :host {
      display: block;
    }
  `
})
export class UploadPasteComponent {

//Export data to parent component
   @Output() uploadData = new EventEmitter<{ originalUrl: string, originalHtml: string, modifiedUrl: string, modifiedHtml: string }>();

  //Initialize stuff
  originalUrl: string = '';
  originalHtml: string = '';
  modifiedUrl: string = '';
  modifiedHtml: string = '';
  userInput: string = '';
  error: string = '';
  loading = false;

  //This runs first, use it to inject services & other dependencies (delete if not needed)
  constructor(private urlDataService: UrlDataService) { }

  async getPasteContent() {
    this.loading = true;
    this.error = '';

    try {
      const mainHTML = await this.urlDataService.extractContent(this.userInput);

      //Emit original data & set modified to same (no changes)
      this.uploadData.emit({
        originalUrl: this.userInput,
        originalHtml: mainHTML,
        modifiedUrl: this.userInput,
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
      const originalHtml = await this.urlDataService.extractContent(sampleHtmlA);
      const modifiedHtml = await this.urlDataService.extractContent(sampleHtmlB);
      this.uploadData.emit({
        originalUrl: "Sample data A",
        originalHtml: originalHtml,
        modifiedUrl: "Sample data B",
        modifiedHtml: modifiedHtml
      });
  }
}