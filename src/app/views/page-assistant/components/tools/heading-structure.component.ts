import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

//primeNG
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';

//Services
import { UploadStateService } from '../../services/upload-state.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core';

interface HeadingData {
  order: number;
  type: string;
  text: string;
}

interface Column {
  field: string;
  header: string;
}

@Component({
  selector: 'ca-heading-structure',
  imports: [CommonModule, FormsModule,
    TranslateModule,
    TableModule, ButtonModule
  ],
  templateUrl: './heading-structure.component.html',
  styles: ``
})
export class HeadingStructureComponent implements OnInit {

  constructor(private uploadState: UploadStateService, private translate: TranslateService) { }

  ngOnInit() {
    this.fetchHeadings();
    this.cols = [
      { field: 'order', header: 'Original order' },
      { field: 'type', header: 'Heading type' },
      { field: 'text', header: 'Text' }
    ];
  }
  headings: HeadingData[] = [];
  selectedHeading!: HeadingData;
  cols!: Column[];

  headingTypes = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'summary'];

  fetchHeadings() { //Note: this fxn may move to url-data.service
    try {
      const data = this.uploadState.getUploadData();
      if (!data || !data.originalHtml) return;

      const parser = new DOMParser();
      const doc = parser.parseFromString(data.originalHtml, 'text/html'); //future improvement: option to use data.modifiedHtml if we want the headings returned by the AI

      const selector = this.headingTypes.join(', ');
      const elements = doc.querySelectorAll(selector);

      this.headings = Array.from(elements).map((el, index) => ({
        order: index + 1, //this is so we can track the original order
        type: el.tagName.toLowerCase(),
        text: el.textContent?.trim() || ''
      }));
    } catch (err) {
      console.error('Failed to get heading from HTML data', err);
    }
  }

  //In-line styles
  getTextStyle(row: any) {
    switch (row.type) {
      case 'h1': return { fontWeight: 'bold' };
      case 'h2': return { fontWeight: 'bold' };
      case 'h6': return { color: 'gray' };
      case 'summary': return { color: 'blue' };
      default: return {};
    }
  }
  //Classes
  getTextClass(heading: HeadingData) {
    switch (heading.type) {
      case 'h1': return { '': heading.type === 'h1' };
      case 'h2': return { 'pl-4': heading.type === 'h2' };
      case 'h3': return { 'pl-6': heading.type === 'h3' };
      case 'h4': return { 'pl-7': heading.type === 'h4' };
      case 'h5': return { 'pl-8': heading.type === 'h5' };
      case 'h6': return { 'pl-8': heading.type === 'h6' };
      case 'summary': return { 'pl-8': heading.type === 'summary' };
      default: return {};
    }
  }

}
