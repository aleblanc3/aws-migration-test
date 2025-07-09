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

//Page assistant
import { sampleHtmlA, sampleHtmlB } from './sample-data';
import { UrlDataService } from '../url-data.service';

@Component({
  selector: 'ca-upload-url',
  imports: [CommonModule, TranslateModule, FormsModule, ButtonModule, InputTextModule, InputGroupModule, InputGroupAddonModule, CardModule],
  templateUrl: './upload-url.component.html',
  styles: `
    :host {
      display: block;
    }
  `
})
export class UploadUrlComponent {

  //Export data to parent component
  @Output() uploadData = new EventEmitter<{ sourceURL: string, sourceHTML: string, prototypeURL?: string, prototypeHTML?: string }>();

  //Initialize stuff
  sourceURL: string = '';
  sourceHTML: string = '';
  prototypeURL: string = '';
  prototypeHTML: string = '';
  source: string = '';
  error: string = '';
  loading = false;

  //This runs first, use it to inject services & other dependencies (delete if not needed)
  constructor(private urlDataService: UrlDataService) { }

  async getHtmlContent() {
    this.loading = true;
    this.error = '';

    try {
      const mainHTML = await this.urlDataService.fetchAndProcess(this.source, 'source');

      //Emit source data & set prototype to same (no changes)
      this.uploadData.emit({
        sourceURL: this.source,
        sourceHTML: mainHTML,
        prototypeURL: this.source,
        prototypeHTML: mainHTML
      });

    } catch (err: any) {
      this.error = `Failed to fetch page: ${err.message}`;
    } finally {
      this.loading = false;
    }
  }
    //Emit sample data
    async loadSampleData() {
      const sourceHTML = await this.urlDataService.extractContent(sampleHtmlA);
      const prototypeHTML = await this.urlDataService.extractContent(sampleHtmlB);
      this.uploadData.emit({
        sourceURL: "Sample data A",
        sourceHTML: sourceHTML,
        prototypeURL: "Sample data B",
        prototypeHTML: prototypeHTML
      });
  }
}
